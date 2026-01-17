import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export type TestUser = keyof typeof USERS;

/**
 * Execute a SELECT query as a specific user by leveraging the run_as_user()
 * database function. This properly simulates JWT claims so auth.uid() works
 * and RLS policies are correctly enforced.
 *
 * @param user - The test user to impersonate
 * @param query - A SELECT query to execute
 * @returns The query result with data and error
 */
export async function queryAs(user: TestUser, query: string) {
	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
		throw new Error(
			'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
		);
	}

	// Use service_role to call the run_as_user function
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	const { data, error } = await supabase.rpc('run_as_user', {
		_user_id: USERS[user],
		_query: query,
	});

	return { data, error };
}
