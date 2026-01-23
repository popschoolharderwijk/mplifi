import { describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from './db';
import { fixtures } from './fixtures';
import { TestUsers } from './test-users';

const { requireUserId } = fixtures;

describe('RLS: teacher_students DELETE', () => {
	it('teacher can delete their own student link', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		const studentId = requireUserId(TestUsers.STUDENT_A);

		// Delete the link
		const { data, error } = await db
			.from('teacher_students')
			.delete()
			.eq('teacher_id', teacherId)
			.eq('student_id', studentId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		// Restore the link using service role
		const dbNoRLS = createClientBypassRLS();
		await dbNoRLS.from('teacher_students').insert({ teacher_id: teacherId, student_id: studentId });
	});

	it('teacher cannot delete other teacher links', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const bobId = requireUserId(TestUsers.TEACHER_BOB);
		const studentCId = requireUserId(TestUsers.STUDENT_C);

		const { data, error } = await db
			.from('teacher_students')
			.delete()
			.eq('teacher_id', bobId)
			.eq('student_id', studentCId)
			.select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('student cannot delete teacher-student links', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		const studentId = requireUserId(TestUsers.STUDENT_A);

		const { data, error } = await db
			.from('teacher_students')
			.delete()
			.eq('teacher_id', teacherId)
			.eq('student_id', studentId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete teacher-student links', async () => {
		const db = await createClientAs(TestUsers.STAFF);
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		const studentId = requireUserId(TestUsers.STUDENT_B);

		const { data, error } = await db
			.from('teacher_students')
			.delete()
			.eq('teacher_id', teacherId)
			.eq('student_id', studentId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('admin cannot delete teacher-student links', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		const studentId = requireUserId(TestUsers.STUDENT_B);

		const { data, error } = await db
			.from('teacher_students')
			.delete()
			.eq('teacher_id', teacherId)
			.eq('student_id', studentId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('site_admin cannot delete teacher-student links', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const teacherId = requireUserId(TestUsers.TEACHER_BOB);
		const studentId = requireUserId(TestUsers.STUDENT_C);

		const { data, error } = await db
			.from('teacher_students')
			.delete()
			.eq('teacher_id', teacherId)
			.eq('student_id', studentId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
