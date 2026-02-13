/**
 * Agenda-related deviation DB tests: recurring flag, opheffen (delete), getActualDateInOriginalWeek.
 * Complements insert-update-delete.test.ts (RLS) with agenda use cases.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { getActualDateInOriginalWeek } from '../../../src/components/teachers/agenda/utils';
import { createClientAs, createClientBypassRLS } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { LessonAppointmentDeviationInsert } from '../types';

const dbNoRLS = createClientBypassRLS();

const agreementStudent009TeacherAlice = fixtures.requireAgreementId(TestUsers.STUDENT_009, TestUsers.TEACHER_ALICE);

function calculateOriginalDate(dayOfWeek: number, referenceDate: Date): string {
	const date = new Date(referenceDate);
	const currentDay = date.getDay();
	const diff = dayOfWeek - currentDay;
	date.setDate(date.getDate() + diff);
	return date.toISOString().split('T')[0];
}

describe('lesson_appointment_deviations - agenda: insert single vs recurring', () => {
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

	it('teacher can create a single deviation (alleen deze, recurring=false)', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const agreement = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreement) throw new Error('Agreement not found');

		const originalDate = calculateOriginalDate(agreement.day_of_week, new Date('2025-03-10'));
		const actualDate = getActualDateInOriginalWeek(originalDate, new Date('2025-03-14T15:00:00'));
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const insertRow: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: agreementStudent009TeacherAlice,
			original_date: originalDate,
			original_start_time: agreement.start_time,
			actual_date: actualDate,
			actual_start_time: '15:00',
			recurring: false,
			created_by_user_id: userId,
			last_updated_by_user_id: userId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(insertRow).select().single();

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		expect(data?.recurring).toBe(false);
		expect(data?.actual_date).toBe(actualDate);
		if (data?.id) createdIds.push(data.id);
	});

	it('teacher can create a recurring deviation (deze en alle volgende, recurring=true)', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const agreement = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreement) throw new Error('Agreement not found');

		const originalDate = calculateOriginalDate(agreement.day_of_week, new Date('2025-04-07'));
		const actualDate = getActualDateInOriginalWeek(originalDate, new Date('2025-04-11T16:00:00'));
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const insertRow: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: agreementStudent009TeacherAlice,
			original_date: originalDate,
			original_start_time: agreement.start_time,
			actual_date: actualDate,
			actual_start_time: '16:00',
			recurring: true,
			created_by_user_id: userId,
			last_updated_by_user_id: userId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(insertRow).select().single();

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		expect(data?.recurring).toBe(true);
		if (data?.id) createdIds.push(data.id);
	});
});

describe('lesson_appointment_deviations - agenda: opheffen (delete) row verdwijnt uit DB', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let deviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		const agreement = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreement) throw new Error('Agreement not found');
		const originalDate = calculateOriginalDate(agreement.day_of_week, new Date('2025-05-12'));
		const actualDate = getActualDateInOriginalWeek(originalDate, new Date('2025-05-16T10:00:00'));
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
				original_start_time: agreement.start_time,
				actual_date: actualDate,
				actual_start_time: '10:00',
				recurring: false,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();

		if (data?.id) deviationId = data.id;
	});

	afterAll(async () => {
		if (deviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', deviationId);
		}
		await verifyState(initialState);
	});

	it('teacher can delete deviation (herstel / opheffen) - row is gone', async () => {
		if (!deviationId) throw new Error('Test deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data: deleteData, error } = await db
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', deviationId)
			.select();

		expect(error).toBeNull();
		expect(deleteData).toHaveLength(1);
		expect(deleteData?.[0]?.id).toBe(deviationId);

		const { data: after } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', deviationId)
			.maybeSingle();
		expect(after).toBeNull();
		deviationId = null;
	});
});

describe('lesson_appointment_deviations - agenda: recurring opheffen (herstel alle volgende)', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let recurringDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		const agreement = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreement) throw new Error('Agreement not found');
		const originalDate = calculateOriginalDate(agreement.day_of_week, new Date('2025-06-02'));
		const actualDate = getActualDateInOriginalWeek(originalDate, new Date('2025-06-06T14:00:00'));
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
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
		if (recurringDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', recurringDeviationId);
		}
		await verifyState(initialState);
	});

	it('teacher can delete recurring deviation (herstel alle volgende) - row is gone', async () => {
		if (!recurringDeviationId) throw new Error('Test recurring deviation not created');
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data: deleteData, error } = await db
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', recurringDeviationId)
			.select();

		expect(error).toBeNull();
		expect(deleteData).toHaveLength(1);
		expect(deleteData?.[0]?.id).toBe(recurringDeviationId);
		expect(deleteData?.[0]?.recurring).toBe(true);

		const { data: after } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select('id')
			.eq('id', recurringDeviationId)
			.maybeSingle();
		expect(after).toBeNull();
		recurringDeviationId = null;
	});
});

describe('lesson_appointment_deviations - getActualDateInOriginalWeek satisfies deviation_date_check', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let createdId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		if (createdId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', createdId);
		}
		await verifyState(initialState);
	});

	it('insert with actual_date from getActualDateInOriginalWeek satisfies deviation_date_check', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const agreement = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreement) throw new Error('Agreement not found');

		const originalDate = calculateOriginalDate(agreement.day_of_week, new Date('2025-07-07'));
		const droppedDate = new Date('2025-08-20T11:00:00');
		const actualDate = getActualDateInOriginalWeek(originalDate, droppedDate);
		const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
				original_start_time: agreement.start_time,
				actual_date: actualDate,
				actual_start_time: '11:00',
				recurring: true,
				created_by_user_id: userId,
				last_updated_by_user_id: userId,
			})
			.select()
			.single();

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		expect(data?.actual_date).toBe(actualDate);
		const actual = new Date(actualDate + 'T12:00:00');
		const orig = new Date(originalDate + 'T12:00:00');
		const diffDays = Math.round((actual.getTime() - orig.getTime()) / (24 * 60 * 60 * 1000));
		expect(Math.abs(diffDays)).toBeLessThanOrEqual(7);
		if (data?.id) createdId = data.id;
	});
});
