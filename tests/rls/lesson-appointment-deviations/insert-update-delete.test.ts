/**
 * RLS and RPC authorization for agenda_event_deviations.
 *
 * Lesson appointments from lesson_agreements can be modified via deviations:
 * - Teachers CAN reschedule/cancel lessons for their own lesson agreements
 * - Students CANNOT reschedule/cancel lessons
 * - Staff/admin/site_admin CAN reschedule/cancel any lessons
 *
 * Deviation-modifying RPCs (shift_recurring_deviation_to_next_week,
 * end_recurring_deviation_from_week, ensure_week_shows_original_slot) may only be
 * called by the owner of the agenda event (teacher for lesson_agreement-backed events) or by privileged users.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { parseISO } from 'date-fns';
import { addDaysToDate, formatDateToDb, getDateForDayOfWeek } from '../../../src/lib/date/date-format';
import { createClientAs, createClientBypassRLS } from '../../db';
import type { AgendaEventDeviationInsert } from '../../types';
import { unwrap, unwrapError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

const dbNoRLS = createClientBypassRLS();

const agreementId = fixtures.requireAgreementId(TestUsers.STUDENT_009, TestUsers.TEACHER_ALICE);
const teacherAliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
const staffUserId = fixtures.requireUserId(TestUsers.STAFF_ONE);
const student009UserId = fixtures.requireUserId(TestUsers.STUDENT_009);
const student001UserId = fixtures.requireUserId(TestUsers.STUDENT_001);

/** Get agenda_event id for a lesson_agreement (created by trigger). */
async function getAgendaEventIdForAgreement(agreementId: string): Promise<string> {
	const { data: row } = await dbNoRLS
		.from('agenda_events')
		.select('id')
		.eq('source_type', 'lesson_agreement')
		.eq('source_id', agreementId)
		.single();
	if (!row?.id) throw new Error(`No agenda_event found for agreement ${agreementId}`);
	return row.id;
}

/** Next Monday from today (YYYY-MM-DD). */
function nextMonday(): string {
	const today = new Date();
	let monday = getDateForDayOfWeek(1, today);
	monday = monday.getTime() <= today.getTime() ? addDaysToDate(monday, 7) : monday;
	return formatDateToDb(monday);
}

function addDays(dateStr: string, days: number): string {
	return formatDateToDb(addDaysToDate(parseISO(`${dateStr}T12:00:00Z`), days));
}

type AgendaEventTimeRow = { id: string; start_time: string };

function requireAgendaEventTime(value: unknown): AgendaEventTimeRow {
	if (
		typeof value !== 'object' ||
		value === null ||
		!('id' in value) ||
		!('start_time' in value) ||
		typeof (value as AgendaEventTimeRow).start_time !== 'string'
	) {
		throw new Error('Invalid AgendaEventTimeRow');
	}
	return value as AgendaEventTimeRow;
}

describe('Teacher CAN create deviations for their own lesson agreements', () => {
	it('teacher can insert deviation to reschedule a lesson', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const actualDate = addDays(weekDate, 1);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: actualDate,
			actual_start_time: '15:00',
			is_cancelled: false,
			recurring: false,
			created_by: teacherAliceUserId,
			updated_by: teacherAliceUserId,
		};

		const [inserted] = unwrap(await teacherDb.from('agenda_event_deviations').insert(insertRow).select('id'));
		expect(inserted.id).toBeDefined();

		await teacherDb.from('agenda_event_deviations').delete().eq('id', inserted.id);
	});

	it('teacher can insert deviation to cancel a single lesson', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: weekDate,
			actual_start_time: startTime,
			is_cancelled: true,
			reason: 'Ziek',
			recurring: false,
			created_by: teacherAliceUserId,
			updated_by: teacherAliceUserId,
		};

		const [inserted] = unwrap(await teacherDb.from('agenda_event_deviations').insert(insertRow).select('id'));
		expect(inserted.id).toBeDefined();

		await teacherDb.from('agenda_event_deviations').delete().eq('id', inserted.id);
	});

	it('teacher can update their own deviation', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: weekDate,
			actual_start_time: '16:00',
			is_cancelled: false,
			recurring: false,
			created_by: teacherAliceUserId,
			updated_by: teacherAliceUserId,
		};

		const [inserted] = unwrap(await teacherDb.from('agenda_event_deviations').insert(insertRow).select('id'));

		const [updated] = unwrap(
			await teacherDb
				.from('agenda_event_deviations')
				.update({ actual_start_time: '17:00', reason: 'Gewijzigd' })
				.eq('id', inserted.id)
				.select('actual_start_time, reason'),
		);

		expect(updated.actual_start_time).toBe('17:00:00');
		expect(updated.reason).toBe('Gewijzigd');

		await teacherDb.from('agenda_event_deviations').delete().eq('id', inserted.id);
	});

	it('teacher can delete their own deviation', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: weekDate,
			actual_start_time: '18:00',
			is_cancelled: false,
			recurring: false,
			created_by: teacherAliceUserId,
			updated_by: teacherAliceUserId,
		};

		const [inserted] = unwrap(await teacherDb.from('agenda_event_deviations').insert(insertRow).select('id'));

		unwrap(await teacherDb.from('agenda_event_deviations').delete().eq('id', inserted.id));

		const { data: remaining } = await dbNoRLS.from('agenda_event_deviations').select('id').eq('id', inserted.id);
		expect(remaining?.length).toBe(0);
	});
});

describe('Student CANNOT create deviations for lesson agreements', () => {
	it('student cannot insert deviation to reschedule their own lesson', async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_009);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: addDays(weekDate, 1),
			actual_start_time: '15:00',
			is_cancelled: false,
			recurring: false,
			created_by: student009UserId,
			updated_by: student009UserId,
		};

		const error = unwrapError(await studentDb.from('agenda_event_deviations').insert(insertRow).select('id'));
		expect(error.message).toContain('row-level security');
	});

	it('student cannot insert deviation to cancel their own lesson', async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_009);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: weekDate,
			actual_start_time: startTime,
			is_cancelled: true,
			reason: 'Ziek',
			recurring: false,
			created_by: student009UserId,
			updated_by: student009UserId,
		};

		const error = unwrapError(await studentDb.from('agenda_event_deviations').insert(insertRow).select('id'));
		expect(error.message).toContain('row-level security');
	});

	it('student cannot update existing deviation', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);
		const studentDb = await createClientAs(TestUsers.STUDENT_009);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: weekDate,
			actual_start_time: '16:00',
			is_cancelled: false,
			recurring: false,
			created_by: teacherAliceUserId,
			updated_by: teacherAliceUserId,
		};

		const [inserted] = unwrap(await teacherDb.from('agenda_event_deviations').insert(insertRow).select('id'));

		const updateResult = await studentDb
			.from('agenda_event_deviations')
			.update({ actual_start_time: '17:00' })
			.eq('id', inserted.id)
			.select('id');

		expect(updateResult.error).toBeNull();
		expect(updateResult.data?.length).toBe(0);

		await teacherDb.from('agenda_event_deviations').delete().eq('id', inserted.id);
	});

	it('student cannot delete existing deviation', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);
		const studentDb = await createClientAs(TestUsers.STUDENT_009);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: weekDate,
			actual_start_time: '16:30',
			is_cancelled: false,
			recurring: false,
			created_by: teacherAliceUserId,
			updated_by: teacherAliceUserId,
		};

		const [inserted] = unwrap(await teacherDb.from('agenda_event_deviations').insert(insertRow).select('id'));

		const deleteResult = await studentDb.from('agenda_event_deviations').delete().eq('id', inserted.id);

		expect(deleteResult.error).toBeNull();

		const { data: stillExists } = await dbNoRLS.from('agenda_event_deviations').select('id').eq('id', inserted.id);
		expect(stillExists?.length).toBe(1);

		await teacherDb.from('agenda_event_deviations').delete().eq('id', inserted.id);
	});
});

describe('Staff/admin CAN manage deviations for any lesson agreement', () => {
	it('staff can insert deviation for any lesson agreement', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: addDays(weekDate, 2),
			actual_start_time: '14:00',
			is_cancelled: false,
			recurring: false,
			created_by: staffUserId,
			updated_by: staffUserId,
		};

		const [inserted] = unwrap(await staffDb.from('agenda_event_deviations').insert(insertRow).select('id'));
		expect(inserted.id).toBeDefined();

		await staffDb.from('agenda_event_deviations').delete().eq('id', inserted.id);
	});

	it('admin can update deviation created by teacher', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);
		const adminDb = await createClientAs(TestUsers.ADMIN_ONE);
		const adminUserId = fixtures.requireUserId(TestUsers.ADMIN_ONE);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: weekDate,
			actual_start_time: '16:00',
			is_cancelled: false,
			recurring: false,
			created_by: teacherAliceUserId,
			updated_by: teacherAliceUserId,
		};

		const [inserted] = unwrap(await teacherDb.from('agenda_event_deviations').insert(insertRow).select('id'));

		const [updated] = unwrap(
			await adminDb
				.from('agenda_event_deviations')
				.update({ reason: 'Admin wijziging', updated_by: adminUserId })
				.eq('id', inserted.id)
				.select('reason'),
		);

		expect(updated.reason).toBe('Admin wijziging');

		await adminDb.from('agenda_event_deviations').delete().eq('id', inserted.id);
	});

	it('site_admin can delete any deviation', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);
		const siteAdminDb = await createClientAs(TestUsers.SITE_ADMIN);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: weekDate,
			actual_start_time: '17:30',
			is_cancelled: false,
			recurring: false,
			created_by: teacherAliceUserId,
			updated_by: teacherAliceUserId,
		};

		const [inserted] = unwrap(await teacherDb.from('agenda_event_deviations').insert(insertRow).select('id'));

		unwrap(await siteAdminDb.from('agenda_event_deviations').delete().eq('id', inserted.id));

		const { data: remaining } = await dbNoRLS.from('agenda_event_deviations').select('id').eq('id', inserted.id);
		expect(remaining?.length).toBe(0);
	});
});

describe('agenda_event_deviations RPCs require authorization', () => {
	it('unprivileged user (student) cannot shift recurring deviation that belongs to another teacher', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const studentDb = await createClientAs(TestUsers.STUDENT_001);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const actualDate = addDays(weekDate, 1);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: actualDate,
			actual_start_time: startTime,
			is_cancelled: false,
			recurring: true,
			created_by: staffUserId,
			updated_by: staffUserId,
		};

		const [inserted] = unwrap(await staffDb.from('agenda_event_deviations').insert(insertRow).select('id'));

		const shiftResult = await studentDb.rpc('shift_recurring_deviation_to_next_week', {
			p_deviation_id: inserted.id,
			p_user_id: student001UserId,
		});

		const deviationIdsToDelete = [inserted.id, shiftResult.data].filter((id): id is string => id != null);
		await Promise.all(
			deviationIdsToDelete.map((id) => staffDb.from('agenda_event_deviations').delete().eq('id', id)),
		);

		const error = unwrapError(shiftResult);
		expect(error.message).toContain('Permission denied');
	});

	it('unprivileged user (student) cannot end recurring deviation that belongs to another teacher', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const studentDb = await createClientAs(TestUsers.STUDENT_001);

		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const evRow = requireAgendaEventTime(
			unwrap(await dbNoRLS.from('agenda_events').select('id, start_time').eq('id', eventId).single()),
		);
		const weekDate = nextMonday();
		const startTime = evRow.start_time.substring(0, 5);
		const actualDate = addDays(weekDate, 1);
		const insertRow: AgendaEventDeviationInsert = {
			event_id: eventId,
			original_date: weekDate,
			original_start_time: startTime,
			actual_date: actualDate,
			actual_start_time: startTime,
			is_cancelled: false,
			recurring: true,
			created_by: staffUserId,
			updated_by: staffUserId,
		};

		const [inserted] = unwrap(await staffDb.from('agenda_event_deviations').insert(insertRow).select('id'));

		const endResult = await studentDb.rpc('end_recurring_deviation_from_week', {
			p_deviation_id: inserted.id,
			p_week_date: weekDate,
			p_user_id: student001UserId,
		});

		await staffDb.from('agenda_event_deviations').delete().eq('id', inserted.id);

		const error = unwrapError(endResult);
		expect(error.message).toContain('Permission denied');
	});

	it("unprivileged user (student) cannot call ensure_week_shows_original_slot for another teacher's event", async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_001);
		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const weekDate = nextMonday();

		const error = unwrapError(
			await studentDb.rpc('ensure_week_shows_original_slot', {
				p_event_id: eventId,
				p_week_date: weekDate,
				p_user_id: student001UserId,
				p_scope: 'only_this',
			}),
		);
		expect(error.message).toContain('Permission denied');
	});

	it('teacher CAN call ensure_week_shows_original_slot for their own event', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);
		const eventId = await getAgendaEventIdForAgreement(agreementId);
		const weekDate = nextMonday();

		const result = await teacherDb.rpc('ensure_week_shows_original_slot', {
			p_event_id: eventId,
			p_week_date: weekDate,
			p_user_id: teacherAliceUserId,
			p_scope: 'only_this',
		});

		expect(result.error).toBeNull();
	});
});
