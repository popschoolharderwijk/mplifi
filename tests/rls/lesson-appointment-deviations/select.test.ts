import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const dbNoRLS = createClientBypassRLS();

// Setup: Use seed data
const agreementStudent009TeacherAlice = fixtures.requireAgreementId(TestUsers.STUDENT_009, TestUsers.TEACHER_ALICE);
const agreementStudent026TeacherBob = fixtures.requireAgreementId(TestUsers.STUDENT_026, TestUsers.TEACHER_BOB);

// Helper to calculate original_date from day_of_week and a reference date
function calculateOriginalDate(dayOfWeek: number, referenceDate: Date): Date {
	const date = new Date(referenceDate);
	const currentDay = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
	const diff = dayOfWeek - currentDay;
	date.setDate(date.getDate() + diff);
	return date;
}

// Helper to create a test deviation
async function createTestDeviation(
	lessonAgreementId: string,
	originalDate: Date,
	originalStartTime: string,
	actualDate: Date,
	actualStartTime: string,
	createdByUserId: string,
) {
	const { data, error } = await dbNoRLS
		.from('lesson_appointment_deviations')
		.insert({
			lesson_agreement_id: lessonAgreementId,
			original_date: originalDate.toISOString().split('T')[0],
			original_start_time: originalStartTime,
			actual_date: actualDate.toISOString().split('T')[0],
			actual_start_time: actualStartTime,
			created_by_user_id: createdByUserId,
			last_updated_by_user_id: createdByUserId,
		})
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to create test deviation: ${error.message}`);
	}

	return data;
}

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

		// Create test deviations
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const bobUserId = fixtures.requireUserId(TestUsers.TEACHER_BOB);

		// Get agreement details to calculate original_date
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		const agreementBob = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent026TeacherBob);

		if (!agreementAlice || !agreementBob) {
			throw new Error('Agreements not found');
		}

		const referenceDate = new Date('2024-02-13'); // Week of Feb 13
		const originalDateAlice = calculateOriginalDate(agreementAlice.day_of_week, referenceDate);
		const originalDateBob = calculateOriginalDate(agreementBob.day_of_week, referenceDate);

		deviationAlice = await createTestDeviation(
			agreementStudent009TeacherAlice,
			originalDateAlice,
			agreementAlice.start_time,
			new Date('2024-02-15'), // Thursday
			'14:00',
			aliceUserId,
		);

		deviationBob = await createTestDeviation(
			agreementStudent026TeacherBob,
			originalDateBob,
			agreementBob.start_time,
			new Date('2024-02-16'), // Friday
			'15:00',
			bobUserId,
		);
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
