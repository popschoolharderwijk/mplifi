import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const agreementStudentATeacherAlice = fixtures.requireAgreementId(TestUsers.STUDENT_A, TestUsers.TEACHER_ALICE);
const agreementStudentBTeacherAlice = fixtures.requireAgreementId(TestUsers.STUDENT_B, TestUsers.TEACHER_ALICE);
const agreementStudentATeacherBob = fixtures.requireAgreementId(TestUsers.STUDENT_A, TestUsers.TEACHER_BOB);

/**
 * Lesson agreements SELECT permissions:
 *
 * STUDENTS:
 * - Can only view their own lesson agreements (where student_user_id matches their user_id)
 *
 * TEACHERS:
 * - Can only view lesson agreements where they are the teacher (where teacher_id matches their teacher record)
 *
 * STAFF/ADMIN/SITE_ADMIN:
 * - Can view all lesson agreements
 */
describe('RLS: lesson_agreements SELECT', () => {
	it('student sees only their own agreements', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Student A should see 2 agreements (one with Teacher Alice, one with Teacher Bob)
		expect(data).toHaveLength(2);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudentATeacherAlice);
		expect(agreementIds).toContain(agreementStudentATeacherBob);
		// Should NOT see agreement for Student B
		expect(agreementIds).not.toContain(agreementStudentBTeacherAlice);
	});

	it('student cannot see other students agreements', async () => {
		const db = await createClientAs(TestUsers.STUDENT_B);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Student B should see only 1 agreement (with Teacher Alice)
		expect(data).toHaveLength(1);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudentBTeacherAlice);
		// Should NOT see agreements for Student A
		expect(agreementIds).not.toContain(agreementStudentATeacherAlice);
		expect(agreementIds).not.toContain(agreementStudentATeacherBob);
	});

	it('teacher sees only agreements where they are the teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Teacher Alice should see 2 agreements (one with Student A, one with Student B)
		expect(data).toHaveLength(2);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudentATeacherAlice);
		expect(agreementIds).toContain(agreementStudentBTeacherAlice);
		// Should NOT see agreement where Teacher Bob is the teacher
		expect(agreementIds).not.toContain(agreementStudentATeacherBob);
	});

	it('teacher cannot see agreements where they are not the teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_BOB);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Teacher Bob should see only 1 agreement (with Student A)
		expect(data).toHaveLength(1);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudentATeacherBob);
		// Should NOT see agreements where Teacher Alice is the teacher
		expect(agreementIds).not.toContain(agreementStudentATeacherAlice);
		expect(agreementIds).not.toContain(agreementStudentBTeacherAlice);
	});

	it('staff sees all agreements', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Staff should see all agreements (at least 3)
		expect(data?.length).toBeGreaterThanOrEqual(3);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudentATeacherAlice);
		expect(agreementIds).toContain(agreementStudentBTeacherAlice);
		expect(agreementIds).toContain(agreementStudentATeacherBob);
	});

	it('admin sees all agreements', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Admin should see all agreements (at least 3)
		expect(data?.length).toBeGreaterThanOrEqual(3);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudentATeacherAlice);
		expect(agreementIds).toContain(agreementStudentBTeacherAlice);
		expect(agreementIds).toContain(agreementStudentATeacherBob);
	});

	it('site_admin sees all agreements', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Site admin should see all agreements (at least 3)
		expect(data?.length).toBeGreaterThanOrEqual(3);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudentATeacherAlice);
		expect(agreementIds).toContain(agreementStudentBTeacherAlice);
		expect(agreementIds).toContain(agreementStudentATeacherBob);
	});
});
