import { describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { StudentInsert } from '../types';

const dbNoRLS = createClientBypassRLS();

// User IDs from fixtures for insert tests
const studentBUserId = fixtures.requireUserId(TestUsers.STUDENT_B);
const studentCUserId = fixtures.requireUserId(TestUsers.STUDENT_C);

// Existing student ID for UPDATE/DELETE block tests
const testStudentId = fixtures.allStudents[0].id;

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
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db.from('students').insert(newStudent).select();

		// Should fail - no INSERT policy (students are managed automatically)
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher cannot insert student', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('students').insert(newStudent).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('staff cannot insert student', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('students').insert(newStudent).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('admin cannot insert student', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Ensure clean state
		await dbNoRLS.from('students').delete().eq('user_id', studentCUserId);

		const newStudent: StudentInsert = { user_id: studentCUserId };
		const { data, error } = await db.from('students').insert(newStudent).select();

		// Should fail - no INSERT policy (students are managed automatically)
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('site_admin cannot insert student', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Ensure clean state
		await dbNoRLS.from('students').delete().eq('user_id', studentCUserId);

		const newStudent: StudentInsert = { user_id: studentCUserId };
		const { data, error } = await db.from('students').insert(newStudent).select();

		// Should fail - no INSERT policy (students are managed automatically)
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: students UPDATE - blocked for non-admin roles', () => {
	it('user without role cannot update student', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db
			.from('students')
			.update({ updated_at: new Date().toISOString() })
			.eq('id', testStudentId)
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
			.eq('id', testStudentId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot update student', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data: students } = await db.from('students').select('id').limit(1);
		if (!students || students.length === 0) {
			throw new Error('No students found for test');
		}

		const { data, error } = await db
			.from('students')
			.update({ updated_at: new Date().toISOString() })
			.eq('id', students[0].id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: students UPDATE - admin permissions', () => {
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
			.eq('id', originalStudent.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(originalStudent.id);
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
			.eq('id', originalStudent.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(originalStudent.id);
	});
});

describe('RLS: students DELETE - blocked for all roles', () => {
	it('user without role cannot delete student', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db.from('students').delete().eq('id', testStudentId).select();

		// RLS blocks - 0 rows affected (no DELETE policy)
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete student', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('students').delete().eq('id', testStudentId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete student', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data: students } = await db.from('students').select('id').limit(1);
		if (!students || students.length === 0) {
			throw new Error('No students found for test');
		}

		const { data, error } = await db.from('students').delete().eq('id', students[0].id).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('admin cannot delete student', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('students').delete().eq('id', testStudentId).select();

		// RLS blocks - 0 rows affected (no DELETE policy)
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('site_admin cannot delete student', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('students').delete().eq('id', testStudentId).select();

		// RLS blocks - 0 rows affected (no DELETE policy)
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
