import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

/**
 * Students SELECT permissions:
 *
 * STUDENTS:
 * - Can view their own student record only
 *
 * STAFF/ADMIN/SITE_ADMIN:
 * - Can view all student records
 *
 * OTHER USERS (teachers, users without role):
 * - Cannot view any student records
 */
describe('RLS: students SELECT', () => {
	it('site_admin sees all students', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('students').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allStudents.length);
	});

	it('admin sees all students', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('students').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allStudents.length);
	});

	it('staff sees all students', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('students').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allStudents.length);
	});

	it('student can see only their own record', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const studentAUserId = fixtures.requireUserId(TestUsers.STUDENT_001);

		const { data, error } = await db.from('students').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(studentAUserId);
	});

	it('student cannot see other students', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const studentBId = fixtures.requireStudentId(TestUsers.STUDENT_002);

		const { data, error } = await db.from('students').select('*').eq('id', studentBId);

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot see any students', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('students').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('user without role cannot see any students', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.from('students').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
