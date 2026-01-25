import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { requireProfile, requireUserId } = fixtures;

describe('RLS: profiles UPDATE - own profile', () => {
	it('student can update own profile', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const profile = requireProfile(TestUsers.STUDENT_A);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Updated', lastname: 'Student A' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.firstname).toBe('Updated');
		expect(data?.[0]?.lastname).toBe('Student A');

		// Restore original
		await db.from('profiles').update({ firstname: 'Student', lastname: 'A' }).eq('user_id', profile.user_id);
	});

	it('teacher can update own profile', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const profile = requireProfile(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Updated', lastname: 'Alice' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.firstname).toBe('Updated');
		expect(data?.[0]?.lastname).toBe('Alice');

		// Restore original
		await db.from('profiles').update({ firstname: 'Teacher', lastname: 'Alice' }).eq('user_id', profile.user_id);
	});

	it('staff can update own profile', async () => {
		const db = await createClientAs(TestUsers.STAFF);
		const profile = requireProfile(TestUsers.STAFF);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Updated', lastname: 'Staff' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.firstname).toBe('Updated');
		expect(data?.[0]?.lastname).toBe('Staff');

		// Restore original
		await db.from('profiles').update({ firstname: 'Staff', lastname: null }).eq('user_id', profile.user_id);
	});

	it('admin can update own profile', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const profile = requireProfile(TestUsers.ADMIN_ONE);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Updated', lastname: 'Admin' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.firstname).toBe('Updated');
		expect(data?.[0]?.lastname).toBe('Admin');

		// Restore original
		await db.from('profiles').update({ firstname: 'Admin', lastname: 'One' }).eq('user_id', profile.user_id);
	});

	it('site_admin can update own profile', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const profile = requireProfile(TestUsers.SITE_ADMIN);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Updated', lastname: 'Site Admin' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.firstname).toBe('Updated');
		expect(data?.[0]?.lastname).toBe('Site Admin');

		// Restore original
		await db.from('profiles').update({ firstname: 'Site', lastname: 'Admin' }).eq('user_id', profile.user_id);
	});
});

describe('RLS: profiles UPDATE - other profiles', () => {
	it('student cannot update other profiles', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const targetUserId = requireUserId(TestUsers.STUDENT_B);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Hacked', lastname: null })
			.eq('user_id', targetUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot update student profiles (no policy)', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		// Teacher Alice teaches Student A & B, but has no UPDATE policy for students
		const studentUserId = requireUserId(TestUsers.STUDENT_A);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Hacked', lastname: null })
			.eq('user_id', studentUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff can update student profiles', async () => {
		const db = await createClientAs(TestUsers.STAFF);
		const studentUserId = requireUserId(TestUsers.STUDENT_C);
		const originalProfile = requireProfile(TestUsers.STUDENT_C);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Staff', lastname: 'Updated' })
			.eq('user_id', studentUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.firstname).toBe('Staff');
		expect(data?.[0]?.lastname).toBe('Updated');

		// Restore original
		await db
			.from('profiles')
			.update({ firstname: originalProfile.firstname, lastname: originalProfile.lastname })
			.eq('user_id', studentUserId);
	});

	it('staff cannot update non-student profiles', async () => {
		const db = await createClientAs(TestUsers.STAFF);
		// Try to update teacher profile
		const teacherUserId = requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Hacked', lastname: null })
			.eq('user_id', teacherUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('admin can update any profile', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const teacherUserId = requireUserId(TestUsers.TEACHER_BOB);
		const originalProfile = requireProfile(TestUsers.TEACHER_BOB);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Admin', lastname: 'Updated' })
			.eq('user_id', teacherUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.firstname).toBe('Admin');
		expect(data?.[0]?.lastname).toBe('Updated');

		// Restore original - note: seed has typo "Teacher Box" instead of "Teacher Bob"
		await db
			.from('profiles')
			.update({ firstname: originalProfile.firstname, lastname: originalProfile.lastname })
			.eq('user_id', teacherUserId);
	});

	it('site_admin can update any profile', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const staffUserId = requireUserId(TestUsers.STAFF);
		const originalProfile = requireProfile(TestUsers.STAFF);

		const { data, error } = await db
			.from('profiles')
			.update({ firstname: 'Site Admin', lastname: 'Updated' })
			.eq('user_id', staffUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.firstname).toBe('Site Admin');
		expect(data?.[0]?.lastname).toBe('Updated');

		// Restore original
		await db
			.from('profiles')
			.update({ firstname: originalProfile.firstname, lastname: originalProfile.lastname })
			.eq('user_id', staffUserId);
	});
});
