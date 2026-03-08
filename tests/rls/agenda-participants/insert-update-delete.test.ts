/**
 * RLS and trigger tests for agenda_participants.
 *
 * Tests cover:
 * - Owner cannot be removed as participant (trigger)
 * - Only event owner or privileged users can manage participants
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { formatDateToDb, now } from '../../../src/lib/date/date-format';
import { createClientAs, createClientBypassRLS } from '../../db';
import { expectNonNull, unwrap, unwrapError } from '../../utils';
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

const staffUserId = fixtures.requireUserId(TestUsers.STAFF_ONE);
const student001UserId = fixtures.requireUserId(TestUsers.STUDENT_001);
const student002UserId = fixtures.requireUserId(TestUsers.STUDENT_002);
const teacherAliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
const teacherBobUserId = fixtures.requireUserId(TestUsers.TEACHER_BOB);

describe('agenda_participants owner protection', () => {
	it('trigger prevents removing owner from participants', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const today = formatDateToDb(now());

		// Create a manual agenda event with staff as owner
		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: staffUserId,
					title: 'Test event for owner removal',
					start_date: today,
					start_time: '10:00:00',
					end_date: today,
					end_time: '11:00:00',
					is_all_day: false,
					recurring: false,
					created_by: staffUserId,
					updated_by: staffUserId,
				})
				.select('id'),
		);

		// Add owner as participant
		unwrap(
			await staffDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: staffUserId,
			}),
		);

		// Add another participant
		unwrap(
			await staffDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: student001UserId,
			}),
		);

		// Try to remove owner from participants - should fail
		const deleteOwnerResult = await staffDb
			.from('agenda_participants')
			.delete()
			.eq('event_id', event.id)
			.eq('user_id', staffUserId);

		const error = unwrapError(deleteOwnerResult);
		expect(error.message).toContain('Cannot remove event owner from participants');

		// Removing non-owner participant should succeed
		unwrap(
			await staffDb.from('agenda_participants').delete().eq('event_id', event.id).eq('user_id', student001UserId),
		);

		// Cleanup: remove owner participant (bypass RLS) and event
		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('non-owner cannot delete participants from event they do not own', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const studentDb = await createClientAs(TestUsers.STUDENT_001);
		const today = formatDateToDb(now());

		// Create a manual agenda event with staff as owner
		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: staffUserId,
					title: 'Test event for participant deletion',
					start_date: today,
					start_time: '10:00:00',
					end_date: today,
					end_time: '11:00:00',
					is_all_day: false,
					recurring: false,
					created_by: staffUserId,
					updated_by: staffUserId,
				})
				.select('id'),
		);

		// Add participants
		unwrap(
			await staffDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: staffUserId,
			}),
		);
		unwrap(
			await staffDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: student001UserId,
			}),
		);
		unwrap(
			await staffDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: student002UserId,
			}),
		);

		// Student tries to remove another participant - should fail (RLS)
		const deleteResult = await studentDb
			.from('agenda_participants')
			.delete()
			.eq('event_id', event.id)
			.eq('user_id', student002UserId);

		// RLS should prevent this - no rows affected or error
		// Note: Supabase RLS on DELETE returns success but affects 0 rows
		expect(deleteResult.error).toBeNull();

		// Verify participant still exists
		const { data: remaining } = await dbNoRLS
			.from('agenda_participants')
			.select('user_id')
			.eq('event_id', event.id)
			.eq('user_id', student002UserId);
		expect(remaining?.length).toBe(1);

		// Cleanup
		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('owner can add and remove non-owner participants', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const today = formatDateToDb(now());

		// Create a manual agenda event
		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: staffUserId,
					title: 'Test event for participant management',
					start_date: today,
					start_time: '10:00:00',
					end_date: today,
					end_time: '11:00:00',
					is_all_day: false,
					recurring: false,
					created_by: staffUserId,
					updated_by: staffUserId,
				})
				.select('id'),
		);

		// Add owner as participant
		unwrap(
			await staffDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: staffUserId,
			}),
		);

		// Add another participant
		unwrap(
			await staffDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: student001UserId,
			}),
		);

		// Verify both exist
		const { data: participants } = await staffDb
			.from('agenda_participants')
			.select('user_id')
			.eq('event_id', event.id);
		expect(participants?.length).toBe(2);

		// Remove non-owner participant
		unwrap(
			await staffDb.from('agenda_participants').delete().eq('event_id', event.id).eq('user_id', student001UserId),
		);

		// Verify only owner remains
		const { data: remaining } = await staffDb
			.from('agenda_participants')
			.select('user_id')
			.eq('event_id', event.id);
		expect(remaining?.length).toBe(1);
		expect(remaining?.[0]?.user_id).toBe(staffUserId);

		// Cleanup
		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});
});

describe('agenda_participants teacher restriction', () => {
	it('student cannot add teacher as participant to their event', async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_001);
		const today = formatDateToDb(now());

		// Student creates their own event
		const [event] = unwrap(
			await studentDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: student001UserId,
					title: 'Student event - cannot add teacher',
					start_date: today,
					start_time: '14:00:00',
					end_date: today,
					end_time: '15:00:00',
					is_all_day: false,
					recurring: false,
					created_by: student001UserId,
					updated_by: student001UserId,
				})
				.select('id'),
		);

		// Student tries to add their teacher as participant - should fail
		const addTeacherResult = await studentDb.from('agenda_participants').insert({
			event_id: event.id,
			user_id: teacherAliceUserId,
		});

		const error = unwrapError(addTeacherResult);
		expect(error.message).toContain('row-level security');

		// Cleanup
		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await dbNoRLS.from('agenda_events').delete().eq('id', event.id);
	});

	it('student can add another student as participant to their event', async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_001);
		const today = formatDateToDb(now());

		// Student creates their own event
		const [event] = unwrap(
			await studentDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: student001UserId,
					title: 'Student event - can add student',
					start_date: today,
					start_time: '14:00:00',
					end_date: today,
					end_time: '15:00:00',
					is_all_day: false,
					recurring: false,
					created_by: student001UserId,
					updated_by: student001UserId,
				})
				.select('id'),
		);

		// Student adds themselves as participant
		unwrap(
			await studentDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: student001UserId,
			}),
		);

		// Student adds another student as participant - should succeed
		unwrap(
			await studentDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: student002UserId,
			}),
		);

		// Verify both participants exist
		const { data: participants } = await dbNoRLS
			.from('agenda_participants')
			.select('user_id')
			.eq('event_id', event.id);
		expect(participants?.length).toBe(2);

		// Cleanup
		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await studentDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('teacher can add student as participant to their event', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);
		const today = formatDateToDb(now());

		// Teacher creates their own event
		const [event] = unwrap(
			await teacherDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: teacherAliceUserId,
					title: 'Teacher event - can add student',
					start_date: today,
					start_time: '14:00:00',
					end_date: today,
					end_time: '15:00:00',
					is_all_day: false,
					recurring: false,
					created_by: teacherAliceUserId,
					updated_by: teacherAliceUserId,
				})
				.select('id'),
		);

		// Teacher adds themselves as participant
		unwrap(
			await teacherDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: teacherAliceUserId,
			}),
		);

		// Teacher adds a student as participant - should succeed
		unwrap(
			await teacherDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: student001UserId,
			}),
		);

		// Verify both participants exist
		const { data: participants } = await dbNoRLS
			.from('agenda_participants')
			.select('user_id')
			.eq('event_id', event.id);
		expect(participants?.length).toBe(2);

		// Cleanup
		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await teacherDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('teacher cannot add another teacher as participant to their event', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);
		const today = formatDateToDb(now());

		// Teacher creates their own event
		const [event] = unwrap(
			await teacherDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: teacherAliceUserId,
					title: 'Teacher event - cannot add other teacher',
					start_date: today,
					start_time: '14:00:00',
					end_date: today,
					end_time: '15:00:00',
					is_all_day: false,
					recurring: false,
					created_by: teacherAliceUserId,
					updated_by: teacherAliceUserId,
				})
				.select('id'),
		);

		// Teacher tries to add another teacher as participant - should fail
		const addTeacherResult = await teacherDb.from('agenda_participants').insert({
			event_id: event.id,
			user_id: teacherBobUserId,
		});

		const error = unwrapError(addTeacherResult);
		expect(error.message).toContain('row-level security');

		// Cleanup
		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await dbNoRLS.from('agenda_events').delete().eq('id', event.id);
	});

	it('privileged user (staff) can add teacher as participant', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const today = formatDateToDb(now());

		// Staff creates an event
		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: staffUserId,
					title: 'Staff event - can add teacher',
					start_date: today,
					start_time: '14:00:00',
					end_date: today,
					end_time: '15:00:00',
					is_all_day: false,
					recurring: false,
					created_by: staffUserId,
					updated_by: staffUserId,
				})
				.select('id'),
		);

		// Staff adds teacher as participant - should succeed
		unwrap(
			await staffDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: teacherAliceUserId,
			}),
		);

		// Verify participant exists
		const { data: participants } = await dbNoRLS
			.from('agenda_participants')
			.select('user_id')
			.eq('event_id', event.id);
		expectNonNull(participants);
		expect(participants.length).toBe(1);
		expect(participants[0].user_id).toBe(teacherAliceUserId);

		// Cleanup
		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('privileged user (admin) can add teacher as participant', async () => {
		const adminDb = await createClientAs(TestUsers.ADMIN_ONE);
		const adminUserId = fixtures.requireUserId(TestUsers.ADMIN_ONE);
		const today = formatDateToDb(now());

		// Admin creates an event
		const [event] = unwrap(
			await adminDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: adminUserId,
					title: 'Admin event - can add teacher',
					start_date: today,
					start_time: '14:00:00',
					end_date: today,
					end_time: '15:00:00',
					is_all_day: false,
					recurring: false,
					created_by: adminUserId,
					updated_by: adminUserId,
				})
				.select('id'),
		);

		// Admin adds teacher as participant - should succeed
		unwrap(
			await adminDb.from('agenda_participants').insert({
				event_id: event.id,
				user_id: teacherBobUserId,
			}),
		);

		// Verify participant exists
		const { data: participants } = await dbNoRLS
			.from('agenda_participants')
			.select('user_id')
			.eq('event_id', event.id);
		expectNonNull(participants);
		expect(participants.length).toBe(1);
		expect(participants[0].user_id).toBe(teacherBobUserId);

		// Cleanup
		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await adminDb.from('agenda_events').delete().eq('id', event.id);
	});
});
