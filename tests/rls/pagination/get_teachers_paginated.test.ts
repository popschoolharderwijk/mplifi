import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TEACHER_VIEWED_BY_STUDENT, TEACHERS } from '../seed-data-constants';
import { TestUsers } from '../test-users';

interface PaginatedTeachersResponse {
	data: Array<{
		id: string;
		user_id: string;
		is_active: boolean;
		profile: {
			email: string;
			first_name: string | null;
			last_name: string | null;
		};
	}>;
	total_count: number;
	limit: number;
	offset: number;
}

/**
 * RLS tests for get_teachers_paginated function
 *
 * This function uses SECURITY DEFINER but must respect the same RLS rules as
 * the teachers table. It should return only the teachers that the calling user
 * is allowed to see according to RLS policies.
 *
 * Expected behavior:
 * - TEACHERS: Can see only their own teacher record
 * - STAFF/ADMIN/SITE_ADMIN: Can see all teachers (including profile.email)
 * - STUDENTS: Can see only teachers they have a lesson_agreement with (all profile fields)
 * - OTHER USERS: Cannot see any teachers
 */
describe('RLS: get_teachers_paginated', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('site_admin sees all teachers', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.rpc('get_teachers_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedTeachersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(TEACHERS.TOTAL);
		expect(result.data.length).toBe(TEACHERS.TOTAL);
	});

	it('admin sees all teachers', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.rpc('get_teachers_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedTeachersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(TEACHERS.TOTAL);
	});

	it('staff sees all teachers', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.rpc('get_teachers_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedTeachersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(TEACHERS.TOTAL);
	});

	it('teacher can see only their own record', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.rpc('get_teachers_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedTeachersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(1);
		expect(result.data.length).toBe(1);
		expect(result.data[0]?.user_id).toBe(aliceUserId);
	});

	it('teacher cannot see other teachers', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const bobUserId = fixtures.requireUserId(TestUsers.TEACHER_BOB);

		const { data, error } = await db.rpc('get_teachers_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedTeachersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(1);
		// Should not contain Teacher Bob
		const bobInResults = result.data.some((t) => t.user_id === bobUserId);
		expect(bobInResults).toBe(false);
	});

	it('student sees only their own teachers (no others)', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.rpc('get_teachers_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedTeachersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(TEACHER_VIEWED_BY_STUDENT.STUDENT_001);
		expect(result.data.length).toBe(TEACHER_VIEWED_BY_STUDENT.STUDENT_001);
	});

	it('user without role cannot see any teachers', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.rpc('get_teachers_paginated', {
			p_limit: 100,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedTeachersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(0);
		expect(result.data.length).toBe(0);
	});

	it('pagination works correctly', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Get first page
		const { data: page1Data, error: error1 } = await db.rpc('get_teachers_paginated', {
			p_limit: 5,
			p_offset: 0,
		});

		expect(error1).toBeNull();
		const page1 = page1Data as unknown as PaginatedTeachersResponse;
		expect(page1.data.length).toBe(5);
		expect(page1.limit).toBe(5);
		expect(page1.offset).toBe(0);
		expect(page1.total_count).toBe(TEACHERS.TOTAL);

		// Get second page
		const { data: page2Data, error: error2 } = await db.rpc('get_teachers_paginated', {
			p_limit: 5,
			p_offset: 5,
		});

		expect(error2).toBeNull();
		const page2 = page2Data as unknown as PaginatedTeachersResponse;
		expect(page2.data.length).toBe(5);
		expect(page2.limit).toBe(5);
		expect(page2.offset).toBe(5);
		expect(page2.total_count).toBe(TEACHERS.TOTAL);

		// Total count should be the same
		expect(page1.total_count).toBe(page2.total_count);

		// No overlap between pages
		const page1Ids = new Set(page1.data.map((t) => t.id));
		const page2Ids = new Set(page2.data.map((t) => t.id));
		const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
		expect(intersection.length).toBe(0);
	});

	it('search filter works', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Search for teacher Alice - unique match in seed
		const { data: searchDataRaw, error } = await db.rpc('get_teachers_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_search: 'teacher-alice',
		});

		expect(error).toBeNull();
		const searchData = searchDataRaw as unknown as PaginatedTeachersResponse;
		expect(searchData.total_count).toBe(1);
		expect(searchData.data).toHaveLength(1);
		expect(searchData.data[0]?.profile.email).toBe(TestUsers.TEACHER_ALICE);
	});

	it('status filter works', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: activeDataRaw, error: activeError } = await db.rpc('get_teachers_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_status: 'active',
		});

		expect(activeError).toBeNull();
		const activeData = activeDataRaw as unknown as PaginatedTeachersResponse;
		expect(activeData.total_count).toBe(TEACHERS.ACTIVE);
		activeData.data.forEach((teacher) => {
			expect(teacher.is_active).toBe(true);
		});

		const { data: inactiveDataRaw, error: inactiveError } = await db.rpc('get_teachers_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_status: 'inactive',
		});

		expect(inactiveError).toBeNull();
		const inactiveData = inactiveDataRaw as unknown as PaginatedTeachersResponse;
		expect(inactiveData.total_count).toBe(TEACHERS.INACTIVE);
		inactiveData.data.forEach((teacher) => {
			expect(teacher.is_active).toBe(false);
		});
	});
});
