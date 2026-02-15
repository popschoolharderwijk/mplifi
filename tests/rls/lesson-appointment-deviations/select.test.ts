import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { buildDeviationData } from './utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const dbNoRLS = createClientBypassRLS();

// Setup: Use seed data
const agreementStudent009TeacherAlice = fixtures.requireAgreementId(TestUsers.STUDENT_009, TestUsers.TEACHER_ALICE);
const agreementStudent026TeacherBob = fixtures.requireAgreementId(TestUsers.STUDENT_026, TestUsers.TEACHER_BOB);

/**
 * Lesson Appointment Deviations SELECT permissions:
 *
 * TEACHERS:
 * - Can view deviations for their own lessons (via lesson_agreements.teacher_id)
 *
 * STUDENTS:
 * - Can view deviations for their own lessons (via lesson_agreements.student_user_id)
 *
 * STAFF/ADMIN/SITE_ADMIN:
 * - Can view all deviations
 *
 * OTHER USERS:
 * - Cannot view any deviations
 */
describe('RLS: lesson_appointment_deviations SELECT', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let deviationAlice: { id: string } | null = null;
	let deviationBob: { id: string } | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		// Get agreement details
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		const agreementBob = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent026TeacherBob);

		if (!agreementAlice || !agreementBob) {
			throw new Error('Agreements not found');
		}

		// Create test deviations using dynamic dates
		const { insertRow: insertAlice } = buildDeviationData({
			agreementId: agreementStudent009TeacherAlice,
			dayOfWeek: agreementAlice.day_of_week,
			startTime: agreementAlice.start_time,
			refDays: 7,
			actualStartTime: '14:00',
			recurring: false,
		});

		const { insertRow: insertBob } = buildDeviationData({
			agreementId: agreementStudent026TeacherBob,
			dayOfWeek: agreementBob.day_of_week,
			startTime: agreementBob.start_time,
			refDays: 14,
			actualStartTime: '15:00',
			recurring: false,
		});

		const bobUserId = fixtures.requireUserId(TestUsers.TEACHER_BOB);
		const insertBobWithUser = { ...insertBob, created_by_user_id: bobUserId, last_updated_by_user_id: bobUserId };

		const { data: dataAlice, error: errorAlice } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert(insertAlice)
			.select()
			.single();

		if (errorAlice) {
			throw new Error(`Failed to create test deviation for Alice: ${errorAlice.message}`);
		}
		deviationAlice = dataAlice;

		const { data: dataBob, error: errorBob } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert(insertBobWithUser)
			.select()
			.single();

		if (errorBob) {
			throw new Error(`Failed to create test deviation for Bob: ${errorBob.message}`);
		}
		deviationBob = dataBob;
	});

	afterAll(async () => {
		// Cleanup test deviations
		if (deviationAlice) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', deviationAlice.id);
		}
		if (deviationBob) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', deviationBob.id);
		}

		await verifyState(initialState);
	});

	it('site_admin sees all deviations', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('lesson_appointment_deviations').select('*');

		expect(error).toBeNull();
		expect(data?.length).toBeGreaterThanOrEqual(2);
		const deviationIds = data?.map((d) => d.id) ?? [];
		if (deviationAlice) expect(deviationIds).toContain(deviationAlice.id);
		if (deviationBob) expect(deviationIds).toContain(deviationBob.id);
	});

	it('admin sees all deviations', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('lesson_appointment_deviations').select('*');

		expect(error).toBeNull();
		expect(data?.length).toBeGreaterThanOrEqual(2);
		const deviationIds = data?.map((d) => d.id) ?? [];
		if (deviationAlice) expect(deviationIds).toContain(deviationAlice.id);
		if (deviationBob) expect(deviationIds).toContain(deviationBob.id);
	});

	it('staff sees all deviations', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('lesson_appointment_deviations').select('*');

		expect(error).toBeNull();
		expect(data?.length).toBeGreaterThanOrEqual(2);
		const deviationIds = data?.map((d) => d.id) ?? [];
		if (deviationAlice) expect(deviationIds).toContain(deviationAlice.id);
		if (deviationBob) expect(deviationIds).toContain(deviationBob.id);
	});

	it('teacher sees only deviations for their own lessons', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('lesson_appointment_deviations').select('*');

		expect(error).toBeNull();
		const deviationIds = data?.map((d) => d.id) ?? [];
		if (deviationAlice) expect(deviationIds).toContain(deviationAlice.id);
		if (deviationBob) expect(deviationIds).not.toContain(deviationBob.id);
	});

	it('teacher cannot see deviations for other teachers lessons', async () => {
		const db = await createClientAs(TestUsers.TEACHER_BOB);

		const { data, error } = await db.from('lesson_appointment_deviations').select('*');

		expect(error).toBeNull();
		const deviationIds = data?.map((d) => d.id) ?? [];
		if (deviationAlice) expect(deviationIds).not.toContain(deviationAlice.id);
		if (deviationBob) expect(deviationIds).toContain(deviationBob.id);
	});

	it('student sees only deviations for their own lessons', async () => {
		const db = await createClientAs(TestUsers.STUDENT_009);

		const { data, error } = await db.from('lesson_appointment_deviations').select('*');

		expect(error).toBeNull();
		const deviationIds = data?.map((d) => d.id) ?? [];
		if (deviationAlice) expect(deviationIds).toContain(deviationAlice.id);
		if (deviationBob) expect(deviationIds).not.toContain(deviationBob.id);
	});

	it('student cannot see deviations for other students lessons', async () => {
		const db = await createClientAs(TestUsers.STUDENT_026);

		const { data, error } = await db.from('lesson_appointment_deviations').select('*');

		expect(error).toBeNull();
		const deviationIds = data?.map((d) => d.id) ?? [];
		if (deviationAlice) expect(deviationIds).not.toContain(deviationAlice.id);
		if (deviationBob) expect(deviationIds).toContain(deviationBob.id);
	});

	it('user without role cannot see any deviations', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.from('lesson_appointment_deviations').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
