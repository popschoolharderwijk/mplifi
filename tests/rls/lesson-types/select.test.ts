import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

/**
 * Lesson types SELECT permissions:
 *
 * All authenticated users (including users without role) can view all lesson types.
 * This is public reference data that everyone needs to see.
 */
describe('RLS: lesson_types SELECT', () => {
	it('site_admin sees all lesson types', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allLessonTypes.length);
	});

	it('admin sees all lesson types', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allLessonTypes.length);
	});

	it('staff sees all lesson types', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allLessonTypes.length);
	});

	it('teacher without role sees all lesson types', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allLessonTypes.length);
	});

	it('student without role sees all lesson types', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allLessonTypes.length);
	});

	it('user without role sees all lesson types', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.from('lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allLessonTypes.length);
	});
});
