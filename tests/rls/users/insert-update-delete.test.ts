import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import { setupDatabaseStateVerification, type DatabaseState } from '../db-state';

const dbNoRLS = createClientBypassRLS();
const { requireUserId, requireProfile } = fixtures;

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

/**
 * Users without role, teacher, or student permissions:
 *
 * These users (USER_A, USER_B) have:
 * - No role in user_roles table
 * - No record in teachers table
 * - No record in students table
 *
 * They should only be able to:
 * - Update their own profile
 *
 * They should NOT be able to:
 * - Insert/update/delete any data except their own profile
 */
describe('RLS: users without role/teacher/student - INSERT/UPDATE/DELETE', () => {
	describe('profiles table', () => {
		it('USER_A can update own profile', async () => {
			const db = await createClientAs(TestUsers.USER_001);
			const ownProfile = requireProfile(TestUsers.USER_001);
			const newFirstName = 'Updated';

			const { data, error } = await db
				.from('profiles')
				.update({ first_name: newFirstName })
				.eq('user_id', ownProfile.user_id)
				.select();

			expect(error).toBeNull();
			expect(data).toHaveLength(1);
			expect(data?.[0]?.first_name).toBe(newFirstName);

			// Restore original
			await db.from('profiles').update({ first_name: ownProfile.first_name }).eq('user_id', ownProfile.user_id);
		});

		it('USER_A cannot update other profiles', async () => {
			const db = await createClientAs(TestUsers.USER_001);
			const otherProfile = requireProfile(TestUsers.USER_002);

			const { data, error } = await db
				.from('profiles')
				.update({ first_name: 'Hacked' })
				.eq('user_id', otherProfile.user_id)
				.select();

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('USER_A cannot insert profiles', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db
				.from('profiles')
				.insert({
					user_id: '00000000-0000-0000-0000-999999999999',
					email: 'hacked@test.nl',
				})
				.select();

			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});

		it('USER_A cannot delete profiles', async () => {
			const db = await createClientAs(TestUsers.USER_001);
			const otherProfile = requireProfile(TestUsers.USER_002);

			const { data, error } = await db.from('profiles').delete().eq('user_id', otherProfile.user_id).select();

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('students table', () => {
		it('USER_A cannot insert students', async () => {
			const db = await createClientAs(TestUsers.USER_001);
			const ownUserId = requireUserId(TestUsers.USER_001);

			const { data, error } = await db.from('students').insert({ user_id: ownUserId }).select();

			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});
	});

	describe('teachers table', () => {
		it('USER_A cannot insert teachers', async () => {
			const db = await createClientAs(TestUsers.USER_001);
			const ownUserId = requireUserId(TestUsers.USER_001);

			const { data, error } = await db.from('teachers').insert({ user_id: ownUserId }).select();

			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});
	});

	describe('lesson_agreements table', () => {
		it('USER_A cannot insert lesson agreements', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			// Get valid IDs using bypass RLS
			const { data: student } = await dbNoRLS.from('students').select('id').limit(1).single();
			const { data: teacher } = await dbNoRLS.from('teachers').select('id').limit(1).single();
			const { data: lessonType } = await dbNoRLS.from('lesson_types').select('id').limit(1).single();

			if (!student || !teacher || !lessonType) {
				throw new Error('Failed to get test data');
			}

			const { data, error } = await db
				.from('lesson_agreements')
				.insert({
					student_id: student.id,
					teacher_id: teacher.id,
					lesson_type_id: lessonType.id,
					day_of_week: 1,
					start_time: '14:00',
					start_date: new Date().toISOString().split('T')[0],
					is_active: true,
				})
				.select();

			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});
	});

	describe('lesson_types table', () => {
		it('USER_A cannot insert lesson types', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db
				.from('lesson_types')
				.insert({
					name: 'Hacked Type',
					icon: 'test',
					color: '#FF0000',
					duration_minutes: 30,
					frequency: 'weekly',
					price_per_lesson: 25.0,
				})
				.select();

			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});
	});

	describe('user_roles table', () => {
		it('USER_A cannot insert user roles', async () => {
			const db = await createClientAs(TestUsers.USER_001);
			const ownUserId = requireUserId(TestUsers.USER_001);

			const { data, error } = await db.from('user_roles').insert({ user_id: ownUserId, role: 'staff' }).select();

			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});
	});
});
