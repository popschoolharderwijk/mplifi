/**
 * RLS tests for agenda_participants SELECT policy.
 *
 * Visibility rules:
 * - Users can see their own participant rows
 * - Event owners can see all participants of their events
 * - Privileged users (site_admin, admin, staff) can see all participants
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { formatDateToDb, now } from '../../../src/lib/date/date-format';
import { createClientAs, createClientBypassRLS } from '../../db';
import { unwrap } from '../../utils';
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

describe('agenda_participants SELECT RLS', () => {
	it('user can see their own participant rows', async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_001);
		const studentUserId = fixtures.requireUserId(TestUsers.STUDENT_001);

		const { data: ownParticipations, error } = await studentDb
			.from('agenda_participants')
			.select('user_id, event_id')
			.eq('user_id', studentUserId);

		expect(error).toBeNull();

		const { data: actualParticipations } = await dbNoRLS
			.from('agenda_participants')
			.select('user_id, event_id')
			.eq('user_id', studentUserId);

		expect(ownParticipations?.length).toBe(actualParticipations?.length);
	});

	it('event owner can see all participants of their events', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const staffUserId = fixtures.requireUserId(TestUsers.STAFF_ONE);
		const today = formatDateToDb(now());

		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: staffUserId,
					title: 'Test event for participant visibility',
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

		const student001UserId = fixtures.requireUserId(TestUsers.STUDENT_001);
		const student002UserId = fixtures.requireUserId(TestUsers.STUDENT_002);

		unwrap(
			await staffDb.from('agenda_participants').insert([
				{ event_id: event.id, user_id: staffUserId },
				{ event_id: event.id, user_id: student001UserId },
				{ event_id: event.id, user_id: student002UserId },
			]),
		);

		const { data: ownerSeesAll, error } = await staffDb
			.from('agenda_participants')
			.select('user_id')
			.eq('event_id', event.id);

		expect(error).toBeNull();
		expect(ownerSeesAll?.length).toBe(3);

		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('participant can only see their own row in event (not other participants)', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const student001Db = await createClientAs(TestUsers.STUDENT_001);
		const staffUserId = fixtures.requireUserId(TestUsers.STAFF_ONE);
		const student001UserId = fixtures.requireUserId(TestUsers.STUDENT_001);
		const student002UserId = fixtures.requireUserId(TestUsers.STUDENT_002);
		const today = formatDateToDb(now());

		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert({
					source_type: 'manual',
					owner_user_id: staffUserId,
					title: 'Test event limited visibility',
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

		unwrap(
			await staffDb.from('agenda_participants').insert([
				{ event_id: event.id, user_id: staffUserId },
				{ event_id: event.id, user_id: student001UserId },
				{ event_id: event.id, user_id: student002UserId },
			]),
		);

		const { data: studentSees, error } = await student001Db
			.from('agenda_participants')
			.select('user_id')
			.eq('event_id', event.id);

		expect(error).toBeNull();
		expect(studentSees?.length).toBe(1);
		expect(studentSees?.[0].user_id).toBe(student001UserId);

		await dbNoRLS.from('agenda_participants').delete().eq('event_id', event.id);
		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('privileged user (admin) can see all participants', async () => {
		const adminDb = await createClientAs(TestUsers.ADMIN_ONE);

		const { data: allParticipants } = await dbNoRLS.from('agenda_participants').select('event_id, user_id');
		const { data: adminSees, error } = await adminDb.from('agenda_participants').select('event_id, user_id');

		expect(error).toBeNull();
		expect(adminSees?.length).toBe(allParticipants?.length);
	});

	it('privileged user (site_admin) can see all participants', async () => {
		const siteAdminDb = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: allParticipants } = await dbNoRLS.from('agenda_participants').select('event_id, user_id');
		const { data: siteAdminSees, error } = await siteAdminDb
			.from('agenda_participants')
			.select('event_id, user_id');

		expect(error).toBeNull();
		expect(siteAdminSees?.length).toBe(allParticipants?.length);
	});
});
