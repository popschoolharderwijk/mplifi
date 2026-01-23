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

	// Students
	STUDENT_A: 'student-a@test.nl',
	STUDENT_B: 'student-b@test.nl',
	STUDENT_C: 'student-c@test.nl',
	STUDENT_D: 'student-d@test.nl',
} as const;

export type TestUser = (typeof TestUsers)[keyof typeof TestUsers];
