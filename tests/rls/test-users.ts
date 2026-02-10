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
	STAFF_ONE: 'staff-one@test.nl',
	STAFF_TWO: 'staff-two@test.nl',
	STAFF_THREE: 'staff-three@test.nl',
	STAFF_FOUR: 'staff-four@test.nl',
	STAFF_FIVE: 'staff-five@test.nl',

	// Teachers
	TEACHER_ALICE: 'teacher-alice@test.nl',
	TEACHER_BOB: 'teacher-bob@test.nl',
	TEACHER_CHARLIE: 'teacher-charlie@test.nl',
	TEACHER_DIANA: 'teacher-diana@test.nl',
	TEACHER_EVE: 'teacher-eve@test.nl',
	TEACHER_FRANK: 'teacher-frank@test.nl',
	TEACHER_GRACE: 'teacher-grace@test.nl',
	TEACHER_HENRY: 'teacher-henry@test.nl',
	TEACHER_IRIS: 'teacher-iris@test.nl',
	TEACHER_JACK: 'teacher-jack@test.nl',

	// Students (sample - there are 60 total)
	STUDENT_001: 'student-001@test.nl',
	STUDENT_002: 'student-002@test.nl',
	STUDENT_003: 'student-003@test.nl',
	STUDENT_004: 'student-004@test.nl',
	STUDENT_005: 'student-005@test.nl',
	STUDENT_006: 'student-006@test.nl',
	STUDENT_007: 'student-007@test.nl',
	STUDENT_008: 'student-008@test.nl',
	STUDENT_009: 'student-009@test.nl',
	STUDENT_010: 'student-010@test.nl',
	STUDENT_026: 'student-026@test.nl',

	// Users without role, teacher, or student
	USER_001: 'user-001@test.nl',
	USER_002: 'user-002@test.nl',
	USER_003: 'user-003@test.nl',
	USER_004: 'user-004@test.nl',
	USER_005: 'user-005@test.nl',
	USER_006: 'user-006@test.nl',
	USER_007: 'user-007@test.nl',
	USER_008: 'user-008@test.nl',
	USER_009: 'user-009@test.nl',
	USER_010: 'user-010@test.nl',
} as const;

export type TestUser = (typeof TestUsers)[keyof typeof TestUsers];
