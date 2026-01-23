import { describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { requireUserId } = fixtures;

// Get all teacher_students links via service role for verification
const dbNoRLS = createClientBypassRLS();
const { data: allLinks } = await dbNoRLS.from('teacher_students').select('*');
const totalLinks = allLinks?.length ?? 0;

describe('RLS: teacher_students SELECT', () => {
	it('site_admin sees all teacher-student links', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('teacher_students').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(totalLinks);
	});

	it('admin sees all teacher-student links', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('teacher_students').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(totalLinks);
	});

	it('staff sees all teacher-student links', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('teacher_students').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(totalLinks);
	});

	it('teacher sees only their own student links', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_students').select('*');

		expect(error).toBeNull();
		// Teacher Alice has 2 students (A & B)
		expect(data).toHaveLength(2);

		// Verify the links belong to this teacher
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		for (const link of data ?? []) {
			expect(link.teacher_id).toBe(teacherId);
		}
	});

	it('teacher cannot see other teacher links', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const bobId = requireUserId(TestUsers.TEACHER_BOB);

		const { data, error } = await db.from('teacher_students').select('*').eq('teacher_id', bobId);

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('student cannot see any teacher-student links', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db.from('teacher_students').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('student cannot see link where they are the student', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const studentId = requireUserId(TestUsers.STUDENT_A);

		const { data, error } = await db.from('teacher_students').select('*').eq('student_id', studentId);

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
