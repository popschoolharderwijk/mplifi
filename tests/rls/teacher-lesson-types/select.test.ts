import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

// Setup: Use seed data (from supabase/seed.sql)
const aliceTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);
const bobTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);

/**
 * Teacher Lesson Types SELECT permissions:
 *
 * TEACHERS:
 * - Can view their own lesson type links only
 *
 * STAFF/ADMIN/SITE_ADMIN:
 * - Can view all lesson type links
 *
 * OTHER USERS (students, users without role):
 * - Cannot view any lesson type links
 */
describe('RLS: teacher_lesson_types SELECT', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});
	it('site_admin sees all lesson type links', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('teacher_lesson_types').select('*');

		expect(error).toBeNull();
		expect(data?.length).toBeGreaterThanOrEqual(3);
	});

	it('admin sees all lesson type links', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('teacher_lesson_types').select('*');

		expect(error).toBeNull();
		expect(data?.length).toBeGreaterThanOrEqual(3);
	});

	it('staff sees all lesson type links', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('teacher_lesson_types').select('*');

		expect(error).toBeNull();
		expect(data?.length).toBeGreaterThanOrEqual(3);
	});

	it('teacher can see only their own lesson type links', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_lesson_types').select('*');

		expect(error).toBeNull();
		// Alice has 3 lesson types (Gitaar, Drums, Zang) from seed.sql
		expect(data?.length).toBe(3);
		expect(data?.every((lt) => lt.teacher_id === aliceTeacherId)).toBe(true);
	});

	it('teacher cannot see other teachers lesson type links', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_lesson_types').select('*').eq('teacher_id', bobTeacherId);

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('student cannot see any lesson type links', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teacher_lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('user without role cannot see any lesson type links', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.from('teacher_lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
