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
	// 8 (Bandcoaching) + 12 (Alice) + 12 (Bob) + 12 (Charlie) + 8 (Diana) + 12 (Frank) + 12 (Grace) + 12 (Henry) + 12 (Iris) = 100
	TOTAL: 100,

	// Per teacher (from seed.sql)
	TEACHER_ALICE: 12, // students 009-020 (Gitaar 6, Drums 6)
	TEACHER_BOB: 12, // students 021-032 (Bas 6, Keyboard 6)
	TEACHER_CHARLIE: 12, // students 033-044 (Saxofoon 12)
	TEACHER_DIANA: 8, // students 045-052 (DJ/Beats 8, 45 min lessons)
	TEACHER_EVE: 8, // students 001-008 (Bandcoaching group lesson)
	TEACHER_FRANK: 12, // students 053-060, 009-012 (Gitaar 12)
	TEACHER_GRACE: 12, // students 013-014, 021-030 (Drums 12)
	TEACHER_HENRY: 12, // students 031-042 (Zang 12)
	TEACHER_IRIS: 12, // students 043-054 (Bas 12)

	// Per student (from seed.sql)
	STUDENT_001: 1, // Bandcoaching with Teacher Eve
	STUDENT_009: 2, // Gitaar with Teacher Alice, Gitaar with Teacher Frank
	STUDENT_010: 2, // Gitaar with Teacher Alice, Gitaar with Teacher Frank
	STUDENT_026: 2, // Bas with Teacher Bob, Drums with Teacher Grace
} as const;

/**
 * Teacher availability counts
 */
export const TEACHER_AVAILABILITY = {
	// Total number of availability slots in seed data
	// Alice: 3, Bob: 3, Charlie: 3, Diana: 3, Eve: 2, Frank: 3, Grace: 3, Henry: 3, Iris: 3, Jack: 2 = 28
	TOTAL: 28,

	// Per teacher (from seed.sql) - Extended availability slots
	TEACHER_ALICE: 3, // Mon 08:00-18:00, Wed 10:00-20:00, Fri 09:00-13:00
	TEACHER_BOB: 3, // Tue 09:00-18:00, Thu 08:00-18:00, Sat 10:00-14:00
	TEACHER_CHARLIE: 3, // Mon 12:00-19:00, Wed 14:00-18:00, Fri 08:00-14:00
	TEACHER_DIANA: 3, // Tue 10:00-20:00, Thu 08:00-14:00, Sat 09:00-12:00
	TEACHER_EVE: 2, // Mon 09:00-17:00, Thu 14:00-18:00
	TEACHER_FRANK: 3, // Mon 14:00-17:00, Wed 08:00-14:00, Fri 12:00-19:00
	TEACHER_GRACE: 3, // Mon 08:00-15:00, Thu 09:00-15:00, Fri 10:00-14:00
	TEACHER_HENRY: 3, // Tue 08:00-14:00, Wed 15:00-19:00, Fri 09:00-15:00
	TEACHER_IRIS: 3, // Tue 14:00-17:00, Wed 09:00-15:00, Thu 12:00-19:00
	TEACHER_JACK: 2, // Tue 10:00-14:00, Thu 10:00-14:00 (no students but has availability)
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
