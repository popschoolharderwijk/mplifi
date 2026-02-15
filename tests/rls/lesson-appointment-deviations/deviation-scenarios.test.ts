/**
 * Scenario tests for deviation behaviour: change (single/recurring),
 * restore in same week vs later week, and "only this" in first week.
 * Verifies the DB state after the operations the UI would perform.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import {
	buildDeviationData,
	dateDaysFromNow,
	getActualDateInOriginalWeek,
	getDateForDayOfWeek,
	getTestAgreement,
	originalDateForWeek,
} from './utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const dbNoRLS = createClientBypassRLS();
const { agreementId, agreement } = getTestAgreement();

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
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { insertRow, originalDate } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 14,
			actualStartTime: '15:00',
			recurring: false,
		});

		const { data, error } = await db.from('lesson_appointment_deviations').insert(insertRow).select().single();

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		expect(data?.recurring).toBe(false);
		expect(data?.original_date).toBe(originalDate);
		if (data?.id) createdIds.push(data.id);
	});

	it('change recurring: insert recurring deviation', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { insertRow } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 21,
			actualStartTime: '16:00',
			recurring: true,
		});

		const { data, error } = await db.from('lesson_appointment_deviations').insert(insertRow).select().single();

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		expect(data?.recurring).toBe(true);
		if (data?.id) createdIds.push(data.id);
	});
});

describe('deviation scenarios: unique index (lesson_agreement_id, original_date)', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let firstDeviationId: string | null = null;
	const weekRefDays = 28;

	beforeAll(async () => {
		initialState = await setupState();
		const { insertRow } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: weekRefDays,
			actualStartTime: '14:00',
			recurring: false,
		});

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		if (data?.id) firstDeviationId = data.id;
	});

	afterAll(async () => {
		if (firstDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', firstDeviationId);
		}
		await verifyState(initialState);
	});

	it('second INSERT with same (lesson_agreement_id, original_date) fails with unique violation', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { insertRow } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: weekRefDays,
			offsetDays: 4,
			actualStartTime: '15:00',
			recurring: false,
		});

		const { data, error } = await db.from('lesson_appointment_deviations').insert(insertRow).select().single();

		expect(error).not.toBeNull();
		expect(error?.code).toBe('23505'); // unique_violation
		expect(data).toBeNull();
	});
});

describe('deviation scenarios: restore to original in same week', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let singleDeviationId: string | null = null;
	let recurringDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		const { insertRow: singleRow } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 35,
			actualStartTime: '14:00',
			recurring: false,
		});
		const { data: singleData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert(singleRow)
			.select()
			.single();
		if (singleData?.id) singleDeviationId = singleData.id;

		const { insertRow: recurRow } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 42,
			actualStartTime: '14:00',
			recurring: true,
		});
		const { data: recurData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert(recurRow)
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
		const { insertRow } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 49,
			actualStartTime: '14:00',
			recurring: true,
		});

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		if (data?.id) recurringDeviationId = data.id;
	});

	afterAll(async () => {
		if (recurringDeviationId)
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', recurringDeviationId);
		await verifyState(initialState);
	});

	it('restore recurring in later week: recurring_end_date set (last week deviation applies)', async () => {
		if (!recurringDeviationId) throw new Error('Recurring deviation not created');
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const weekWhereUserDropped = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(56));
		const expectedEndDate = new Date(weekWhereUserDropped + 'T12:00:00');
		expectedEndDate.setDate(expectedEndDate.getDate() - 7);
		const recurringEndDateStr = expectedEndDate.toISOString().split('T')[0];

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data: result, error } = await db.rpc('end_recurring_deviation_from_week', {
			p_deviation_id: recurringDeviationId,
			p_week_date: weekWhereUserDropped,
			p_user_id: userId,
		});

		expect(error).toBeNull();
		expect(result).toBe('updated');
		const { data: row } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('recurring_end_date')
			.eq('id', recurringDeviationId)
			.single();
		expect(row?.recurring_end_date).toBe(recurringEndDateStr);
	});
});

describe('deviation scenarios: end_recurring_deviation_from_week RPC', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let recurringDeviationId: string | null = null;
	const weekRefDays = 63;

	beforeAll(async () => {
		initialState = await setupState();
		const { insertRow } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: weekRefDays,
			actualStartTime: '14:00',
			recurring: true,
		});

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		if (data?.id) recurringDeviationId = data.id;
	});

	afterAll(async () => {
		if (recurringDeviationId)
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', recurringDeviationId);
		await verifyState(initialState);
	});

	it('first week: returns deleted and removes row', async () => {
		if (!recurringDeviationId) throw new Error('Recurring deviation not created');
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const week1Monday = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(weekRefDays));

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data: result, error } = await db.rpc('end_recurring_deviation_from_week', {
			p_deviation_id: recurringDeviationId,
			p_week_date: week1Monday,
			p_user_id: userId,
		});

		expect(error).toBeNull();
		expect(result).toBe('deleted');
		const { data: after } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', recurringDeviationId)
			.maybeSingle();
		expect(after).toBeNull();
		recurringDeviationId = null;
	});
});

describe('deviation scenarios: override recurring deviation with actual=original', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let recurringDeviationId: string | null = null;
	let overrideDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();
		const { insertRow } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 70,
			actualStartTime: '14:00',
			recurring: true,
		});

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		if (data?.id) recurringDeviationId = data.id;
	});

	afterAll(async () => {
		if (overrideDeviationId)
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', overrideDeviationId);
		if (recurringDeviationId)
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', recurringDeviationId);
		await verifyState(initialState);
	});

	it('insert deviation with actual=original is allowed when overriding a recurring deviation', async () => {
		if (!recurringDeviationId) throw new Error('Recurring deviation not created');
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const week3Monday = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(77));

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: week3Monday,
				original_start_time: agreement.start_time,
				actual_date: week3Monday,
				actual_start_time: agreement.start_time,
				recurring: false,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		expect(data?.actual_date).toBe(week3Monday);
		expect(data?.actual_start_time).toBe(agreement.start_time);
		if (data?.id) overrideDeviationId = data.id;
	});

	it('restore single deviation (that overrode recurring) back to original: week shows Monday green', async () => {
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const week1Monday = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(84));
		const week2Monday = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(91));
		const dropped2 = new Date(week2Monday + 'T14:00:00');
		dropped2.setDate(dropped2.getDate() + 2);
		const week2Wednesday = getActualDateInOriginalWeek(week2Monday, dropped2);

		// Create recurring Mon→Tue for week 1
		const dropped1 = new Date(week1Monday + 'T14:00:00');
		dropped1.setDate(dropped1.getDate() + 1);
		const { data: recurData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: week1Monday,
				original_start_time: agreement.start_time,
				actual_date: getActualDateInOriginalWeek(week1Monday, dropped1),
				actual_start_time: '14:00',
				recurring: true,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();
		const recurringId = (recurData as { id: string } | null)?.id;
		if (!recurringId) throw new Error('Recurring deviation not created');

		// Create single for week 2: move that week to Wednesday
		const { data: singleData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: week2Monday,
				original_start_time: agreement.start_time,
				actual_date: week2Wednesday,
				actual_start_time: '14:00',
				recurring: false,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();
		const singleId = (singleData as { id: string } | null)?.id;
		if (!singleId) throw new Error('Single deviation not created');

		// Restore to original via RPC
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data: rpcResult, error: rpcError } = await db.rpc('ensure_week_shows_original_slot', {
			p_lesson_agreement_id: agreementId,
			p_week_date: week2Monday,
			p_user_id: userId,
			p_scope: 'only_this',
		});

		expect(rpcError).toBeNull();
		expect(rpcResult).toBe('single_replaced_with_override');

		const { data: overrideRows } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id, original_date, actual_date')
			.eq('lesson_agreement_id', agreementId)
			.eq('original_date', week2Monday)
			.eq('recurring', false);
		expect((overrideRows ?? []).length).toBe(1);
		expect((overrideRows ?? [])[0]).toMatchObject({ original_date: week2Monday, actual_date: week2Monday });

		const { data: recurringRow } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', recurringId)
			.maybeSingle();
		expect(recurringRow).not.toBeNull();

		// Cleanup
		const overrideId = (overrideRows ?? [])[0]?.id;
		if (overrideId) await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', overrideId);
		await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', recurringId);
	});

	it('insert deviation with actual=original is rejected when there is no recurring deviation to override', async () => {
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const weekBeforeRecurring = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(63));

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: weekBeforeRecurring,
				original_start_time: agreement.start_time,
				actual_date: weekBeforeRecurring,
				actual_start_time: agreement.start_time,
				recurring: false,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();

		expect(error).not.toBeNull();
		expect(error?.message).toContain('Deviation must actually deviate');
		expect(data).toBeNull();
	});
});

describe('deviation scenarios: shift_recurring_deviation_to_next_week function', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let recurringDeviationId: string | null = null;
	const weekRefDays = 105;
	let minOriginalDate: string;

	beforeAll(async () => {
		initialState = await setupState();
		const { insertRow, originalDate } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: weekRefDays,
			actualStartTime: '14:00',
			recurring: true,
		});
		minOriginalDate = originalDate;

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		if (data?.id) recurringDeviationId = data.id;
	});

	afterAll(async () => {
		const { data: rows } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('lesson_agreement_id', agreementId)
			.gte('original_date', minOriginalDate);
		for (const row of rows ?? []) {
			await dbNoRLS
				.from('lesson_appointment_deviations')
				.delete()
				.eq('id', (row as { id: string }).id);
		}
		await verifyState(initialState);
	});

	it('shift_recurring_deviation_to_next_week atomically moves deviation to next week', async () => {
		if (!recurringDeviationId) throw new Error('Recurring deviation not created');
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const nextWeekMonday = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(weekRefDays + 7));

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data: newId, error } = await db.rpc('shift_recurring_deviation_to_next_week', {
			p_deviation_id: recurringDeviationId,
			p_user_id: userId,
		});

		expect(error).toBeNull();
		expect(newId).not.toBeNull();

		const { data: oldRow } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', recurringDeviationId)
			.maybeSingle();
		expect(oldRow).toBeNull();

		const { data: newRow } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id, original_date, recurring')
			.eq('id', newId as string)
			.single();
		expect(newRow).not.toBeNull();
		expect(newRow?.original_date).toBe(nextWeekMonday);
		expect(newRow?.recurring).toBe(true);

		recurringDeviationId = null;
	});
});

describe('deviation scenarios: restore only this occurrence in first week', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let recurringDeviationId: string | null = null;
	const weekRefDays = 119;
	let minOriginalDate: string;

	beforeAll(async () => {
		initialState = await setupState();
		const { insertRow, originalDate } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: weekRefDays,
			actualStartTime: '14:00',
			recurring: true,
		});
		minOriginalDate = originalDate;

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		if (data?.id) recurringDeviationId = data.id;
	});

	afterAll(async () => {
		const { data: rows } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('lesson_agreement_id', agreementId)
			.gte('original_date', minOriginalDate);
		for (const row of rows ?? []) {
			await dbNoRLS
				.from('lesson_appointment_deviations')
				.delete()
				.eq('id', (row as { id: string }).id);
		}
		await verifyState(initialState);
	});

	it('only this in first week: old recurring removed, new recurring starts next week (original_date + 7)', async () => {
		if (!recurringDeviationId) throw new Error('Recurring deviation not created');
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const { data: existing } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('actual_date')
			.eq('id', recurringDeviationId)
			.single();
		const actualDayOfWeek = existing?.actual_date
			? new Date((existing as { actual_date: string }).actual_date + 'T12:00:00').getDay()
			: 4;
		const thisWeekOriginal = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(weekRefDays));
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
			.gte('original_date', minOriginalDate);
		const recurringRows = (allForAgreement ?? []).filter((r: { recurring: boolean }) => r.recurring);
		expect(recurringRows.length).toBe(1);
		expect((recurringRows[0] as { original_date: string }).original_date).toBe(nextWeekOriginalStr);
		recurringDeviationId = null;
	});
});

describe('deviation scenarios: ensure_week_shows_original_slot RPC', () => {
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

	it('recurring first week + this_and_future → recurring_deleted', async () => {
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const { insertRow, originalDate } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 126,
			actualStartTime: '14:00',
			recurring: true,
		});

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		const devId = (data as { id: string } | null)?.id;
		if (devId) createdIds.push(devId);

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data: result, error } = await db.rpc('ensure_week_shows_original_slot', {
			p_lesson_agreement_id: agreementId,
			p_week_date: originalDate,
			p_user_id: userId,
			p_scope: 'this_and_future',
		});

		expect(error).toBeNull();
		expect(result).toBe('recurring_deleted');
		if (!devId) throw new Error('Deviation not created');
		const { data: after } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', devId)
			.maybeSingle();
		expect(after).toBeNull();
		createdIds.length = 0;
	});

	it('recurring first week + only_this → recurring_shifted', async () => {
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const { insertRow, originalDate } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 133,
			actualStartTime: '14:00',
			recurring: true,
		});

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		const devId = (data as { id: string } | null)?.id;
		if (devId) createdIds.push(devId);

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data: result, error } = await db.rpc('ensure_week_shows_original_slot', {
			p_lesson_agreement_id: agreementId,
			p_week_date: originalDate,
			p_user_id: userId,
			p_scope: 'only_this',
		});

		expect(error).toBeNull();
		expect(result).toBe('recurring_shifted');
		if (!devId) throw new Error('Deviation not created');
		const { data: oldRow } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', devId)
			.maybeSingle();
		expect(oldRow).toBeNull();
		const nextWeekMonday = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(140));
		const { data: newRows } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('lesson_agreement_id', agreementId)
			.eq('original_date', nextWeekMonday)
			.eq('recurring', true);
		expect((newRows ?? []).length).toBe(1);
		if ((newRows ?? [])[0]?.id) createdIds.push((newRows as { id: string }[])[0].id);
	});

	it('recurring later week + this_and_future → recurring_ended', async () => {
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const { insertRow, originalDate: week1Monday } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 147,
			actualStartTime: '14:00',
			recurring: true,
		});
		const week2Monday = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(154));

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		const devId = (data as { id: string } | null)?.id;
		if (devId) createdIds.push(devId);

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data: result, error } = await db.rpc('ensure_week_shows_original_slot', {
			p_lesson_agreement_id: agreementId,
			p_week_date: week2Monday,
			p_user_id: userId,
			p_scope: 'this_and_future',
		});

		expect(error).toBeNull();
		expect(result).toBe('recurring_ended');
		if (!devId) throw new Error('Deviation not created');
		const { data: row } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('recurring_end_date')
			.eq('id', devId)
			.single();
		expect((row as { recurring_end_date: string } | null)?.recurring_end_date).toBe(week1Monday);
	});


	it('single that overrode recurring + restore → single_replaced_with_override and week shows original', async () => {
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const week1Monday = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(168));
		const week2Monday = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(175));
		const dropped2 = new Date(week2Monday + 'T14:00:00');
		dropped2.setDate(dropped2.getDate() + 2);
		const week2Wed = getActualDateInOriginalWeek(week2Monday, dropped2);

		const dropped1 = new Date(week1Monday + 'T14:00:00');
		dropped1.setDate(dropped1.getDate() + 1);
		const { data: recurData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: week1Monday,
				original_start_time: agreement.start_time,
				actual_date: getActualDateInOriginalWeek(week1Monday, dropped1),
				actual_start_time: '14:00',
				recurring: true,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();
		const recurringId = (recurData as { id: string } | null)?.id;
		if (recurringId) createdIds.push(recurringId);

		const { data: singleData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementId,
				original_date: week2Monday,
				original_start_time: agreement.start_time,
				actual_date: week2Wed,
				actual_start_time: '14:00',
				recurring: false,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();
		const singleId = (singleData as { id: string } | null)?.id;
		if (singleId) createdIds.push(singleId);

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data: result, error } = await db.rpc('ensure_week_shows_original_slot', {
			p_lesson_agreement_id: agreementId,
			p_week_date: week2Monday,
			p_user_id: userId,
			p_scope: 'only_this',
		});

		expect(error).toBeNull();
		expect(result).toBe('single_replaced_with_override');
		if (!singleId) throw new Error('Single deviation not created');
		const { data: afterSingle } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', singleId)
			.maybeSingle();
		expect(afterSingle).toBeNull();
		const { data: overrideRows } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id, original_date, actual_date, actual_start_time')
			.eq('lesson_agreement_id', agreementId)
			.eq('original_date', week2Monday)
			.eq('recurring', false);
		expect((overrideRows ?? []).length).toBe(1);
		const override = (overrideRows ?? [])[0] as {
			id: string;
			original_date: string;
			actual_date: string;
			actual_start_time: string;
		};
		expect(override.original_date).toBe(week2Monday);
		expect(override.actual_date).toBe(week2Monday);
		expect(override.actual_start_time).toBe(agreement.start_time);
		if (override.id) createdIds.push(override.id);
	});

	it('later occurrence of recurring + only_this → override_inserted', async () => {
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const { insertRow } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 182,
			actualStartTime: '14:00',
			recurring: true,
		});
		const week2Monday = originalDateForWeek(agreement.day_of_week, dateDaysFromNow(189));

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		const devId = (data as { id: string } | null)?.id;
		if (devId) createdIds.push(devId);

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data: result, error } = await db.rpc('ensure_week_shows_original_slot', {
			p_lesson_agreement_id: agreementId,
			p_week_date: week2Monday,
			p_user_id: userId,
			p_scope: 'only_this',
		});

		expect(error).toBeNull();
		expect(result).toBe('override_inserted');
		const { data: overrideRows } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id, original_date, actual_date, recurring')
			.eq('lesson_agreement_id', agreementId)
			.eq('original_date', week2Monday)
			.eq('recurring', false);
		expect((overrideRows ?? []).length).toBe(1);
		const override = (overrideRows ?? [])[0] as { id: string; actual_date: string };
		expect(override.actual_date).toBe(week2Monday);
		if (override.id) createdIds.push(override.id);
	});
});

describe('deviation scenarios: single (no recurring) restore behavior', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let singleDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		if (singleDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', singleDeviationId);
		}
		await verifyState(initialState);
	});

	it('single (no recurring) + restore → single_deleted', async () => {
		const { insertRow, originalDate } = buildDeviationData({
			agreementId,
			dayOfWeek: agreement.day_of_week,
			startTime: agreement.start_time,
			refDays: 300,
			actualStartTime: '14:00',
			recurring: false,
		});

		const { data } = await dbNoRLS.from('lesson_appointment_deviations').insert(insertRow).select().single();
		singleDeviationId = (data as { id: string } | null)?.id ?? null;

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const { data: result, error } = await db.rpc('ensure_week_shows_original_slot', {
			p_lesson_agreement_id: agreementId,
			p_week_date: originalDate,
			p_user_id: userId,
			p_scope: 'only_this',
		});

		expect(error).toBeNull();
		expect(result).toBe('single_deleted');
		if (!singleDeviationId) throw new Error('Deviation not created');
		const { data: after } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', singleDeviationId)
			.maybeSingle();
		expect(after).toBeNull();
		singleDeviationId = null;
	});
});
