import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { unwrap } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { LESSON_AGREEMENTS } from '../seed-data-constants';
import { type TestUser, TestUsers } from '../test-users';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

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
describe('RLS: lesson_agreements teacher/student logic', () => {
	it('student sees only their own agreements', async () => {
		const db = await createClientAs(TestUsers.STUDENT_009);

		const data = unwrap(await db.from('lesson_agreements').select('*'));

		expect(data.length).toBe(LESSON_AGREEMENTS.STUDENT_009);
		const agreementIds = data.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent009TeacherAlice);
		// Should NOT see agreement for Student 010
		expect(agreementIds).not.toContain(agreementStudent010TeacherAlice);
	});

	it('student cannot see other students agreements', async () => {
		const db = await createClientAs(TestUsers.STUDENT_010);

		const data = unwrap(await db.from('lesson_agreements').select('*'));

		expect(data.length).toBe(LESSON_AGREEMENTS.STUDENT_010);
		const agreementIds = data.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		// Should NOT see agreements for Student 009
		expect(agreementIds).not.toContain(agreementStudent009TeacherAlice);
	});

	it('teacher sees only agreements where they are the teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const data = unwrap(await db.from('lesson_agreements').select('*'));

		expect(data.length).toBe(LESSON_AGREEMENTS.TEACHER_ALICE);
		const agreementIds = data.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		// Should NOT see agreement where Teacher Bob is the teacher
		expect(agreementIds).not.toContain(agreementStudent026TeacherBob);
	});

	it('teacher cannot see agreements where they are not the teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_BOB);

		const data = unwrap(await db.from('lesson_agreements').select('*'));

		expect(data.length).toBe(LESSON_AGREEMENTS.TEACHER_BOB);
		const agreementIds = data.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent026TeacherBob);
		// Should NOT see agreements where Teacher Alice is the teacher
		expect(agreementIds).not.toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).not.toContain(agreementStudent010TeacherAlice);
	});
});

describe('RLS: lesson_agreements SELECT', () => {
	async function select(user: TestUser) {
		const db = await createClientAs(user);

		const data = unwrap(await db.from('lesson_agreements').select('*'));

		expect(data.length).toBe(LESSON_AGREEMENTS.TOTAL);
		const agreementIds = data.map((a) => a.id) ?? [];
		expect(agreementIds).toContain(agreementStudent009TeacherAlice);
		expect(agreementIds).toContain(agreementStudent010TeacherAlice);
		expect(agreementIds).toContain(agreementStudent026TeacherBob);
	}

	it('staff sees all agreements', async () => {
		await select(TestUsers.STAFF_ONE);
	});

	it('admin sees all agreements', async () => {
		await select(TestUsers.ADMIN_ONE);
	});

	it('site_admin sees all agreements', async () => {
		await select(TestUsers.SITE_ADMIN);
	});
});
