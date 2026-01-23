import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { allProfiles } = fixtures;

describe('RLS: profiles SELECT', () => {
	it('site_admin sees all profiles', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allProfiles.length);
	});

	it('admin sees all profiles', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allProfiles.length);
	});

	it('staff sees all profiles', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allProfiles.length);
	});

	it('teacher sees own profile and their linked students only', async () => {
		// Teacher Alice teaches Student A & B (from seed.sql)
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		// Teacher sees: own profile + 2 linked students = 3 profiles
		expect(data).toHaveLength(3);

		const emails = data?.map((p) => p.email).sort() ?? [];
		expect(emails).toEqual([TestUsers.STUDENT_A, TestUsers.STUDENT_B, TestUsers.TEACHER_ALICE]);
	});

	it('teacher cannot see students of other teachers', async () => {
		// Teacher Alice should NOT see Student C & D (linked to Teacher Bob)
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();

		const emails = data?.map((p) => p.email) ?? [];
		expect(emails).not.toContain(TestUsers.STUDENT_C);
		expect(emails).not.toContain(TestUsers.STUDENT_D);
	});

	it('student sees only own profile', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		// Query profiles - RLS should filter to only their row
		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		const [user] = data ?? [];
		expect(user).toBeDefined();
		expect(user.email).toBe(TestUsers.STUDENT_A);
	});
});
