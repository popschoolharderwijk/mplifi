import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { LESSON_AGREEMENTS, PAGINATION } from '../seed-data-constants';
import { TestUsers } from '../test-users';

interface PaginatedAgreementsResponse {
	data: Array<{
		id: string;
		student_user_id: string;
		teacher_user_id: string;
	}>;
	total_count: number;
	limit: number;
	offset: number;
}

// Student 009 has agreement with Teacher Alice
// Student 010 has agreement with Teacher Alice
// Student 026 has agreement with Teacher Bob
const agreementStudent009TeacherAlice = fixtures.requireAgreementId(TestUsers.STUDENT_009, TestUsers.TEACHER_ALICE);
const agreementStudent010TeacherAlice = fixtures.requireAgreementId(TestUsers.STUDENT_010, TestUsers.TEACHER_ALICE);
const agreementStudent026TeacherBob = fixtures.requireAgreementId(TestUsers.STUDENT_026, TestUsers.TEACHER_BOB);

/**
 * RLS tests for get_lesson_agreements_paginated function
 *
 * This function uses SECURITY DEFINER but must respect the same RLS rules as
 * the lesson_agreements table. It should return only the agreements that the
 * calling user is allowed to see according to RLS policies.
 *
 * Expected behavior:
 * - STUDENTS: Can only see their own lesson agreements
 * - TEACHERS: Can only see lesson agreements where they are the teacher
 * - STAFF/ADMIN/SITE_ADMIN: Can see all lesson agreements
 */
describe('RLS: get_lesson_agreements_paginated', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('site_admin sees all agreements', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedAgreementsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(LESSON_AGREEMENTS.TOTAL);
		const agreementIds = result.data.map((a) => a.id);
		expect(agreementIds).toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		expect(agreementIds).toContain(agreementStudent026TeacherBob);
	});

	it('admin sees all agreements', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedAgreementsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(LESSON_AGREEMENTS.TOTAL);
	});

	it('staff sees all agreements', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedAgreementsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(LESSON_AGREEMENTS.TOTAL);
	});

	it('student sees only their own agreements', async () => {
		const db = await createClientAs(TestUsers.STUDENT_009);

		const { data, error } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedAgreementsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(LESSON_AGREEMENTS.STUDENT_009);
		const agreementIds = result.data.map((a) => a.id);
		expect(agreementIds).toContain(agreementStudent009TeacherAlice);
		// Should NOT see agreement for Student 010
		expect(agreementIds).not.toContain(agreementStudent010TeacherAlice);
	});

	it('student cannot see other students agreements', async () => {
		const db = await createClientAs(TestUsers.STUDENT_010);

		const { data, error } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedAgreementsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(LESSON_AGREEMENTS.STUDENT_010);
		const agreementIds = result.data.map((a) => a.id);
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		// Should NOT see agreements for Student 009
		expect(agreementIds).not.toContain(agreementStudent009TeacherAlice);
	});

	it('teacher sees only agreements where they are the teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedAgreementsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(LESSON_AGREEMENTS.TEACHER_ALICE);
		const agreementIds = result.data.map((a) => a.id);
		expect(agreementIds).toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		// Should NOT see agreement where Teacher Bob is the teacher
		expect(agreementIds).not.toContain(agreementStudent026TeacherBob);
	});

	it('teacher cannot see agreements where they are not the teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_BOB);

		const { data, error } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedAgreementsResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(LESSON_AGREEMENTS.TEACHER_BOB);
		const agreementIds = result.data.map((a) => a.id);
		expect(agreementIds).toContain(agreementStudent026TeacherBob);
		// Should NOT see agreements where Teacher Alice is the teacher
		expect(agreementIds).not.toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).not.toContain(agreementStudent010TeacherAlice);
	});

	it('pagination works correctly', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Get first page
		const { data: page1Data, error: error1 } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: PAGINATION.PAGE_SIZE,
			p_offset: 0,
		});

		expect(error1).toBeNull();
		const page1 = page1Data as unknown as PaginatedAgreementsResponse;
		expect(page1.data).toHaveLength(PAGINATION.PAGE_SIZE);
		expect(page1.limit).toBe(PAGINATION.PAGE_SIZE);
		expect(page1.offset).toBe(0);

		// Get second page
		const { data: page2Data, error: error2 } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: PAGINATION.PAGE_SIZE,
			p_offset: PAGINATION.PAGE_SIZE,
		});

		expect(error2).toBeNull();
		const page2 = page2Data as unknown as PaginatedAgreementsResponse;
		expect(page2.data).toHaveLength(PAGINATION.PAGE_SIZE);
		expect(page2.limit).toBe(PAGINATION.PAGE_SIZE);
		expect(page2.offset).toBe(PAGINATION.PAGE_SIZE);

		// Total count should be the same
		expect(page1.total_count).toBe(page2.total_count);

		// No overlap between pages
		const page1Ids = new Set(page1.data.map((a) => a.id));
		const page2Ids = new Set(page2.data.map((a) => a.id));
		const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
		expect(intersection.length).toBe(0);
	});

	it('teacher filter works', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const teacherAliceUserId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_teacher_user_id: teacherAliceUserId,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedAgreementsResponse;
		// All returned agreements should have Teacher Alice as teacher
		result.data.forEach((agreement) => {
			expect(agreement.teacher_user_id).toBe(teacherAliceUserId);
		});
	});

	it('student filter works', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const student009UserId = fixtures.requireUserId(TestUsers.STUDENT_009);

		const { data, error } = await db.rpc('get_lesson_agreements_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_student_user_id: student009UserId,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedAgreementsResponse;
		// All returned agreements should be for Student 009
		result.data.forEach((agreement) => {
			expect(agreement.student_user_id).toBe(student009UserId);
		});
	});
});
