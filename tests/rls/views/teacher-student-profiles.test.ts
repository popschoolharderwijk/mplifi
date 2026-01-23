import { describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { requireUserId } = fixtures;

// Get total students via service role for verification
const dbNoRLS = createClientBypassRLS();
const { data: allViewData } = await dbNoRLS.from('teacher_student_profiles').select('*');
const totalViewRows = allViewData?.length ?? 0;

/**
 * The teacher_student_profiles view uses security_invoker=on
 * This means RLS policies are evaluated in the context of the querying user
 */
describe('RLS: teacher_student_profiles VIEW (security_invoker)', () => {
	it('site_admin sees all student profiles via view', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('teacher_student_profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(totalViewRows);
	});

	it('admin sees all student profiles via view', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('teacher_student_profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(totalViewRows);
	});

	it('staff sees all student profiles via view', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('teacher_student_profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(totalViewRows);
	});

	it('teacher sees only their own students via view', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_student_profiles').select('*');

		expect(error).toBeNull();
		// Teacher Alice has 2 students (A & B)
		expect(data).toHaveLength(2);

		// Verify the teacher_id is correct
		const teacherId = requireUserId(TestUsers.TEACHER_ALICE);
		for (const row of data ?? []) {
			expect(row.teacher_id).toBe(teacherId);
		}

		// Verify we see the correct students
		const studentEmails = data?.map((r) => r.email).sort() ?? [];
		expect(studentEmails).toEqual([TestUsers.STUDENT_A, TestUsers.STUDENT_B]);
	});

	it('teacher cannot see other teacher students via view', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_student_profiles').select('*');

		expect(error).toBeNull();

		// Should NOT contain Teacher Bob's students
		const studentEmails = data?.map((r) => r.email) ?? [];
		expect(studentEmails).not.toContain(TestUsers.STUDENT_C);
		expect(studentEmails).not.toContain(TestUsers.STUDENT_D);
	});

	it('student sees nothing via view', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db.from('teacher_student_profiles').select('*');

		expect(error).toBeNull();
		// Students have no access to teacher_students table, so the view returns nothing
		expect(data).toHaveLength(0);
	});

	it('view returns correct columns', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_student_profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(2);

		// Verify columns from view definition
		const row = data?.[0];
		if (row) {
			expect(row).toHaveProperty('student_id');
			expect(row).toHaveProperty('display_name');
			expect(row).toHaveProperty('avatar_url');
			expect(row).toHaveProperty('email');
			expect(row).toHaveProperty('created_at');
			expect(row).toHaveProperty('teacher_id');
		}
	});
});
