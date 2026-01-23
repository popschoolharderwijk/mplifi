import { describe, expect, it } from 'bun:test';
import { createClientAs } from './db';
import { fixtures } from './fixtures';

const { allUserRoles, getProfileByEmail, getUserIdByEmail } = fixtures;

// Get target user_id for role update tests (student-b)
const targetUserId = getUserIdByEmail('student-b@test.nl');

if (!targetUserId) {
	throw new Error('Could not find student-b for role update tests');
}

describe('RLS: user_roles UPDATE - other users', () => {
	it('student cannot update user roles', async () => {
		const db = await createClientAs('student-a@test.nl');

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
		const db = await createClientAs('teacher-alice@test.nl');

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
		const db = await createClientAs('staff@test.nl');

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
		const db = await createClientAs('admin-one@test.nl');

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
		const db = await createClientAs('site-admin@test.nl');

		// Change student-b to teacher
		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'teacher' })
			.eq('user_id', targetUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.role).toBe('teacher');

		// Restore back to student
		const { error: restoreError } = await db
			.from('user_roles')
			.update({ role: 'student' })
			.eq('user_id', targetUserId);

		expect(restoreError).toBeNull();
	});
});

describe('RLS: user_roles UPDATE - own role', () => {
	it('student cannot update own role', async () => {
		const db = await createClientAs('student-a@test.nl');

		const studentProfile = getProfileByEmail('student-a@test.nl');
		if (!studentProfile) {
			throw new Error('Could not find student-a profile');
		}

		const { data, error } = await db
			.from('user_roles')
			.update({ role: 'teacher' })
			.eq('user_id', studentProfile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot update own role', async () => {
		const db = await createClientAs('teacher-alice@test.nl');

		const teacherProfile = getProfileByEmail('teacher-alice@test.nl');
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
		const db = await createClientAs('staff@test.nl');

		const staffProfile = getProfileByEmail('staff@test.nl');
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
		const db = await createClientAs('admin-one@test.nl');

		const adminProfile = getProfileByEmail('admin-one@test.nl');
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
		const db = await createClientAs('site-admin@test.nl');

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
