/**
 * Scenario tests for deviation behaviour: wijzigen (eenmalig/recurring),
 * terugzetten in dezelfde week vs andere week, en "alleen deze" in eerste week.
 * Verifies the DB state after the operations the UI would perform.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
	getActualDateInOriginalWeek,
	getDateForDayOfWeek,
} from '../../../src/components/teachers/agenda/utils';
import { createClientAs, createClientBypassRLS } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const dbNoRLS = createClientBypassRLS();
const agreementId = fixtures.requireAgreementId(TestUsers.STUDENT_009, TestUsers.TEACHER_ALICE);

function getAgreement() {
	const row = fixtures.allLessonAgreements.find((a) => a.id === agreementId);
	if (!row) throw new Error('Agreement not found');
	return row;
}

/** Agreement's original date (e.g. Monday) for the week containing refDate */
function originalDateForWeek(dayOfWeek: number, refDate: Date): string {
	const d = getDateForDayOfWeek(dayOfWeek, refDate);
	return d.toISOString().split('T')[0];
}

describe('deviation scenarios: change single and recurring', () => {
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

	it('change single: insert single deviation for one week', async () => {
		const agreement = getAgreement();
		const week1Monday = originalDateForWeek(agreement.day_of_week, new Date('2025-09-01'));
		const actualDate = getActualDateInOriginalWeek(week1Monday, new Date('2025-09-04T15:00:00'));
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: week1Monday,
				original_start_time: agreement.start_time,
				actual_date: actualDate,
				actual_start_time: '15:00',
				recurring: false,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		expect(data?.recurring).toBe(false);
		expect(data?.original_date).toBe(week1Monday);
		if (data?.id) createdIds.push(data.id);
	});

	it('change recurring: insert recurring deviation', async () => {
		const agreement = getAgreement();
		const week1Monday = originalDateForWeek(agreement.day_of_week, new Date('2025-10-06'));
		const actualDate = getActualDateInOriginalWeek(week1Monday, new Date('2025-10-09T16:00:00'));
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: week1Monday,
				original_start_time: agreement.start_time,
				actual_date: actualDate,
				actual_start_time: '16:00',
				recurring: true,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		expect(data?.recurring).toBe(true);
		if (data?.id) createdIds.push(data.id);
	});
});

describe('deviation scenarios: restore to original in same week', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let singleDeviationId: string | null = null;
	let recurringDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();
		const agreement = getAgreement();
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const weekSingle = originalDateForWeek(agreement.day_of_week, new Date('2025-11-10'));
		const weekRecurring = originalDateForWeek(agreement.day_of_week, new Date('2025-11-17'));
		const actualSingle = getActualDateInOriginalWeek(weekSingle, new Date('2025-11-13T14:00:00'));
		const actualRecurring = getActualDateInOriginalWeek(weekRecurring, new Date('2025-11-20T14:00:00'));

		const { data: singleData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: weekSingle,
				original_start_time: agreement.start_time,
				actual_date: actualSingle,
				actual_start_time: '14:00',
				recurring: false,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();
		if (singleData?.id) singleDeviationId = singleData.id;

		const { data: recurData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: weekRecurring,
				original_start_time: agreement.start_time,
				actual_date: actualRecurring,
				actual_start_time: '14:00',
				recurring: true,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();
		if (recurData?.id) recurringDeviationId = recurData.id;
	});

	afterAll(async () => {
		if (singleDeviationId) await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', singleDeviationId);
		if (recurringDeviationId)
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', recurringDeviationId);
		await verifyState(initialState);
	});

	it('restore single deviation in same week: DELETE row', async () => {
		if (!singleDeviationId) throw new Error('Single deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { error } = await db.from('lesson_appointment_deviations').delete().eq('id', singleDeviationId);

		expect(error).toBeNull();
		const { data: after } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', singleDeviationId)
			.maybeSingle();
		expect(after).toBeNull();
		singleDeviationId = null;
	});

	it('restore recurring deviation in same week (this and future): DELETE row', async () => {
		if (!recurringDeviationId) throw new Error('Recurring deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { error } = await db.from('lesson_appointment_deviations').delete().eq('id', recurringDeviationId);

		expect(error).toBeNull();
		const { data: after } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', recurringDeviationId)
			.maybeSingle();
		expect(after).toBeNull();
		recurringDeviationId = null;
	});
});

describe('deviation scenarios: restore to original in a later week (recurring_end_date)', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let recurringDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();
		const agreement = getAgreement();
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const week1Monday = originalDateForWeek(agreement.day_of_week, new Date('2025-12-01'));
		const actualDate = getActualDateInOriginalWeek(week1Monday, new Date('2025-12-04T14:00:00'));

		const { data } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: week1Monday,
				original_start_time: agreement.start_time,
				actual_date: actualDate,
				actual_start_time: '14:00',
				recurring: true,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();
		if (data?.id) recurringDeviationId = data.id;
	});

	afterAll(async () => {
		if (recurringDeviationId)
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', recurringDeviationId);
		await verifyState(initialState);
	});

	it('restore recurring in later week: recurring_end_date set (last week deviation applies)', async () => {
		if (!recurringDeviationId) throw new Error('Recurring deviation not created');
		const agreement = getAgreement();
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const weekWhereUserDropped = originalDateForWeek(agreement.day_of_week, new Date('2025-12-22'));
		const endDate = new Date(weekWhereUserDropped + 'T12:00:00');
		endDate.setDate(endDate.getDate() - 7);
		const recurringEndDateStr = endDate.toISOString().split('T')[0];

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data: updated, error } = await db
			.from('lesson_appointment_deviations')
			.update({
				recurring_end_date: recurringEndDateStr,
				last_updated_by_user_id: userId,
			})
			.eq('id', recurringDeviationId)
			.select()
			.single();

		expect(error).toBeNull();
		expect(updated?.recurring_end_date).toBe(recurringEndDateStr);
	});
});

describe('deviation scenarios: restore only this occurrence in first week', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let recurringDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();
		const agreement = getAgreement();
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const week1Monday = originalDateForWeek(agreement.day_of_week, new Date('2026-01-05'));
		const actualDate = getActualDateInOriginalWeek(week1Monday, new Date('2026-01-08T14:00:00'));

		const { data } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: week1Monday,
				original_start_time: agreement.start_time,
				actual_date: actualDate,
				actual_start_time: '14:00',
				recurring: true,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();
		if (data?.id) recurringDeviationId = data.id;
	});

	afterAll(async () => {
		const { data: rows } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('lesson_agreement_id', agreementId)
			.gte('original_date', '2026-01-01');
		for (const row of rows ?? []) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', (row as { id: string }).id);
		}
		await verifyState(initialState);
	});

	it('only this in first week: old recurring removed, new recurring starts next week (original_date + 7)', async () => {
		if (!recurringDeviationId) throw new Error('Recurring deviation not created');
		const agreement = getAgreement();
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const { data: existing } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('actual_date')
			.eq('id', recurringDeviationId)
			.single();
		const actualDayOfWeek = existing?.actual_date
			? new Date((existing as { actual_date: string }).actual_date + 'T12:00:00').getDay()
			: 4;
		const thisWeekOriginal = originalDateForWeek(agreement.day_of_week, new Date('2026-01-05'));
		const nextWeekDate = new Date(thisWeekOriginal + 'T12:00:00');
		nextWeekDate.setDate(nextWeekDate.getDate() + 7);
		const nextWeekOriginalStr = nextWeekDate.toISOString().split('T')[0];
		const nextWeekActualDate = getDateForDayOfWeek(actualDayOfWeek, nextWeekDate);
		const nextWeekActualStr = nextWeekActualDate.toISOString().split('T')[0];

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		await db.from('lesson_appointment_deviations').delete().eq('id', recurringDeviationId);

		const { data: inserted, error } = await db
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: nextWeekOriginalStr,
				original_start_time: agreement.start_time,
				actual_date: nextWeekActualStr,
				actual_start_time: '14:00',
				recurring: true,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();

		expect(error).toBeNull();
		expect(inserted).not.toBeNull();
		expect(inserted?.original_date).toBe(nextWeekOriginalStr);
		expect(inserted?.recurring).toBe(true);

		const { data: allForAgreement } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id, original_date, recurring')
			.eq('lesson_agreement_id', agreementId)
			.gte('original_date', '2026-01-01');
		const recurringRows = (allForAgreement ?? []).filter((r: { recurring: boolean }) => r.recurring);
		expect(recurringRows.length).toBe(1);
		expect((recurringRows[0] as { original_date: string }).original_date).toBe(nextWeekOriginalStr);
		recurringDeviationId = null;
	});
});
