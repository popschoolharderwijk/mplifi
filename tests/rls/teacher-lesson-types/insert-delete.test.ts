import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import type { TeacherLessonTypeInsert } from '../../types';
import { expectError, expectNoError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const dbNoRLS = createClientBypassRLS();

const aliceTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);
const bobTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);
const guitarLessonTypeId = fixtures.requireLessonTypeId('Gitaarles');
// Alice already has Gitaar, Drums, and Zang in seed.sql
// Bob already has Bas and Keyboard in seed.sql
// Use Sax for tests - Alice doesn't have it
const saxLessonTypeId = fixtures.requireLessonTypeId('Saxofoonles');
// Use Drums for Bob - Bob doesn't have it
const drumsLessonTypeId = fixtures.requireLessonTypeId('Drumles');

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
		lesson_type_id: saxLessonTypeId,
	};

	it('user without role cannot insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expectError(data, error);
	});

	it('student cannot insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expectError(data, error);
	});

	it('teacher cannot insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expectError(data, error);
	});

	it('staff cannot insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expectError(data, error);
	});
});

describe('RLS: teacher_lesson_types INSERT - admin permissions', () => {
	it('admin can insert lesson type link', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const newLink: TeacherLessonTypeInsert = {
			teacher_id: aliceTeacherId,
			lesson_type_id: saxLessonTypeId,
		};

		const { data, error } = await db.from('teacher_lesson_types').insert(newLink).select();

		expectNoError(data, error);
		expect(data).toHaveLength(1);
		expect(data[0]?.teacher_id).toBe(aliceTeacherId);
		expect(data[0]?.lesson_type_id).toBe(saxLessonTypeId);

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

		expectNoError(data, error);
		expect(data).toHaveLength(1);

		// Cleanup
		await dbNoRLS
			.from('teacher_lesson_types')
			.delete()
			.eq('teacher_id', data[0].teacher_id)
			.eq('lesson_type_id', data[0].lesson_type_id);
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
				lesson_type_id: saxLessonTypeId,
			})
			.select();

		if (insertResult.error) {
			throw insertResult.error;
		}

		const { data, error } = await db
			.from('teacher_lesson_types')
			.delete()
			.eq('teacher_id', aliceTeacherId)
			.eq('lesson_type_id', saxLessonTypeId)
			.select();

		expectNoError(data, error);
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

		expectNoError(data, error);
		expect(data).toHaveLength(1);
	});
});

/**
 * TRIGGER: teacher_lesson_types DELETE - blocked when agreements exist
 * A teacher_lesson_type can only be deleted if there are no lesson agreements
 * using that teacher + lesson_type combination.
 */
describe('TRIGGER: teacher_lesson_types DELETE - blocked when agreements exist', () => {
	const teacherId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);
	const lessonTypeId = fixtures.requireLessonTypeId('Gitaarles');

	it('admin cannot delete teacher_lesson_type when agreement exists for that combination', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Student 009 already has an agreement with Alice for Gitaar (see fixtures)
		// Try to delete Alice's link to Gitaar - should fail
		const { data, error } = await db
			.from('teacher_lesson_types')
			.delete()
			.eq('teacher_id', teacherId)
			.eq('lesson_type_id', lessonTypeId)
			.select();

		// Trigger should block the delete
		expectError(data, error);
		expect(error.message).toContain('Cannot remove lesson type from teacher');
	});

	it('admin can delete teacher_lesson_type when no agreement exists for that combination', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Alice has Zang in seed - no student has an agreement for Zang
		const lessonTypeId = fixtures.requireLessonTypeId('Zangles');

		// Try to delete - should succeed because no agreement exists for Zang + Alice
		const { data, error } = await db
			.from('teacher_lesson_types')
			.delete()
			.eq('teacher_id', teacherId)
			.eq('lesson_type_id', lessonTypeId)
			.select();

		expectNoError(data, error);
		expect(data).toHaveLength(1);

		// Restore the link
		await dbNoRLS.from('teacher_lesson_types').insert({
			teacher_id: teacherId,
			lesson_type_id: lessonTypeId,
		});
	});
});
