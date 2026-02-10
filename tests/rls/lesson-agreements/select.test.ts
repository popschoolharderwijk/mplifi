import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

// Student 009 has agreement with Teacher Alice
// Student 010 has agreement with Teacher Alice
// Student 026 has agreement with Teacher Bob
const agreementStudent009TeacherAlice = fixtures.requireAgreementId(TestUsers.STUDENT_009, TestUsers.TEACHER_ALICE);
const agreementStudent010TeacherAlice = fixtures.requireAgreementId(TestUsers.STUDENT_010, TestUsers.TEACHER_ALICE);
const agreementStudent026TeacherBob = fixtures.requireAgreementId(TestUsers.STUDENT_026, TestUsers.TEACHER_BOB);

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
		const db = await createClientAs(TestUsers.STUDENT_009);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Student 009 should see their own agreements (with Teacher Alice and/or Teacher Diana)
		expect(data?.length).toBeGreaterThanOrEqual(1);
		const agreementIds = data?.map((a) => a.id) ?? [];
		// Should NOT see agreement for Student 010
		expect(agreementIds).not.toContain(agreementStudent010TeacherAlice);
	});

	it('student cannot see other students agreements', async () => {
		const db = await createClientAs(TestUsers.STUDENT_010);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Student 010 should see their own agreements
		expect(data?.length).toBeGreaterThanOrEqual(1);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		// Should NOT see agreements for Student 009
		expect(agreementIds).not.toContain(agreementStudent009TeacherAlice);
	});

	it('teacher sees only agreements where they are the teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Teacher Alice should see multiple agreements (with various students)
		expect(data?.length).toBeGreaterThanOrEqual(2);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		// Should NOT see agreement where Teacher Bob is the teacher
		expect(agreementIds).not.toContain(agreementStudent026TeacherBob);
	});

	it('teacher cannot see agreements where they are not the teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_BOB);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Teacher Bob should see multiple agreements (with various students)
		expect(data?.length).toBeGreaterThanOrEqual(1);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent026TeacherBob);
		// Should NOT see agreements where Teacher Alice is the teacher
		expect(agreementIds).not.toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).not.toContain(agreementStudent010TeacherAlice);
	});

	it('staff sees all agreements', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Staff should see all agreements (at least 125 total)
		expect(data?.length).toBeGreaterThanOrEqual(3);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		expect(agreementIds).toContain(agreementStudent026TeacherBob);
	});

	it('admin sees all agreements', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Admin should see all agreements (at least 125 total)
		expect(data?.length).toBeGreaterThanOrEqual(3);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		expect(agreementIds).toContain(agreementStudent026TeacherBob);
	});

	it('site_admin sees all agreements', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('lesson_agreements').select('*');

		expect(error).toBeNull();
		// Site admin should see all agreements (at least 125 total)
		expect(data?.length).toBeGreaterThanOrEqual(3);
		const agreementIds = data?.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		expect(agreementIds).toContain(agreementStudent026TeacherBob);
	});
});
