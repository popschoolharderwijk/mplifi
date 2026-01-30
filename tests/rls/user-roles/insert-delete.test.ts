import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { requireUserId, allUserRoles } = fixtures;

/**
 * User roles INSERT/DELETE permissions:
 *
 * ADMINS:
 * - Can insert roles for users without a role (but NOT site_admin)
 * - Can delete roles (but NOT site_admin roles)
 *
 * SITE_ADMINS:
 * - Can insert any role
 * - Can delete any role
 *
 * All other roles (user, teacher, staff) cannot insert or delete roles.
 */

describe('RLS: user_roles INSERT - blocked for non-admin roles', () => {
	// Use a user without a role for insert tests
	const targetUserId = '00000000-0000-0000-0000-000000000100'; // USER_A

	it('user without role cannot insert user_role', async () => {
		const db = await createClientAs(TestUsers.USER_A);

		const { data, error } = await db.from('user_roles').insert({ user_id: targetUserId, role: 'teacher' }).select();

		// Should fail - no INSERT policy for regular users
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher cannot insert user_role', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').insert({ user_id: targetUserId, role: 'teacher' }).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('staff cannot insert user_role', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('user_roles').insert({ user_id: targetUserId, role: 'teacher' }).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: user_roles INSERT - admin permissions', () => {
	// Use USER_B for admin insert tests (to avoid conflicts with other tests)
	const targetUserId = '00000000-0000-0000-0000-000000000101'; // USER_B

	it('admin can insert user_role (non-site_admin)', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// First ensure no role exists
		await db.from('user_roles').delete().eq('user_id', targetUserId);

		const { data, error } = await db.from('user_roles').insert({ user_id: targetUserId, role: 'teacher' }).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.role).toBe('teacher');

		// Cleanup
		await db.from('user_roles').delete().eq('user_id', targetUserId);
	});

	it('admin cannot insert site_admin role', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db
			.from('user_roles')
			.insert({ user_id: targetUserId, role: 'site_admin' })
			.select();

		// Should fail - admin cannot assign site_admin
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('site_admin can insert any role including site_admin', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// First ensure no role exists
		await db.from('user_roles').delete().eq('user_id', targetUserId);

		const { data, error } = await db.from('user_roles').insert({ user_id: targetUserId, role: 'admin' }).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.role).toBe('admin');

		// Cleanup
		await db.from('user_roles').delete().eq('user_id', targetUserId);
	});
});

describe('RLS: user_roles DELETE - blocked for non-admin roles', () => {
	it('user without role cannot delete roles', async () => {
		const db = await createClientAs(TestUsers.USER_A);
		const userId = requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', userId).select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete roles', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const userId = requireUserId(TestUsers.TEACHER_BOB);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete roles', async () => {
		const db = await createClientAs(TestUsers.STAFF);
		const userId = requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: user_roles DELETE - admin permissions', () => {
	// Use USER_C for delete tests
	const targetUserId = '00000000-0000-0000-0000-000000000102'; // USER_C

	it('admin can delete non-site_admin roles', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const siteAdminDb = await createClientAs(TestUsers.SITE_ADMIN);

		// Setup: create a role to delete
		await siteAdminDb.from('user_roles').insert({ user_id: targetUserId, role: 'teacher' });

		const { data, error } = await db.from('user_roles').delete().eq('user_id', targetUserId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
	});

	it('admin cannot delete site_admin roles', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Get site_admin's user_id
		const siteAdminRole = allUserRoles.find((ur) => ur.role === 'site_admin');
		if (!siteAdminRole) {
			throw new Error('Could not find site_admin role');
		}

		const { data, error } = await db.from('user_roles').delete().eq('user_id', siteAdminRole.user_id).select();

		// RLS blocks - admin cannot delete site_admin roles
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('site_admin can delete any role', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Setup: create a role to delete
		await db.from('user_roles').insert({ user_id: targetUserId, role: 'staff' });

		const { data, error } = await db.from('user_roles').delete().eq('user_id', targetUserId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
	});
});
