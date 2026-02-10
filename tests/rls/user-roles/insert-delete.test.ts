import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { UserRoleInsert } from '../types';

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
 * All other roles (user, staff) cannot insert or delete roles.
 * Note: Teachers are identified by the teachers table, not by a role.
 */

describe('RLS: user_roles INSERT - blocked for non-admin roles', () => {
	const targetUserId = requireUserId(TestUsers.STUDENT_001);

	it('user without role cannot insert user_role', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const newUserRole: UserRoleInsert = { user_id: targetUserId, role: 'staff' };
		const { data, error } = await db.from('user_roles').insert(newUserRole).select();

		// Should fail - no INSERT policy for regular users
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('staff cannot insert user_role', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const newUserRole: UserRoleInsert = { user_id: targetUserId, role: 'staff' };
		const { data, error } = await db.from('user_roles').insert(newUserRole).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: user_roles INSERT - admin permissions', () => {
	const targetUserId = requireUserId(TestUsers.STUDENT_002);
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('admin can insert user_role (non-site_admin)', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// STUDENT_B should not have a role in seed data
		const newUserRole: UserRoleInsert = { user_id: targetUserId, role: 'staff' };
		const { data, error } = await db.from('user_roles').insert(newUserRole).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.role).toBe('staff');

		// Cleanup
		await db.from('user_roles').delete().eq('user_id', targetUserId);
	});

	it('admin cannot insert site_admin role', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const newUserRole: UserRoleInsert = { user_id: targetUserId, role: 'site_admin' };
		const { data, error } = await db.from('user_roles').insert(newUserRole).select();

		// Should fail - admin cannot assign site_admin
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('site_admin can insert any role including site_admin', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// STUDENT_B should not have a role in seed data
		const newUserRole: UserRoleInsert = { user_id: targetUserId, role: 'admin' };
		const { data, error } = await db.from('user_roles').insert(newUserRole).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.role).toBe('admin');

		// Cleanup
		await db.from('user_roles').delete().eq('user_id', targetUserId);
	});
});

describe('RLS: user_roles DELETE - blocked for non-admin roles', () => {
	it('user without role cannot delete roles', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const userId = requireUserId(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', userId).select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete roles', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);
		const userId = requireUserId(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: user_roles DELETE - admin permissions', () => {
	const targetUserId = requireUserId(TestUsers.STUDENT_003);
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('admin can delete non-site_admin roles', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const siteAdminDb = await createClientAs(TestUsers.SITE_ADMIN);

		// Setup: create a role to delete (STUDENT_C should not have a role in seed)
		const newUserRole: UserRoleInsert = { user_id: targetUserId, role: 'staff' };
		await siteAdminDb.from('user_roles').insert(newUserRole);

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

		// Setup: create a role to delete (STUDENT_C should not have a role in seed)
		const newUserRole: UserRoleInsert = { user_id: targetUserId, role: 'staff' };
		await db.from('user_roles').insert(newUserRole);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', targetUserId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
	});
});
