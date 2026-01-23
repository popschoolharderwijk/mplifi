import { describe, expect, it } from 'bun:test';
import { createClientAs } from './db';
import { fixtures } from './fixtures';
import { TestUsers } from './test-users';

const { requireProfile, requireUserId } = fixtures;

describe('RLS: profiles UPDATE - own profile', () => {
	it('student can update own profile', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const profile = requireProfile(TestUsers.STUDENT_A);

		const { data, error } = await db
			.from('profiles')
			.update({ display_name: 'Updated Student A' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.display_name).toBe('Updated Student A');

		// Restore original
		await db.from('profiles').update({ display_name: 'Student A' }).eq('user_id', profile.user_id);
	});

	it('teacher can update own profile', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const profile = requireProfile(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('profiles')
			.update({ display_name: 'Updated Alice' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.display_name).toBe('Updated Alice');

		// Restore original
		await db.from('profiles').update({ display_name: 'Teacher Alice' }).eq('user_id', profile.user_id);
	});

	it('staff can update own profile', async () => {
		const db = await createClientAs(TestUsers.STAFF);
		const profile = requireProfile(TestUsers.STAFF);

		const { data, error } = await db
			.from('profiles')
			.update({ display_name: 'Updated Staff' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.display_name).toBe('Updated Staff');

		// Restore original
		await db.from('profiles').update({ display_name: 'Staff' }).eq('user_id', profile.user_id);
	});

	it('admin can update own profile', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const profile = requireProfile(TestUsers.ADMIN_ONE);

		const { data, error } = await db
			.from('profiles')
			.update({ display_name: 'Updated Admin' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.display_name).toBe('Updated Admin');

		// Restore original
		await db.from('profiles').update({ display_name: 'Admin One' }).eq('user_id', profile.user_id);
	});

	it('site_admin can update own profile', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const profile = requireProfile(TestUsers.SITE_ADMIN);

		const { data, error } = await db
			.from('profiles')
			.update({ display_name: 'Updated Site Admin' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.display_name).toBe('Updated Site Admin');

		// Restore original
		await db.from('profiles').update({ display_name: 'Site Admin' }).eq('user_id', profile.user_id);
	});
});

describe('RLS: profiles UPDATE - other profiles', () => {
	it('student cannot update other profiles', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const targetUserId = requireUserId(TestUsers.STUDENT_B);

		const { data, error } = await db
			.from('profiles')
			.update({ display_name: 'Hacked' })
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
			.update({ display_name: 'Hacked' })
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
			.update({ display_name: 'Staff Updated' })
			.eq('user_id', studentUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.display_name).toBe('Staff Updated');

		// Restore original
		await db.from('profiles').update({ display_name: originalProfile.display_name }).eq('user_id', studentUserId);
	});

	it('staff cannot update non-student profiles', async () => {
		const db = await createClientAs(TestUsers.STAFF);
		// Try to update teacher profile
		const teacherUserId = requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('profiles')
			.update({ display_name: 'Hacked' })
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
			.update({ display_name: 'Admin Updated' })
			.eq('user_id', teacherUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.display_name).toBe('Admin Updated');

		// Restore original - note: seed has typo "Teacher Box" instead of "Teacher Bob"
		await db.from('profiles').update({ display_name: originalProfile.display_name }).eq('user_id', teacherUserId);
	});

	it('site_admin can update any profile', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const staffUserId = requireUserId(TestUsers.STAFF);
		const originalProfile = requireProfile(TestUsers.STAFF);

		const { data, error } = await db
			.from('profiles')
			.update({ display_name: 'Site Admin Updated' })
			.eq('user_id', staffUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.display_name).toBe('Site Admin Updated');

		// Restore original
		await db.from('profiles').update({ display_name: originalProfile.display_name }).eq('user_id', staffUserId);
	});
});
