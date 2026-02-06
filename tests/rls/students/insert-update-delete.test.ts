import { afterAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { StudentInsert } from '../types';

const dbNoRLS = createClientBypassRLS();

// User IDs from fixtures for insert tests
const studentBUserId = fixtures.requireUserId(TestUsers.STUDENT_B);
const studentCUserId = fixtures.requireUserId(TestUsers.STUDENT_C);
const studentDUserId = fixtures.requireUserId(TestUsers.STUDENT_D);

// Restore students that may have been deleted during INSERT/DELETE tests
afterAll(async () => {
	for (const userId of [studentCUserId, studentDUserId]) {
		await dbNoRLS.from('students').upsert({ user_id: userId }, { onConflict: 'user_id' });
	}
});

// Existing student ID for UPDATE/DELETE block tests
const testStudentId = fixtures.allStudents[0].id;

/**
 * Students INSERT/UPDATE/DELETE permissions:
 *
 * ADMINS and SITE_ADMINS:
 * - Can insert students
 * - Can update students
 * - Can delete students
 *
 * All other roles (staff, user without role) cannot insert, update, or delete students.
 * Note: Teachers are identified by the teachers table, not by a role.
 */
describe('RLS: students INSERT - blocked for non-admin roles', () => {
	const newStudent: StudentInsert = { user_id: studentBUserId };

	it('user without role cannot insert student', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db.from('students').insert(newStudent).select();

		// Should fail - no INSERT policy for regular users
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
});

describe('RLS: students INSERT - admin permissions', () => {
	it('admin can insert student', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Ensure clean state
		await dbNoRLS.from('students').delete().eq('user_id', studentCUserId);

		const newStudent: StudentInsert = { user_id: studentCUserId };
		const { data, error } = await db.from('students').insert(newStudent).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(newStudent.user_id);

		// Cleanup
		if (data?.[0]?.id) {
			await db.from('students').delete().eq('id', data[0].id);
		}
	});

	it('site_admin can insert student', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Ensure clean state
		await dbNoRLS.from('students').delete().eq('user_id', studentCUserId);

		const newStudent: StudentInsert = { user_id: studentCUserId };
		const { data, error } = await db.from('students').insert(newStudent).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(newStudent.user_id);

		// Cleanup
		if (data?.[0]?.id) {
			await db.from('students').delete().eq('id', data[0].id);
		}
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

describe('RLS: students DELETE - blocked for non-admin roles', () => {
	it('user without role cannot delete student', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db.from('students').delete().eq('id', testStudentId).select();

		// RLS blocks - 0 rows affected
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
});

describe('RLS: students DELETE - admin permissions', () => {
	it('admin can delete student', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Ensure clean state, then insert a student to delete
		await dbNoRLS.from('students').delete().eq('user_id', studentDUserId);

		const newStudent: StudentInsert = { user_id: studentDUserId };
		const { data: inserted, error: insertError } = await db.from('students').insert(newStudent).select();
		expect(insertError).toBeNull();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert student');
		}

		const studentId = inserted[0].id;

		// Delete
		const { data, error } = await db.from('students').delete().eq('id', studentId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(studentId);
	});

	it('site_admin can delete student', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Ensure clean state, then insert a student to delete
		await dbNoRLS.from('students').delete().eq('user_id', studentDUserId);

		const newStudent: StudentInsert = { user_id: studentDUserId };
		const { data: inserted, error: insertError } = await db.from('students').insert(newStudent).select();
		expect(insertError).toBeNull();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert student');
		}

		const studentId = inserted[0].id;

		// Delete
		const { data, error } = await db.from('students').delete().eq('id', studentId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(studentId);
	});
});
