/**
 * RLS tests for lesson_appointment_deviations INSERT/UPDATE/DELETE permissions.
 *
 * TEACHERS: Can insert/update/delete deviations for their own lessons
 * ADMIN/SITE_ADMIN/STAFF: Can insert/update/delete deviations for any lesson
 * STUDENTS: Cannot insert/update/delete deviations (only SELECT)
 * OTHER USERS: Cannot insert/update/delete deviations
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { LessonAppointmentDeviationInsert } from '../types';
import {
	buildDeviationData,
	buildDeviationDataAsUser,
	dateDaysFromNow,
	getTestAgreement,
	getTestAgreementBob,
	originalDateForWeek,
} from './utils';

const dbNoRLS = createClientBypassRLS();
const { agreementId: aliceAgreementId, agreement: aliceAgreement } = getTestAgreement();
const { agreementId: bobAgreementId, agreement: bobAgreement } = getTestAgreementBob();

// =============================================================================
// INSERT TESTS
// =============================================================================

describe('RLS: lesson_appointment_deviations INSERT', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	const createdIds: string[] = [];

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		for (const id of createdIds) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', id);
		}
		await verifyState(initialState);
	});

	// Blocked roles
	it.each([
		['user without role', TestUsers.USER_001],
		['student', TestUsers.STUDENT_001],
	])('%s cannot insert deviation', async (_role, user) => {
		const db = await createClientAs(user);
		const { insertRow } = buildDeviationData({
			agreementId: aliceAgreementId,
			dayOfWeek: aliceAgreement.day_of_week,
			startTime: aliceAgreement.start_time,
			refDays: 7,
			actualStartTime: '14:00',
			recurring: false,
		});

		const { data, error } = await db.from('lesson_appointment_deviations').insert(insertRow).select();
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	// Teacher permissions
	it('teacher can insert deviation for their own lesson', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const { insertRow } = buildDeviationData({
			agreementId: aliceAgreementId,
			dayOfWeek: aliceAgreement.day_of_week,
			startTime: aliceAgreement.start_time,
			refDays: 14,
			actualStartTime: '14:00',
			recurring: false,
		});

		const { data, error } = await db.from('lesson_appointment_deviations').insert(insertRow).select();
		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.created_by_user_id).toBe(aliceUserId);
		if (data?.[0]?.id) createdIds.push(data[0].id);
	});

	it('teacher cannot insert deviation for other teachers lesson', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const { insertRow } = buildDeviationDataAsUser(
			{
				agreementId: bobAgreementId,
				dayOfWeek: bobAgreement.day_of_week,
				startTime: bobAgreement.start_time,
				refDays: 21,
				actualStartTime: '15:00',
				recurring: false,
			},
			aliceUserId,
		);

		const { data, error } = await db.from('lesson_appointment_deviations').insert(insertRow).select();
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	// Admin/staff permissions
	it.each([
		['admin', TestUsers.ADMIN_ONE],
		['site_admin', TestUsers.SITE_ADMIN],
	])('%s can insert deviation for any lesson', async (_role, user) => {
		const db = await createClientAs(user);
		const userId = fixtures.requireUserId(user);
		const { insertRow } = buildDeviationDataAsUser(
			{
				agreementId: aliceAgreementId,
				dayOfWeek: aliceAgreement.day_of_week,
				startTime: aliceAgreement.start_time,
				refDays: 28 + createdIds.length * 7,
				actualStartTime: '14:00',
				recurring: false,
			},
			userId,
		);

		const { data, error } = await db.from('lesson_appointment_deviations').insert(insertRow).select();
		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		if (data?.[0]?.id) createdIds.push(data[0].id);
	});
});

// =============================================================================
// UPDATE TESTS
// =============================================================================

describe('RLS: lesson_appointment_deviations UPDATE', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let testDeviationId: string | null = null;
	let originalDate: string;

	beforeAll(async () => {
		initialState = await setupState();
		const { insertRow, originalDate: origDate } = buildDeviationData({
			agreementId: aliceAgreementId,
			dayOfWeek: aliceAgreement.day_of_week,
			startTime: aliceAgreement.start_time,
			refDays: 49,
			actualStartTime: '14:00',
			recurring: false,
		});
		originalDate = origDate;

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		if (data) testDeviationId = data.id;
	});

	afterAll(async () => {
		if (testDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', testDeviationId);
		}
		await verifyState(initialState);
	});

	it('teacher can update deviation for their own lesson', async () => {
		if (!testDeviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const newActualDate = new Date(originalDate + 'T12:00:00');
		newActualDate.setDate(newActualDate.getDate() + 2);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.update({
				actual_date: newActualDate.toISOString().split('T')[0],
				actual_start_time: '15:00',
				last_updated_by_user_id: aliceUserId,
			})
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.actual_start_time).toBe('15:00:00');
	});

	it('teacher cannot update deviation for other teachers lesson', async () => {
		if (!testDeviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_BOB);
		const bobUserId = fixtures.requireUserId(TestUsers.TEACHER_BOB);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.update({ actual_start_time: '16:00', last_updated_by_user_id: bobUserId })
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot change original_date (immutable)', async () => {
		if (!testDeviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const newOriginalDate = new Date(originalDate + 'T12:00:00');
		newOriginalDate.setDate(newOriginalDate.getDate() + 7);

		const { error } = await db
			.from('lesson_appointment_deviations')
			.update({ original_date: newOriginalDate.toISOString().split('T')[0] })
			.eq('id', testDeviationId)
			.select();

		expect(error).not.toBeNull();
		expect(error?.message).toContain('Cannot change original_date after creation');
	});

	it('admin can update deviation for any lesson', async () => {
		if (!testDeviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const adminUserId = fixtures.requireUserId(TestUsers.ADMIN_ONE);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.update({ actual_start_time: '16:00', last_updated_by_user_id: adminUserId })
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
	});
});

// =============================================================================
// DELETE TESTS
// =============================================================================

describe('RLS: lesson_appointment_deviations DELETE', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let teacherDeviationId: string | null = null;
	let adminDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		// Create deviation for teacher delete test
		const { insertRow: teacherRow } = buildDeviationData({
			agreementId: aliceAgreementId,
			dayOfWeek: aliceAgreement.day_of_week,
			startTime: aliceAgreement.start_time,
			refDays: 63,
			actualStartTime: '14:00',
			recurring: false,
		});
		const { data: teacherData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert(teacherRow)
			.select()
			.single();
		if (teacherData) teacherDeviationId = teacherData.id;

		// Create deviation for admin delete test
		const adminUserId = fixtures.requireUserId(TestUsers.ADMIN_ONE);
		const { insertRow: adminRow } = buildDeviationDataAsUser(
			{
				agreementId: aliceAgreementId,
				dayOfWeek: aliceAgreement.day_of_week,
				startTime: aliceAgreement.start_time,
				refDays: 70,
				actualStartTime: '14:00',
				recurring: false,
			},
			adminUserId,
		);
		const { data: adminData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert(adminRow)
			.select()
			.single();
		if (adminData) adminDeviationId = adminData.id;
	});

	afterAll(async () => {
		if (teacherDeviationId)
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', teacherDeviationId);
		if (adminDeviationId) await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', adminDeviationId);
		await verifyState(initialState);
	});

	it('student cannot delete deviation', async () => {
		if (!teacherDeviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.STUDENT_009);

		const { data } = await db.from('lesson_appointment_deviations').delete().eq('id', teacherDeviationId).select();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete deviation for other teachers lesson', async () => {
		if (!teacherDeviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_BOB);

		const { data } = await db.from('lesson_appointment_deviations').delete().eq('id', teacherDeviationId).select();
		expect(data).toHaveLength(0);
	});

	it('teacher can delete deviation for their own lesson', async () => {
		if (!teacherDeviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', teacherDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		teacherDeviationId = null;
	});

	it('admin can delete deviation for any lesson', async () => {
		if (!adminDeviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', adminDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		adminDeviationId = null;
	});
});

// =============================================================================
// IS_CANCELLED FUNCTIONALITY
// =============================================================================

describe('RLS: lesson_appointment_deviations is_cancelled', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let cancelledDeviationId: string | null = null;
	let updateTestDeviationId: string | null = null;
	let updateTestOriginalDate: string;

	beforeAll(async () => {
		initialState = await setupState();

		// Create deviation for update tests
		const { insertRow, originalDate } = buildDeviationData({
			agreementId: aliceAgreementId,
			dayOfWeek: aliceAgreement.day_of_week,
			startTime: aliceAgreement.start_time,
			refDays: 98,
			actualStartTime: '14:00',
			recurring: false,
		});
		updateTestOriginalDate = originalDate;
		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		if (data) updateTestDeviationId = data.id;
	});

	afterAll(async () => {
		if (cancelledDeviationId)
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', cancelledDeviationId);
		if (updateTestDeviationId)
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', updateTestDeviationId);
		await verifyState(initialState);
	});

	it('teacher can insert cancelled lesson (is_cancelled=true with same dates)', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const refDate = dateDaysFromNow(84);
		const originalDate = originalDateForWeek(aliceAgreement.day_of_week, refDate);

		const newDeviation: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: aliceAgreementId,
			original_date: originalDate,
			original_start_time: aliceAgreement.start_time,
			actual_date: originalDate,
			actual_start_time: aliceAgreement.start_time,
			is_cancelled: true,
			created_by_user_id: aliceUserId,
			last_updated_by_user_id: aliceUserId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();
		expect(error).toBeNull();
		expect(data?.[0]?.is_cancelled).toBe(true);
		cancelledDeviationId = data?.[0]?.id ?? null;
	});

	it('constraint: cannot insert non-cancelled deviation with same dates', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const refDate = dateDaysFromNow(91);
		const originalDate = originalDateForWeek(aliceAgreement.day_of_week, refDate);

		const newDeviation: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: aliceAgreementId,
			original_date: originalDate,
			original_start_time: aliceAgreement.start_time,
			actual_date: originalDate,
			actual_start_time: aliceAgreement.start_time,
			is_cancelled: false,
			created_by_user_id: aliceUserId,
			last_updated_by_user_id: aliceUserId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher can update deviation to cancelled', async () => {
		if (!updateTestDeviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.update({
				actual_date: updateTestOriginalDate,
				actual_start_time: aliceAgreement.start_time,
				is_cancelled: true,
				last_updated_by_user_id: aliceUserId,
			})
			.eq('id', updateTestDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data?.[0]?.is_cancelled).toBe(true);
	});

	it('teacher can restore cancelled lesson by deleting deviation', async () => {
		if (!updateTestDeviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', updateTestDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		updateTestDeviationId = null;
	});
});

// =============================================================================
// AUTO-DELETE TRIGGER
// =============================================================================

describe('RLS: lesson_appointment_deviations auto-delete trigger', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let cancelledDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		if (cancelledDeviationId)
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', cancelledDeviationId);
		await verifyState(initialState);
	});

	it('cancelled deviation is NOT auto-deleted when actual matches original', async () => {
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const refDate = dateDaysFromNow(105);
		const originalDate = originalDateForWeek(aliceAgreement.day_of_week, refDate);

		const { data: insertData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: aliceAgreementId,
				original_date: originalDate,
				original_start_time: aliceAgreement.start_time,
				actual_date: originalDate,
				actual_start_time: aliceAgreement.start_time,
				is_cancelled: true,
				created_by_user_id: aliceUserId,
				last_updated_by_user_id: aliceUserId,
			})
			.select()
			.single();

		cancelledDeviationId = insertData?.id ?? null;

		const { data: verifyData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select()
			.eq('id', cancelledDeviationId ?? '')
			.single();

		expect(verifyData).not.toBeNull();
		expect(verifyData?.is_cancelled).toBe(true);
	});

	it('non-cancelled deviation IS auto-deleted when updated to match original', async () => {
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const { insertRow, originalDate } = buildDeviationData({
			agreementId: aliceAgreementId,
			dayOfWeek: aliceAgreement.day_of_week,
			startTime: aliceAgreement.start_time,
			refDays: 112,
			actualStartTime: '14:00',
			recurring: false,
		});

		const { data: insertData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert(insertRow)
			.select()
			.single();
		const tempId = insertData?.id;

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		await db
			.from('lesson_appointment_deviations')
			.update({
				actual_date: originalDate,
				actual_start_time: aliceAgreement.start_time,
				is_cancelled: false,
				last_updated_by_user_id: aliceUserId,
			})
			.eq('id', tempId ?? '');

		const { data: verifyData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select()
			.eq('id', tempId ?? '')
			.maybeSingle();

		expect(verifyData).toBeNull();
	});
});
