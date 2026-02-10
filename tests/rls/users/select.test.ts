import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { requireProfile } = fixtures;

/**
 * Users without role, teacher, or student permissions:
 *
 * These users (USER_A, USER_B) have:
 * - No role in user_roles table
 * - No record in teachers table
 * - No record in students table
 *
 * They should only be able to:
 * - View their own profile
 *
 * They should NOT be able to:
 * - View staff, teachers, students, lesson_agreements, lesson_types, user_roles
 */
describe('RLS: users without role/teacher/student - SELECT', () => {
	describe('profiles table', () => {
		it('USER_A can see only own profile', async () => {
			const db = await createClientAs(TestUsers.USER_001);
			const ownProfile = requireProfile(TestUsers.USER_001);

			const { data, error } = await db.from('profiles').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(1);
			expect(data?.[0]?.user_id).toBe(ownProfile.user_id);
			expect(data?.[0]?.email).toBe(TestUsers.USER_001);
		});

		it('USER_A cannot see other profiles', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('profiles').select('*').eq('email', TestUsers.USER_002);

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('USER_A cannot see student profiles', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('profiles').select('*').eq('email', TestUsers.STUDENT_001);

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('USER_A cannot see teacher profiles', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('profiles').select('*').eq('email', TestUsers.TEACHER_ALICE);

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('USER_A cannot see staff/admin profiles', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('profiles').select('*').eq('email', TestUsers.STAFF_ONE);

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('students table', () => {
		it('USER_A cannot see any students', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('students').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('teachers table', () => {
		it('USER_A cannot see any teachers', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('teachers').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('lesson_agreements table', () => {
		it('USER_A cannot see any lesson agreements', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('lesson_agreements').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('lesson_types table', () => {
		it('USER_A can see all lesson types (public reference data)', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('lesson_types').select('*');

			expect(error).toBeNull();
			// Lesson types are public reference data - all authenticated users can see them
			expect(data).not.toHaveLength(0);
		});
	});

	describe('user_roles table', () => {
		it('USER_A cannot see any user roles', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('user_roles').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('teacher_viewed_by_student view', () => {
		it('USER_A cannot see any teachers via view', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('teacher_viewed_by_student').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});
});
