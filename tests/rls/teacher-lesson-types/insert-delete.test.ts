import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { TeacherLessonTypeInsert } from '../types';

const dbNoRLS = createClientBypassRLS();

const aliceTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);
const bobTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);
const guitarLessonTypeId = fixtures.requireLessonTypeId('Gitaar');
// Alice already has Gitaar, Drums, and Zang in seed.sql
// Bob already has Bas and Keyboard in seed.sql
// Use Saxofoon for tests - Alice doesn't have it
const saxofoonLessonTypeId = fixtures.requireLessonTypeId('Saxofoon');
// Use Drums for Bob - Bob doesn't have it
const drumsLessonTypeId = fixtures.requireLessonTypeId('Drums');

/**
 * Teacher Lesson Types INSERT/DELETE permissions:
 *
 * ADMIN/SITE_ADMIN:
 * - Can insert/delete lesson type links for any teacher
 *
 * TEACHERS:
 * - Cannot insert/delete lesson type links (only SELECT)
 *
 * STAFF:
 * - Cannot insert/delete lesson type links (only SELECT)
 *
 * OTHER USERS:
 * - Cannot insert/delete lesson type links
 */
describe('RLS: teacher_lesson_types INSERT - blocked for non-admin roles', () => {
	const newLink: TeacherLessonTypeInsert = {
		teacher_id: aliceTeacherId,
		lesson_type_id: saxofoonLessonTypeId,
	};

	it('user without role cannot insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('student cannot insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher cannot insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('staff cannot insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: teacher_lesson_types INSERT - admin permissions', () => {
	it('admin can insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const newLink: TeacherLessonTypeInsert = {
			teacher_id: aliceTeacherId,
			lesson_type_id: saxofoonLessonTypeId,
		};

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.teacher_id).toBe(aliceTeacherId);
		expect(data?.[0]?.lesson_type_id).toBe(saxofoonLessonTypeId);

		// Cleanup
		if (data?.[0]) {
			await dbNoRLS
				.from('teacher_lesson_types')
				.delete()
				.eq('teacher_id', data[0].teacher_id)
				.eq('lesson_type_id', data[0].lesson_type_id);
		}
	});

	it('site_admin can insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const newLink: TeacherLessonTypeInsert = {
			teacher_id: bobTeacherId,
			lesson_type_id: drumsLessonTypeId, // Use Drums - not in seed for Bob
		};

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		// Cleanup
		if (data?.[0]) {
			await dbNoRLS
				.from('teacher_lesson_types')
				.delete()
				.eq('teacher_id', data[0].teacher_id)
				.eq('lesson_type_id', data[0].lesson_type_id);
		}
	});
});

describe('RLS: teacher_lesson_types DELETE - blocked for non-admin roles', () => {
	it('user without role cannot delete lesson type link', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db
			.from('teacher_lesson_types')
			.delete()
			.eq('teacher_id', aliceTeacherId)
			.eq('lesson_type_id', guitarLessonTypeId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete lesson type link', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('teacher_lesson_types')
			.delete()
			.eq('teacher_id', aliceTeacherId)
			.eq('lesson_type_id', guitarLessonTypeId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete lesson type link', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db
			.from('teacher_lesson_types')
			.delete()
			.eq('teacher_id', aliceTeacherId)
			.eq('lesson_type_id', guitarLessonTypeId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: teacher_lesson_types DELETE - admin permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('admin can delete lesson type link', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Create a test link to delete (use Saxofoon - not in seed for Alice)
		const insertResult = await dbNoRLS
			.from('teacher_lesson_types')
			.insert({
				teacher_id: aliceTeacherId,
				lesson_type_id: saxofoonLessonTypeId,
			})
			.select();

		if (insertResult.error) {
			throw insertResult.error;
		}

		const { data, error } = await db
			.from('teacher_lesson_types')
			.delete()
			.eq('teacher_id', aliceTeacherId)
			.eq('lesson_type_id', saxofoonLessonTypeId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
	});

	it('site_admin can delete lesson type link', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Create a test link to delete (use Drums - not in seed for Bob)
		const insertResult = await dbNoRLS
			.from('teacher_lesson_types')
			.insert({
				teacher_id: bobTeacherId,
				lesson_type_id: drumsLessonTypeId,
			})
			.select();

		if (insertResult.error) {
			throw insertResult.error;
		}

		const { data, error } = await db
			.from('teacher_lesson_types')
			.delete()
			.eq('teacher_id', bobTeacherId)
			.eq('lesson_type_id', drumsLessonTypeId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
	});
});
