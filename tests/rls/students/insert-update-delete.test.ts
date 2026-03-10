import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import type { StudentInsert } from '../../types';
import { expectError, unwrap, unwrapError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

const dbNoRLS = createClientBypassRLS();

// User IDs from fixtures for insert tests
const studentBUserId = fixtures.requireUserId(TestUsers.STUDENT_002);
const studentCUserId = fixtures.requireUserId(TestUsers.STUDENT_003);
// USER_003 for RPC tests - isolated from automatic-management (USER_002) and user-without-role (USER_010)
const rpcTestUserId = fixtures.requireUserId(TestUsers.USER_003);

// Fixed student ID for UPDATE/DELETE block tests (must exist in seed)
const testStudentUserId = fixtures.requireStudentId(TestUsers.STUDENT_001);

/**
 * Students INSERT/UPDATE/DELETE permissions:
 *
 * INSERT/DELETE:
 * - NO ONE can insert or delete students (blocked for all roles)
 * - Students are automatically created/deleted via triggers on lesson_agreements
 *
 * UPDATE:
 * - ADMINS and SITE_ADMINS can update students (for future fields)
 * - All other roles cannot update students
 *
 * Note: Teachers are identified by the teachers table, not by a role.
 */
describe('RLS: students INSERT - blocked for all roles', () => {
	const newStudent: StudentInsert = { user_id: studentBUserId };

	it('user without role cannot insert student', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('students').insert(newStudent).select();

		// Should fail - no INSERT policy (students are managed automatically)
		expectError(data, error);
	});

	it('teacher cannot insert student', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('students').insert(newStudent).select();

		expectError(data, error);
	});

	it('staff cannot insert student', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('students').insert(newStudent).select();

		expectError(data, error);
	});

	it('admin cannot insert student', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// STUDENT_C should not be a student in seed data (or if it is, the insert should still fail)
		const newStudent: StudentInsert = { user_id: studentCUserId };
		const { data, error } = await db.from('students').insert(newStudent).select();

		// Should fail - no INSERT policy (students are managed automatically)
		expectError(data, error);
	});

	it('site_admin cannot insert student', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// STUDENT_C should not be a student in seed data (or if it is, the insert should still fail)
		const newStudent: StudentInsert = { user_id: studentCUserId };
		const { data, error } = await db.from('students').insert(newStudent).select();

		// Should fail - no INSERT policy (students are managed automatically)
		expectError(data, error);
	});
});

describe('RLS: students UPDATE - blocked for non-admin roles', () => {
	it('user without role cannot update student', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db
			.from('students')
			.update({ updated_at: new Date().toISOString() })
			.eq('user_id', testStudentUserId)
			.select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot update student', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('students')
			.update({ updated_at: new Date().toISOString() })
			.eq('user_id', testStudentUserId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot update student', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data: students } = await db.from('students').select('user_id').limit(1);
		if (!students || students.length === 0) {
			throw new Error('No students found for test');
		}

		const { data, error } = await db
			.from('students')
			.update({ updated_at: new Date().toISOString() })
			.eq('user_id', students[0].user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: students UPDATE - admin permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('admin can update student', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data: students } = await db.from('students').select('*').limit(1);
		if (!students || students.length === 0) {
			throw new Error('No students found for test');
		}

		const originalStudent = students[0];

		const { data, error } = await db
			.from('students')
			.update({ updated_at: new Date().toISOString() })
			.eq('user_id', originalStudent.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(originalStudent.user_id);
	});

	it('site_admin can update student', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: students } = await db.from('students').select('*').limit(1);
		if (!students || students.length === 0) {
			throw new Error('No students found for test');
		}

		const originalStudent = students[0];

		const { data, error } = await db
			.from('students')
			.update({ updated_at: new Date().toISOString() })
			.eq('user_id', originalStudent.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(originalStudent.user_id);
	});
});

describe('RLS: students DELETE - blocked for all roles', () => {
	it('user without role cannot delete student', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('students').delete().eq('user_id', testStudentUserId).select();

		// RLS blocks - 0 rows affected (no DELETE policy)
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete student', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('students').delete().eq('user_id', testStudentUserId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete student', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data: students } = await db.from('students').select('user_id').limit(1);
		if (!students || students.length === 0) {
			throw new Error('No students found for test');
		}

		const { data, error } = await db.from('students').delete().eq('user_id', students[0].user_id).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('admin cannot delete student', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('students').delete().eq('user_id', testStudentUserId).select();

		// RLS blocks - 0 rows affected (no DELETE policy)
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('site_admin cannot delete student', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('students').delete().eq('user_id', testStudentUserId).select();

		// RLS blocks - 0 rows affected (no DELETE policy)
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: students INSERT/DELETE via RPC - privileged user allowed', () => {
	it('staff can create student for another user via ensure_student_exists', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);

		const { data: studentsBefore } = await dbNoRLS.from('students').select('user_id').eq('user_id', rpcTestUserId);
		expect(studentsBefore).toHaveLength(0);

		unwrap(await staffDb.rpc('ensure_student_exists', { _user_id: rpcTestUserId }));

		const { data: studentsAfter } = await dbNoRLS.from('students').select('user_id').eq('user_id', rpcTestUserId);
		expect(studentsAfter).toHaveLength(1);

		await dbNoRLS.from('students').delete().eq('user_id', rpcTestUserId);
	});

	it("staff can delete another user's student via cleanup_student_if_no_agreements when student has no agreements", async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);

		unwrap(await staffDb.rpc('ensure_student_exists', { _user_id: rpcTestUserId }));
		const { data: afterEnsure } = await dbNoRLS.from('students').select('user_id').eq('user_id', rpcTestUserId);
		expect(afterEnsure).toHaveLength(1);

		unwrap(await staffDb.rpc('cleanup_student_if_no_agreements', { _user_id: rpcTestUserId }));

		const { data: afterCleanup } = await dbNoRLS.from('students').select('user_id').eq('user_id', rpcTestUserId);
		expect(afterCleanup).toHaveLength(0);
	});
});

describe('RLS: students INSERT/DELETE via RPC - trigger-only, unprivileged user denied', () => {
	it('unprivileged user (student) cannot create student for another user via ensure_student_exists', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data: studentsBefore } = await dbNoRLS.from('students').select('user_id').eq('user_id', rpcTestUserId);
		expect(studentsBefore).toHaveLength(0);

		const ensureResult = await db.rpc('ensure_student_exists', { _user_id: rpcTestUserId });

		await dbNoRLS.from('students').delete().eq('user_id', rpcTestUserId);

		const error = unwrapError(ensureResult);
		expect(error.message).toContain('Permission denied');
	});

	it("unprivileged user (student) cannot delete another user's student via cleanup_student_if_no_agreements", async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const studentDb = await createClientAs(TestUsers.STUDENT_001);

		const { error: ensureError } = await staffDb.rpc('ensure_student_exists', { _user_id: rpcTestUserId });
		expect(ensureError).toBeNull();

		const { data: afterEnsure } = await dbNoRLS.from('students').select('user_id').eq('user_id', rpcTestUserId);
		expect(afterEnsure).toHaveLength(1);

		const cleanupResult = await studentDb.rpc('cleanup_student_if_no_agreements', { _user_id: rpcTestUserId });

		await dbNoRLS.from('students').delete().eq('user_id', rpcTestUserId);

		const error = unwrapError(cleanupResult);
		expect(error.message).toContain('Permission denied');
	});
});
