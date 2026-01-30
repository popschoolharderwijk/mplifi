import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { allUserRoles, getProfile, getUserId } = fixtures;

// Get target user_id for role update tests (teacher-bob)
const targetUserId = getUserId(TestUsers.TEACHER_BOB);

if (!targetUserId) {
	throw new Error('Could not find teacher-bob for role update tests');
}

describe('RLS: user_roles UPDATE - other users', () => {
	it('user without role cannot update user roles', async () => {
		const db = await createClientAs(TestUsers.USER_A);

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'teacher' })
			.eq('user_id', targetUserId)
			.select();

		// RLS should block - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot update user roles', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'admin' })
			.eq('user_id', targetUserId)
			.select();

		// RLS should block - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot update user roles', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'teacher' })
			.eq('user_id', targetUserId)
			.select();

		// RLS should block - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('admin cannot update user roles', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'staff' })
			.eq('user_id', targetUserId)
			.select();

		// RLS should block - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('site_admin can update other user roles', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Change teacher-bob to staff
		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'staff' })
			.eq('user_id', targetUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.role).toBe('staff');

		// Restore back to teacher
		const { error: restoreError } = await db
			.from('user_roles')
			.update({ role: 'teacher' })
			.eq('user_id', targetUserId);

		expect(restoreError).toBeNull();
	});
});

describe('RLS: user_roles UPDATE - own role', () => {
	it('user without role has no role to update', async () => {
		const db = await createClientAs(TestUsers.USER_A);
		const userId = getUserId(TestUsers.USER_A);

		// Users without a role have no entry in user_roles
		const { data, error } = await db.from('user_roles').update({ role: 'teacher' }).eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot update own role', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const teacherProfile = getProfile(TestUsers.TEACHER_ALICE);
		if (!teacherProfile) {
			throw new Error('Could not find teacher-alice profile');
		}

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'admin' })
			.eq('user_id', teacherProfile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot update own role', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const staffProfile = getProfile(TestUsers.STAFF);
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
