import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
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
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allProfiles.length);
	});

	it('teacher sees only own profile', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		// Teacher sees only their own profile
		expect(data).toHaveLength(1);

		const [profile] = data ?? [];
		expect(profile?.email).toBe(TestUsers.TEACHER_ALICE);
	});

	it('user without role sees only own profile', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		// Query profiles - RLS should filter to only their row
		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		const [user] = data ?? [];
		expect(user).toBeDefined();
		expect(user.email).toBe(TestUsers.STUDENT_001);
	});

	it('user cannot see other user profiles', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();

		const emails = data?.map((p) => p.email) ?? [];
		expect(emails).not.toContain(TestUsers.STUDENT_002);
		expect(emails).not.toContain(TestUsers.TEACHER_ALICE);
	});
});
