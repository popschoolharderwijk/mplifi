import { describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { requireProfile, allUserRoles } = fixtures;

describe('Triggers: profiles immutability', () => {
	it('user_id cannot be changed', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const profile = requireProfile(TestUsers.STUDENT_A);
		const fakeUserId = '00000000-0000-0000-0000-999999999999';

		const { error } = await db
			.from('profiles')
			.update({ user_id: fakeUserId })
			.eq('user_id', profile.user_id)
			.select();

		// Trigger should raise exception: 'user_id is immutable'
		expect(error).not.toBeNull();
		expect(error?.message).toContain('user_id is immutable');
	});

	it('email cannot be changed directly on profiles', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const profile = requireProfile(TestUsers.STUDENT_A);

		const { error } = await db
			.from('profiles')
			.update({ email: 'hacked@test.nl' })
			.eq('user_id', profile.user_id)
			.select();

		// Trigger should raise exception: 'profiles.email is read-only'
		expect(error).not.toBeNull();
		expect(error?.message).toContain('profiles.email is read-only');
	});

	it('updated_at is automatically updated on profile change', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const profile = requireProfile(TestUsers.STUDENT_A);
		const originalUpdatedAt = profile.updated_at;

		// Wait a moment to ensure time difference
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Update a valid field
		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Trigger', lastname: 'Test' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.firstname).toBe('Trigger');
		expect(data?.[0]?.lastname).toBe('Test');

		// Verify updated_at changed
		const newUpdatedAt = data?.[0]?.updated_at;
		expect(new Date(newUpdatedAt ?? 0).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());

		// Restore original name
		await db
			.from('profiles')
			.update({ firstname: profile.firstname, lastname: profile.lastname })
			.eq('user_id', profile.user_id);
	});
});

describe('Triggers: last site_admin protection', () => {
	it('last site_admin cannot be demoted', async () => {
		// We only have 1 site_admin, so this should be blocked by trigger
		const dbNoRLS = createClientBypassRLS();
		const siteAdminRole = allUserRoles.find((ur) => ur.role === 'site_admin');
		if (!siteAdminRole) {
			throw new Error('site_admin role not found in fixtures');
		}

		// Attempt to demote via service role (bypasses RLS but not trigger)
		const { error } = await dbNoRLS
			.from('user_roles')
			.update({ role: 'admin' })
			.eq('user_id', siteAdminRole.user_id)
			.select();

		// Trigger should block: 'Cannot remove the last site_admin'
		expect(error).not.toBeNull();
		expect(error?.message).toContain('Cannot remove the last site_admin');
	});

	it('last site_admin role cannot be deleted', async () => {
		const dbNoRLS = createClientBypassRLS();
		const siteAdminRole = allUserRoles.find((ur) => ur.role === 'site_admin');
		if (!siteAdminRole) {
			throw new Error('site_admin role not found in fixtures');
		}

		// Attempt to delete the role via service role
		const { error } = await dbNoRLS.from('user_roles').delete().eq('user_id', siteAdminRole.user_id).select();

		// Trigger should block
		expect(error).not.toBeNull();
		expect(error?.message).toContain('Cannot remove the last site_admin');
	});

	it('site_admin can be demoted if another site_admin exists', async () => {
		const dbNoRLS = createClientBypassRLS();
		const siteAdminRole = allUserRoles.find((ur) => ur.role === 'site_admin');
		const adminRole = allUserRoles.find((ur) => ur.role === 'admin');

		if (!siteAdminRole || !adminRole) {
			throw new Error('Required roles not found in fixtures');
		}

		// First, promote admin-one to site_admin
		const { error: promoteError } = await dbNoRLS
			.from('user_roles')
			.update({ role: 'site_admin' })
			.eq('user_id', adminRole.user_id);

		expect(promoteError).toBeNull();

		// Now we can demote the original site_admin (there are 2 now)
		const { data, error } = await dbNoRLS
			.from('user_roles')
			.update({ role: 'admin' })
			.eq('user_id', siteAdminRole.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.role).toBe('admin');

		// Restore: re-promote original site_admin and demote the temp one
		await dbNoRLS.from('user_roles').update({ role: 'site_admin' }).eq('user_id', siteAdminRole.user_id);

		await dbNoRLS.from('user_roles').update({ role: 'admin' }).eq('user_id', adminRole.user_id);
	});
});
