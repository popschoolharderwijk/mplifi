import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { LESSON_AGREEMENTS, PAGINATION, STUDENTS } from '../seed-data-constants';
import { TestUsers } from '../test-users';

interface PaginatedStudentsResponse {
	data: Array<{
		id: string;
		user_id: string;
		profile: {
			email: string;
			first_name: string | null;
			last_name: string | null;
		};
		agreements: Array<{
			id: string;
			teacher: {
				first_name: string | null;
			};
		}>;
	}>;
	total_count: number;
	limit: number;
	offset: number;
}

/**
 * RLS tests for get_students_paginated function
 *
 * This function uses SECURITY DEFINER but must respect the same RLS rules as
 * the students table. It should return only the students that the calling user
 * is allowed to see according to RLS policies.
 *
 * Expected behavior:
 * - STUDENTS: Can see only their own record
 * - TEACHERS: Automatically see only their own students (teacher_user_id is determined from logged-in user, cannot be spoofed)
 * - STAFF/ADMIN/SITE_ADMIN: Can see all students
 */
describe('RLS: get_students_paginated', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('site_admin sees all students', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.rpc('get_students_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedStudentsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(STUDENTS.TOTAL);
		expect(result.data.length).toBe(STUDENTS.TOTAL);
	});

	it('admin sees all students', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.rpc('get_students_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedStudentsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(STUDENTS.TOTAL);
	});

	it('staff sees all students', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.rpc('get_students_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedStudentsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(STUDENTS.TOTAL);
	});

	it('student can see only their own record', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const student001UserId = fixtures.requireUserId(TestUsers.STUDENT_001);

		const { data, error } = await db.rpc('get_students_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedStudentsResponse;
		expect(result.data).toBeInstanceOf(Array);
		// Students can see only their own record via RLS
		expect(result.total_count).toBe(1);
		expect(result.data.length).toBe(1);
		expect(result.data[0]?.user_id).toBe(student001UserId);
	});

	it('teacher can see their own students (automatically determined from logged-in user)', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.rpc('get_students_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedStudentsResponse;
		expect(result.data).toBeInstanceOf(Array);
		// Teachers automatically see their own students (teacher_user_id is determined from logged-in user)
		// Teacher Alice has LESSON_AGREEMENTS.TEACHER_ALICE students in seed
		expect(result.total_count).toBe(LESSON_AGREEMENTS.TEACHER_ALICE);
		expect(result.data).toHaveLength(LESSON_AGREEMENTS.TEACHER_ALICE);
		// All returned students should have agreements with Teacher Alice
		result.data.forEach((student) => {
			const hasAgreementWithAlice = student.agreements?.some(
				(agreement) => agreement.teacher?.first_name === 'Alice',
			);
			expect(hasAgreementWithAlice).toBe(true);
		});
	});

	it('teacher cannot see other teachers students (security: teacher_user_id is automatically determined)', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.rpc('get_students_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedStudentsResponse;
		expect(result.data).toBeInstanceOf(Array);
		// Teacher Alice should only see her own students, not Teacher Bob's students
		// Security: teacher_user_id is automatically determined from logged-in user, cannot be spoofed
		result.data.forEach((student) => {
			const hasAgreementWithAlice = student.agreements?.some(
				(agreement) => agreement.teacher?.first_name === 'Alice',
			);
			// All students returned must have at least one agreement with Teacher Alice
			expect(hasAgreementWithAlice).toBe(true);
		});
	});

	it('teacher without students sees empty list', async () => {
		const db = await createClientAs(TestUsers.TEACHER_JACK);

		const { data, error } = await db.rpc('get_students_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedStudentsResponse;
		expect(result.data).toBeInstanceOf(Array);
		// Teacher Jack has no students in seed data
		expect(result.total_count).toBe(0);
		expect(result.data.length).toBe(0);
	});

	it('user without role cannot see any students', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.rpc('get_students_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedStudentsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(0);
		expect(result.data.length).toBe(0);
	});

	it('pagination works correctly', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Get first page
		const { data: page1Data, error: error1 } = await db.rpc('get_students_paginated', {
			p_limit: PAGINATION.PAGE_SIZE,
			p_offset: 0,
		});

		expect(error1).toBeNull();
		const page1 = page1Data as unknown as PaginatedStudentsResponse;
		expect(page1.data).toHaveLength(PAGINATION.PAGE_SIZE);
		expect(page1.limit).toBe(PAGINATION.PAGE_SIZE);
		expect(page1.offset).toBe(0);
		expect(page1.total_count).toBe(STUDENTS.TOTAL);

		// Get second page
		const { data: page2Data, error: error2 } = await db.rpc('get_students_paginated', {
			p_limit: PAGINATION.PAGE_SIZE,
			p_offset: PAGINATION.PAGE_SIZE,
		});

		expect(error2).toBeNull();
		const page2 = page2Data as unknown as PaginatedStudentsResponse;
		expect(page2.data).toHaveLength(PAGINATION.PAGE_SIZE);
		expect(page2.limit).toBe(PAGINATION.PAGE_SIZE);
		expect(page2.offset).toBe(PAGINATION.PAGE_SIZE);
		expect(page2.total_count).toBe(STUDENTS.TOTAL);

		// Total count should be the same
		expect(page1.total_count).toBe(page2.total_count);

		// No overlap between pages
		const page1Ids = new Set(page1.data.map((s) => s.id));
		const page2Ids = new Set(page2.data.map((s) => s.id));
		const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
		expect(intersection.length).toBe(0);
	});

	it('search filter works', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Search "student-001" - unique match in seed
		const { data: searchDataRaw, error } = await db.rpc('get_students_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_search: 'student-001',
		});

		expect(error).toBeNull();
		const searchData = searchDataRaw as unknown as PaginatedStudentsResponse;
		expect(searchData.total_count).toBe(1);
		expect(searchData.data).toHaveLength(1);
		expect(searchData.data[0]?.profile.email).toBe(TestUsers.STUDENT_001);
	});

	it('staff/admin can see all students (no teacher filter applied)', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.rpc('get_students_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedStudentsResponse;
		// Staff/admin see all students (no teacher filter)
		expect(result.total_count).toBe(STUDENTS.TOTAL);
		expect(result.data.length).toBe(STUDENTS.TOTAL);
	});
});
