import { describe, expect, it } from 'bun:test';
import { createClientAs } from './db';
import { fixtures } from './fixtures';

const { allProfiles } = fixtures;

describe('RLS: profiles SELECT', () => {
	it('site_admin sees all profiles', async () => {
		const db = await createClientAs('site-admin@test.nl');

		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allProfiles.length);
	});

	it('student sees only own profile', async () => {
		// Sign in as student_a using real Supabase auth
		const db = await createClientAs('student-a@test.nl');

		// Query profiles - RLS should filter to only their row
		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		const [user] = data ?? [];
		expect(user).toBeDefined();
		expect(user.email).toBe('student-a@test.nl');
	});
});
