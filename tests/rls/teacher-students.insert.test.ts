import { describe, expect, it } from 'bun:test';
import { createClientAs } from './db';
import { fixtures } from './fixtures';
import { TestUsers } from './test-users';

const { requireUserId } = fixtures;

describe('RLS: teacher_students INSERT', () => {
	// Teacher Alice (030) already teaches Student A (100) and Student B (101)
	// Teacher Bob (031) already teaches Student C (102) and Student D (103)
	// For INSERT tests, we need to use links that don't exist yet

	it('teacher can add a student to their list', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		// Student C is not linked to Teacher Alice yet
		const studentId = requireUserId(TestUsers.STUDENT_C);

		const { data, error } = await db
			.from('teacher_students')
			.insert({ teacher_id: teacherId, student_id: studentId })
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.teacher_id).toBe(teacherId);
		expect(data?.[0]?.student_id).toBe(studentId);

		// Cleanup - remove the link we just created
		await db.from('teacher_students').delete().eq('teacher_id', teacherId).eq('student_id', studentId);
	});

	it('teacher cannot add students to another teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const bobId = requireUserId(TestUsers.TEACHER_BOB);
		const studentId = requireUserId(TestUsers.STUDENT_A);

		const { data, error } = await db
			.from('teacher_students')
			.insert({ teacher_id: bobId, student_id: studentId })
			.select();

		// RLS blocks - policy requires teacher_id = auth.uid()
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher cannot add non-student user as student', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		// Try to add another teacher as a "student"
		const bobId = requireUserId(TestUsers.TEACHER_BOB);

		const { data, error } = await db
			.from('teacher_students')
			.insert({ teacher_id: teacherId, student_id: bobId })
			.select();

		// RLS blocks - policy requires is_student(student_id)
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher cannot add admin as student', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		const adminId = requireUserId(TestUsers.ADMIN_ONE);

		const { data, error } = await db
			.from('teacher_students')
			.insert({ teacher_id: teacherId, student_id: adminId })
			.select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('student cannot insert teacher-student links', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const teacherId = requireUserId(TestUsers.TEACHER_BOB);
		const studentId = requireUserId(TestUsers.STUDENT_A);

		const { data, error } = await db
			.from('teacher_students')
			.insert({ teacher_id: teacherId, student_id: studentId })
			.select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('staff cannot insert teacher-student links', async () => {
		const db = await createClientAs(TestUsers.STAFF);
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		const studentId = requireUserId(TestUsers.STUDENT_D);

		const { data, error } = await db
			.from('teacher_students')
			.insert({ teacher_id: teacherId, student_id: studentId })
			.select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('admin cannot insert teacher-student links', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		const studentId = requireUserId(TestUsers.STUDENT_D);

		const { data, error } = await db
			.from('teacher_students')
			.insert({ teacher_id: teacherId, student_id: studentId })
			.select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('site_admin cannot insert teacher-student links', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		const studentId = requireUserId(TestUsers.STUDENT_D);

		const { data, error } = await db
			.from('teacher_students')
			.insert({ teacher_id: teacherId, student_id: studentId })
			.select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});
