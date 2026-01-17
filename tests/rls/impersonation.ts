import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_DEFAULT_KEY =
	process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;
// Test user UUIDs matching the seeded auth.users
export const USERS = {
	site_admin: '00000000-0000-0000-0000-000000000001',

	admin_1: '00000000-0000-0000-0000-000000000010',
	admin_2: '00000000-0000-0000-0000-000000000011',

	staff: '00000000-0000-0000-0000-000000000020',

	teacher_alice: '00000000-0000-0000-0000-000000000030',
	teacher_bob: '00000000-0000-0000-0000-000000000031',

	student_a: '00000000-0000-0000-0000-000000000100',
	student_b: '00000000-0000-0000-0000-000000000101',
	student_c: '00000000-0000-0000-0000-000000000102',
	student_d: '00000000-0000-0000-0000-000000000103',
} as const;

// Email addresses matching seeded auth.users
export const USER_EMAILS: Record<TestUser, string> = {
	site_admin: 'site-admin@test.nl',
	admin_1: 'admin-one@test.nl',
	admin_2: 'admin-two@test.nl',
	staff: 'staff@test.nl',
	teacher_alice: 'teacher-alice@test.nl',
	teacher_bob: 'teacher-bob@test.nl',
	student_a: 'student-a@test.nl',
	student_b: 'student-b@test.nl',
	student_c: 'student-c@test.nl',
	student_d: 'student-d@test.nl',
};

// All seeded users have this password
const TEST_PASSWORD = 'password';

export type TestUser = keyof typeof USERS;

/**
 * Sign in as a test user and return an authenticated Supabase client.
 * This uses real Supabase auth, so RLS policies are properly enforced.
 *
 * @param user - The test user to sign in as
 * @returns Authenticated Supabase client
 */
export async function signInAs(user: TestUser): Promise<SupabaseClient> {
	if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
		throw new Error(
			'Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_DEFAULT_KEY environment variables',
		);
	}

	const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_DEFAULT_KEY);

	const { error } = await supabase.auth.signInWithPassword({
		email: USER_EMAILS[user],
		password: TEST_PASSWORD,
	});

	if (error) {
		throw new Error(`Failed to sign in as ${user}: ${error.message}`);
	}

	return supabase;
}

/**
 * Create an anonymous (unauthenticated) Supabase client.
 * Useful for testing public access and anon policies.
 */
export function anonClient(): SupabaseClient {
	if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
		throw new Error(
			'Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_DEFAULT_KEY environment variables',
		);
	}

	return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_DEFAULT_KEY);
}
