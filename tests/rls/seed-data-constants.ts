/**
 * Seed data constants for RLS tests.
 * These values reflect the exact counts from supabase/seed.sql.
 * Update this file when seed data changes, and all tests will automatically use the new values.
 */

/**
 * Lesson agreements counts
 */
export const LESSON_AGREEMENTS = {
	// Total number of lesson agreements in seed data
	TOTAL: 184,

	// Per teacher (from seed.sql)
	TEACHER_ALICE: 28, // students 009-025
	TEACHER_BOB: 28, // students 026-042
	TEACHER_CHARLIE: 21, // students 043-055
	TEACHER_DIANA: 21, // students 056-060, 009-016
	TEACHER_EVE: 8, // students 001-008 (Bandcoaching group lesson)
	TEACHER_FRANK: 21, // students 017-029
	TEACHER_GRACE: 21, // students 030-042
	TEACHER_HENRY: 21, // students 043-055
	TEACHER_IRIS: 15, // students 056-060, 017-022

	// Per student (from seed.sql)
	STUDENT_001: 1, // Bandcoaching with Teacher Eve
	STUDENT_009: 2, // Gitaar with Teacher Alice, DJ/Beats with Teacher Diana
	STUDENT_010: 2, // Gitaar with Teacher Alice, DJ/Beats with Teacher Diana
	STUDENT_026: 3, // Bas with Teacher Bob, Gitaar (2x) with Teacher Frank
} as const;

/**
 * Teacher availability counts
 */
export const TEACHER_AVAILABILITY = {
	// Total number of availability slots in seed data
	TOTAL: 17, // 9 teachers, teacher 10 has none, teacher 5 has 1 slot, others have 2

	// Per teacher (from seed.sql)
	TEACHER_ALICE: 2, // Mon 09:00-12:00, Wed 14:00-17:00
	TEACHER_BOB: 2, // Tue 10:00-13:00, Thu 14:00-17:00
	TEACHER_CHARLIE: 2, // Mon 14:00-17:00, Fri 09:00-12:00
	TEACHER_DIANA: 2, // Tue 14:00-17:00, Thu 09:00-12:00
	TEACHER_EVE: 1, // Mon 14:00-17:00 (Bandcoaching)
	TEACHER_FRANK: 2, // Wed 09:00-12:00, Fri 14:00-17:00
	TEACHER_GRACE: 2, // Mon 10:00-13:00, Thu 10:00-13:00
	TEACHER_HENRY: 2, // Tue 09:00-12:00, Fri 10:00-13:00
	TEACHER_IRIS: 2, // Wed 10:00-13:00, Thu 14:00-17:00
} as const;

/**
 * Teacher lesson types counts
 */
export const TEACHER_LESSON_TYPES = {
	// Total number of teacher-lesson type links in seed data
	TOTAL: 12, // 9 teachers: 3+2+1+1+1+1+1+1+1, teacher 10 has none

	// Per teacher (from seed.sql)
	TEACHER_ALICE: 3, // Gitaar, Drums, Zang
	TEACHER_BOB: 2, // Bas, Keyboard
	TEACHER_CHARLIE: 1, // Saxofoon
	TEACHER_DIANA: 1, // DJ / Beats
	TEACHER_EVE: 1, // Bandcoaching
	TEACHER_FRANK: 1, // Gitaar
	TEACHER_GRACE: 1, // Drums
	TEACHER_HENRY: 1, // Zang
	TEACHER_IRIS: 1, // Bas
} as const;

/**
 * Teacher viewed by student counts
 */
export const TEACHER_VIEWED_BY_STUDENT = {
	// Per student (number of unique teachers they have agreements with)
	STUDENT_001: 1, // Only Teacher Eve (Bandcoaching)
	STUDENT_009: 2, // Teacher Alice (Gitaar) and Teacher Diana (DJ/Beats)
} as const;

/**
 * Students counts
 */
export const STUDENTS = {
	// Total number of students in seed data
	TOTAL: 60, // students 001-060
} as const;

/**
 * Teachers counts
 */
export const TEACHERS = {
	// Total number of teachers in seed data
	TOTAL: 10, // teachers 001-010 (Alice, Bob, Charlie, Diana, Eve, Frank, Grace, Henry, Iris, Jack)
	// All teachers are active by default (is_active DEFAULT true)
	ACTIVE: 10,
	INACTIVE: 0,
} as const;

/**
 * Users counts
 */
export const USERS = {
	// Total number of users in seed data
	TOTAL: 88, // 1 site_admin, 2 admins, 5 staff, 10 teachers, 60 students, 10 users without role
	// Per role (from seed.sql)
	SITE_ADMIN: 1,
	ADMIN: 2,
	STAFF: 5,
	// Users without app_role (teachers, students, and regular users)
	// 10 teachers + 60 students + 10 users without role = 80
	WITHOUT_ROLE: 80,
} as const;
