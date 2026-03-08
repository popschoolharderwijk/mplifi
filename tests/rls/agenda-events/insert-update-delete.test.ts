/**
 * RLS tests for agenda_events INSERT, UPDATE, DELETE policies.
 *
 * Rules:
 * - INSERT: user can only insert events where owner_user_id = auth.uid(), or privileged
 * - UPDATE: owner or privileged users only
 * - DELETE: owner or privileged users only
 *
 * Note: Staff/admin/site_admin are "privileged" users who can manage all events.
 * Teachers and students are non-privileged and can only manage their own events.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { formatDateToDb, now } from '../../../src/lib/date/date-format';
import { createClientAs, createClientBypassRLS } from '../../db';
import type { AgendaEventInsert } from '../../types';
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

const staffOneUserId = fixtures.requireUserId(TestUsers.STAFF_ONE);
const staffTwoUserId = fixtures.requireUserId(TestUsers.STAFF_TWO);
const student001UserId = fixtures.requireUserId(TestUsers.STUDENT_001);

function createManualEventInsert(ownerUserId: string, title: string): AgendaEventInsert {
	const today = formatDateToDb(now());
	return {
		source_type: 'manual',
		owner_user_id: ownerUserId,
		title,
		start_date: today,
		start_time: '10:00:00',
		end_date: today,
		end_time: '11:00:00',
		is_all_day: false,
		recurring: false,
		created_by: ownerUserId,
		updated_by: ownerUserId,
	};
}

describe('agenda_events INSERT RLS', () => {
	it('privileged user can insert event where they are owner', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);

		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert(createManualEventInsert(staffOneUserId, 'Test event staff owner'))
				.select('id'),
		);

		expect(event.id).toBeDefined();

		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('non-privileged user cannot insert event where another user is owner', async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_001);

		const result = await studentDb
			.from('agenda_events')
			.insert(createManualEventInsert(staffOneUserId, 'Test event wrong owner'))
			.select('id');

		const error = unwrapError(result);
		expect(error.message).toContain('row-level security');
	});

	it('privileged user (staff) can insert event for another user', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);

		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert({
					...createManualEventInsert(staffTwoUserId, 'Test event staff creates for other staff'),
					created_by: staffOneUserId,
					updated_by: staffOneUserId,
				})
				.select('id'),
		);

		expect(event.id).toBeDefined();

		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('non-privileged user can insert event where they are owner', async () => {
		// RLS policy allows owner_user_id = auth.uid() for INSERT
		// SELECT policy allows owners to see their own events
		// All users should be able to create events in their own agenda
		const studentDb = await createClientAs(TestUsers.STUDENT_001);

		const [event] = unwrap(
			await studentDb
				.from('agenda_events')
				.insert(createManualEventInsert(student001UserId, 'Test event student owner'))
				.select('id, owner_user_id'),
		);

		expect(event.id).toBeDefined();
		expect(event.owner_user_id).toBe(student001UserId);

		// Clean up - student should be able to delete their own event
		unwrap(await studentDb.from('agenda_events').delete().eq('id', event.id));
	});
});

describe('agenda_events UPDATE RLS', () => {
	it('owner can update their own event', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);

		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert(createManualEventInsert(staffOneUserId, 'Test event to update'))
				.select('id'),
		);

		unwrap(
			await staffDb.from('agenda_events').update({ title: 'Updated title' }).eq('id', event.id).select('title'),
		);

		const [updated] = unwrap(await staffDb.from('agenda_events').select('title').eq('id', event.id));
		expect(updated.title).toBe('Updated title');

		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('non-owner non-privileged cannot update event they do not own', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const studentDb = await createClientAs(TestUsers.STUDENT_001);

		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert(createManualEventInsert(staffOneUserId, 'Test event no update'))
				.select('id'),
		);

		const updateResult = await studentDb
			.from('agenda_events')
			.update({ title: 'Hacked title' })
			.eq('id', event.id)
			.select('title');

		expect(updateResult.error).toBeNull();
		expect(updateResult.data?.length).toBe(0);

		const [unchanged] = unwrap(await dbNoRLS.from('agenda_events').select('title').eq('id', event.id));
		expect(unchanged.title).toBe('Test event no update');

		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('privileged user (staff) can update any event', async () => {
		const staffOneDb = await createClientAs(TestUsers.STAFF_ONE);
		const staffTwoDb = await createClientAs(TestUsers.STAFF_TWO);

		const [event] = unwrap(
			await staffOneDb
				.from('agenda_events')
				.insert(createManualEventInsert(staffOneUserId, 'Test event staff can update'))
				.select('id'),
		);

		unwrap(
			await staffTwoDb
				.from('agenda_events')
				.update({ title: 'Staff updated title', updated_by: staffTwoUserId })
				.eq('id', event.id)
				.select('title'),
		);

		const [updated] = unwrap(await dbNoRLS.from('agenda_events').select('title').eq('id', event.id));
		expect(updated.title).toBe('Staff updated title');

		await staffOneDb.from('agenda_events').delete().eq('id', event.id);
	});
});

describe('agenda_events DELETE RLS', () => {
	it('owner can delete their own event', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);

		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert(createManualEventInsert(staffOneUserId, 'Test event to delete'))
				.select('id'),
		);

		unwrap(await staffDb.from('agenda_events').delete().eq('id', event.id));

		const { data: remaining } = await dbNoRLS.from('agenda_events').select('id').eq('id', event.id);
		expect(remaining?.length).toBe(0);
	});

	it('non-owner non-privileged cannot delete event they do not own', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const studentDb = await createClientAs(TestUsers.STUDENT_001);

		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert(createManualEventInsert(staffOneUserId, 'Test event no delete'))
				.select('id'),
		);

		const deleteResult = await studentDb.from('agenda_events').delete().eq('id', event.id);

		expect(deleteResult.error).toBeNull();

		const { data: stillExists } = await dbNoRLS.from('agenda_events').select('id').eq('id', event.id);
		expect(stillExists?.length).toBe(1);

		await staffDb.from('agenda_events').delete().eq('id', event.id);
	});

	it('privileged user (admin) can delete any event', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const adminDb = await createClientAs(TestUsers.ADMIN_ONE);

		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert(createManualEventInsert(staffOneUserId, 'Test event admin can delete'))
				.select('id'),
		);

		unwrap(await adminDb.from('agenda_events').delete().eq('id', event.id));

		const { data: deleted } = await dbNoRLS.from('agenda_events').select('id').eq('id', event.id);
		expect(deleted?.length).toBe(0);
	});

	it('privileged user (site_admin) can delete any event', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);
		const siteAdminDb = await createClientAs(TestUsers.SITE_ADMIN);

		const [event] = unwrap(
			await staffDb
				.from('agenda_events')
				.insert(createManualEventInsert(staffOneUserId, 'Test event site_admin can delete'))
				.select('id'),
		);

		unwrap(await siteAdminDb.from('agenda_events').delete().eq('id', event.id));

		const { data: deleted } = await dbNoRLS.from('agenda_events').select('id').eq('id', event.id);
		expect(deleted?.length).toBe(0);
	});
});
