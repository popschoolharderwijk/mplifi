import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

// Setup: Use seed data (from supabase/seed.sql)
const aliceTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);
const bobTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);

/**
 * Teacher Availability SELECT permissions:
 *
 * TEACHERS:
 * - Can view their own availability only
 *
 * STAFF/ADMIN/SITE_ADMIN:
 * - Can view all availability
 *
 * OTHER USERS (students, users without role):
 * - Cannot view any availability
 */
describe('RLS: teacher_availability SELECT', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});
	it('site_admin sees all availability', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('teacher_availability').select('*');

		expect(error).toBeNull();
		expect(data?.length).toBeGreaterThanOrEqual(3);
	});

	it('admin sees all availability', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('teacher_availability').select('*');

		expect(error).toBeNull();
		expect(data?.length).toBeGreaterThanOrEqual(3);
	});

	it('staff sees all availability', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('teacher_availability').select('*');

		expect(error).toBeNull();
		expect(data?.length).toBeGreaterThanOrEqual(3);
	});

	it('teacher can see only their own availability', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_availability').select('*');

		expect(error).toBeNull();
		expect(data?.length).toBe(2);
		expect(data?.every((a) => a.teacher_id === aliceTeacherId)).toBe(true);
	});

	it('teacher cannot see other teachers availability', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_availability').select('*').eq('teacher_id', bobTeacherId);

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('student cannot see any availability', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teacher_availability').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('user without role cannot see any availability', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.from('teacher_availability').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
