/**
 * RLS tests for agenda_events SELECT policy.
 *
 * Visibility rules:
 * - Participants can see events they participate in
 * - Privileged users (site_admin, admin, staff) can see all events
 * - Non-participants cannot see events they don't participate in
 *
 * Seed data (deterministic):
 * - "Projectoverleg" event: teacher-alice + student-012
 * - "Lesoverleg" event: teacher-eve + student-001
 * - "Vergadering" event: site-admin, admin-one, staff-one (no students)
 * - Various other privileged-only events
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { expectNonNull } from '../../utils';
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

describe('agenda_events SELECT RLS', () => {
	it('participant can see event they participate in (student-001 in Lesoverleg)', async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_001);
		const studentUserId = fixtures.requireUserId(TestUsers.STUDENT_001);

		// student-001 participates in "Lesoverleg" event per seed.sql
		const { data: participantEvents } = await dbNoRLS
			.from('agenda_participants')
			.select('event_id')
			.eq('user_id', studentUserId);

		expectNonNull(participantEvents);
		expect(participantEvents.length).toBeGreaterThan(0);

		const eventId = participantEvents[0].event_id;

		const { data: events, error } = await studentDb.from('agenda_events').select('id').eq('id', eventId);

		expect(error).toBeNull();
		expect(events?.length).toBe(1);
		expect(events?.[0].id).toBe(eventId);
	});

	it('participant can see event they participate in (student-012 in Projectoverleg)', async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_012);
		const studentUserId = fixtures.requireUserId(TestUsers.STUDENT_012);

		// student-012 participates in "Projectoverleg" event per seed.sql
		const { data: participantEvents } = await dbNoRLS
			.from('agenda_participants')
			.select('event_id')
			.eq('user_id', studentUserId);

		expectNonNull(participantEvents);
		expect(participantEvents.length).toBeGreaterThan(0);

		const eventId = participantEvents[0].event_id;

		const { data: events, error } = await studentDb.from('agenda_events').select('id').eq('id', eventId);

		expect(error).toBeNull();
		expect(events?.length).toBe(1);
		expect(events?.[0].id).toBe(eventId);
	});

	it('non-participant student cannot see events they do not participate in', async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_002);
		const studentUserId = fixtures.requireUserId(TestUsers.STUDENT_002);

		// student-002 does NOT participate in any manual events per seed.sql
		// Get all manual events
		const { data: allManualEvents } = await dbNoRLS.from('agenda_events').select('id').eq('source_type', 'manual');

		expectNonNull(allManualEvents);
		expect(allManualEvents.length).toBeGreaterThan(0);

		// Verify student-002 has no participations
		const { data: studentParticipations } = await dbNoRLS
			.from('agenda_participants')
			.select('event_id')
			.eq('user_id', studentUserId);

		const participatingEventIds = new Set(studentParticipations?.map((p) => p.event_id) ?? []);
		const nonParticipatingEvents = allManualEvents.filter((e) => !participatingEventIds.has(e.id));

		expect(nonParticipatingEvents.length).toBeGreaterThan(0);

		// Student should NOT be able to see any of these non-participating events
		const nonParticipatingEventId = nonParticipatingEvents[0].id;

		const { data: events, error } = await studentDb
			.from('agenda_events')
			.select('id')
			.eq('id', nonParticipatingEventId);

		expect(error).toBeNull();
		expect(events?.length).toBe(0);
	});

	it('privileged user (staff) can see all events', async () => {
		const staffDb = await createClientAs(TestUsers.STAFF_ONE);

		const { data: allEvents } = await dbNoRLS.from('agenda_events').select('id');
		const { data: staffEvents, error } = await staffDb.from('agenda_events').select('id');

		expect(error).toBeNull();
		expectNonNull(allEvents);
		expect(allEvents.length).toBeGreaterThan(0);
		expect(staffEvents?.length).toBe(allEvents.length);
	});

	it('privileged user (admin) can see all events', async () => {
		const adminDb = await createClientAs(TestUsers.ADMIN_ONE);

		const { data: allEvents } = await dbNoRLS.from('agenda_events').select('id');
		const { data: adminEvents, error } = await adminDb.from('agenda_events').select('id');

		expect(error).toBeNull();
		expectNonNull(allEvents);
		expect(allEvents.length).toBeGreaterThan(0);
		expect(adminEvents?.length).toBe(allEvents.length);
	});

	it('privileged user (site_admin) can see all events', async () => {
		const siteAdminDb = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: allEvents } = await dbNoRLS.from('agenda_events').select('id');
		const { data: siteAdminEvents, error } = await siteAdminDb.from('agenda_events').select('id');

		expect(error).toBeNull();
		expectNonNull(allEvents);
		expect(allEvents.length).toBeGreaterThan(0);
		expect(siteAdminEvents?.length).toBe(allEvents.length);
	});

	it('teacher can see their own lesson_agreement-backed events', async () => {
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);
		const teacherUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		// Verify teacher-alice has lesson_agreement events (created from agreements)
		const { data: teacherLessonEvents } = await dbNoRLS
			.from('agenda_events')
			.select('id')
			.eq('source_type', 'lesson_agreement')
			.eq('owner_user_id', teacherUserId);

		expectNonNull(teacherLessonEvents);
		expect(teacherLessonEvents.length).toBeGreaterThan(0);

		// Teacher should be able to see their lesson events
		const { data: events, error } = await teacherDb
			.from('agenda_events')
			.select('id, owner_user_id, source_type')
			.eq('source_type', 'lesson_agreement')
			.eq('owner_user_id', teacherUserId);

		expect(error).toBeNull();
		expect(events?.length).toBe(teacherLessonEvents.length);
	});

	it('student can see lesson_agreement events where they are participant', async () => {
		const studentDb = await createClientAs(TestUsers.STUDENT_001);
		const studentUserId = fixtures.requireUserId(TestUsers.STUDENT_001);

		// student-001 should have lesson_agreement participations (from lesson_agreements seed)
		const { data: lessonParticipations } = await dbNoRLS
			.from('agenda_participants')
			.select('event_id, agenda_events!inner(source_type)')
			.eq('user_id', studentUserId);

		const lessonAgreementParticipations = lessonParticipations?.filter(
			(p) => (p.agenda_events as { source_type: string })?.source_type === 'lesson_agreement',
		);

		expectNonNull(lessonAgreementParticipations);
		expect(lessonAgreementParticipations.length).toBeGreaterThan(0);

		// Student should be able to see their lesson_agreement events
		const { data: events, error } = await studentDb
			.from('agenda_events')
			.select('id')
			.eq('source_type', 'lesson_agreement');

		expect(error).toBeNull();
		expectNonNull(events);
		expect(events.length).toBeGreaterThan(0);
	});

	it('owner can see their own events even without being a participant', async () => {
		// Test that the SELECT policy allows owner_user_id = auth.uid()
		const teacherDb = await createClientAs(TestUsers.TEACHER_ALICE);
		const teacherUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		// Get events where teacher is owner (lesson_agreement events)
		const { data: ownedEvents, error } = await teacherDb
			.from('agenda_events')
			.select('id, owner_user_id')
			.eq('owner_user_id', teacherUserId);

		expect(error).toBeNull();
		expectNonNull(ownedEvents);
		expect(ownedEvents.length).toBeGreaterThan(0);
		expect(ownedEvents.every((e) => e.owner_user_id === teacherUserId)).toBe(true);
	});
});
