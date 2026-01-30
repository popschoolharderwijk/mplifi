/**
 * Test user emails for RLS testing.
 * These match the users seeded in supabase/seed.sql
 */
export const TestUsers = {
	// Site Admin
	SITE_ADMIN: 'site-admin@test.nl',

	// Admins
	ADMIN_ONE: 'admin-one@test.nl',
	ADMIN_TWO: 'admin-two@test.nl',

	// Staff
	STAFF: 'staff@test.nl',

	// Teachers
	TEACHER_ALICE: 'teacher-alice@test.nl',
	TEACHER_BOB: 'teacher-bob@test.nl',

	// Users without explicit role
	USER_A: 'student-a@test.nl',
	USER_B: 'student-b@test.nl',
	USER_C: 'student-c@test.nl',
	USER_D: 'student-d@test.nl',
} as const;

export type TestUser = (typeof TestUsers)[keyof typeof TestUsers];
