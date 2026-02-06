import { describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { TestUsers } from '../test-users';

// Get ground truth: all lesson types from seed data
const dbNoRLS = createClientBypassRLS();
const { data: allLessonTypes, error: lessonTypesError } = await dbNoRLS.from('lesson_types').select('*');

if (lessonTypesError || !allLessonTypes) {
	throw new Error(`Failed to fetch lesson types: ${lessonTypesError?.message}`);
}

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
		expect(data).toHaveLength(allLessonTypes.length);
	});

	it('admin sees all lesson types', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allLessonTypes.length);
	});

	it('staff sees all lesson types', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allLessonTypes.length);
	});

	it('teacher sees all lesson types', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allLessonTypes.length);
	});

	it('user without role sees all lesson types', async () => {
		const db = await createClientAs(TestUsers.USER_A);

		const { data, error } = await db.from('lesson_types').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allLessonTypes.length);
	});
});
