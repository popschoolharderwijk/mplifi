import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import { setupDatabaseStateVerification, type DatabaseState } from '../db-state';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

const { allUserRoles, getProfile, getUserId, requireUserId } = fixtures;

// Get target user_id for role update tests (use staff user)
const targetUserId = getUserId(TestUsers.STAFF_ONE);

if (!targetUserId) {
	throw new Error('Could not find staff user for role update tests');
}

describe('RLS: user_roles UPDATE - other users', () => {
	it('user without role cannot update user roles', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'staff' })
			.eq('user_id', targetUserId)
			.select();

		// RLS should block - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot update user roles', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'admin' })
			.eq('user_id', targetUserId)
			.select();

		// RLS should block - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('admin can update other user roles (except site_admin)', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Change staff to admin
		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'admin' })
			.eq('user_id', targetUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.role).toBe('admin');

		// Restore back to staff
		const { error: restoreError } = await db
			.from('user_roles')
			.update({ role: 'staff' })
			.eq('user_id', targetUserId);

		expect(restoreError).toBeNull();
	});

	it('admin cannot update site_admin roles', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Get site_admin's user_id
		const siteAdminRole = allUserRoles.find((ur) => ur.role === 'site_admin');
		if (!siteAdminRole) {
			throw new Error('Could not find site_admin role');
		}

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'admin' })
			.eq('user_id', siteAdminRole.user_id)
			.select();

		// RLS should block - admin cannot modify site_admin roles
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('admin cannot promote user to site_admin', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { error } = await db
			.from('user_roles')
			.update({ role: 'site_admin' })
			.eq('user_id', targetUserId)
			.select();

		// RLS WITH CHECK blocks this - returns an error (not just 0 rows)
		// because the USING clause passes but WITH CHECK fails
		expect(error).not.toBeNull();
		expect(error?.code).toBe('42501'); // RLS violation
	});

	it('site_admin can update other user roles', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Change staff to admin
		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'admin' })
			.eq('user_id', targetUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.role).toBe('admin');

		// Restore back to staff
		const { error: restoreError } = await db
			.from('user_roles')
			.update({ role: 'staff' })
			.eq('user_id', targetUserId);

		expect(restoreError).toBeNull();
	});
});

describe('RLS: user_roles UPDATE - own role', () => {
	it('user without role has no role to update', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const userId = requireUserId(TestUsers.STUDENT_001);

		// Users without a role have no entry in user_roles
		const { data, error } = await db.from('user_roles').update({ role: 'staff' }).eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot update own role', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const staffProfile = getProfile(TestUsers.STAFF_ONE);
		if (!staffProfile) {
			throw new Error('Could not find staff profile');
		}

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'admin' })
			.eq('user_id', staffProfile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('admin cannot update own role', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const adminProfile = getProfile(TestUsers.ADMIN_ONE);
		if (!adminProfile) {
			throw new Error('Could not find admin-one profile');
		}

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'site_admin' })
			.eq('user_id', adminProfile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('site_admin cannot demote themselves', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Get site_admin's own user_id
		const siteAdminRole = allUserRoles.find((ur) => ur.role === 'site_admin');
		if (!siteAdminRole) {
			throw new Error('Could not find site_admin role');
		}

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'admin' })
			.eq('user_id', siteAdminRole.user_id)
			.select();

		// RLS policy prevents site_admin from modifying own role
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
