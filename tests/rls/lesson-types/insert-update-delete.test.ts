import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { TestUsers } from '../test-users';
import type { LessonTypeInsert } from '../types';
import { setupDatabaseStateVerification, type DatabaseState } from '../db-state';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

/**
 * Lesson types INSERT/UPDATE/DELETE permissions:
 *
 * ADMINS and SITE_ADMINS:
 * - Can insert lesson types
 * - Can update lesson types
 * - Can delete lesson types
 *
 * All other roles (staff, user without role) cannot insert, update, or delete lesson types.
 * Note: Teachers are identified by the teachers table, not by a role.
 */

describe('RLS: lesson_types INSERT - blocked for non-admin roles', () => {
	const newLessonType: LessonTypeInsert = {
		name: 'Test Lesson Type',
		description: 'Test description',
		icon: 'test-icon',
		color: '#FF0000',
		duration_minutes: 30,
		frequency: 'weekly' as const,
		price_per_lesson: 25.0,
		is_group_lesson: false,
		is_active: true,
	};

	it('user without role cannot insert lesson type', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('lesson_types').insert(newLessonType).select();

		// Should fail - no INSERT policy for regular users
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher cannot insert lesson type', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('lesson_types').insert(newLessonType).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('staff cannot insert lesson type', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('lesson_types').insert(newLessonType).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: lesson_types INSERT - admin permissions', () => {
	const newLessonType: LessonTypeInsert = {
		name: 'Admin Test Lesson Type',
		description: 'Test description',
		icon: 'test-icon',
		color: '#00FF00',
		duration_minutes: 45,
		frequency: 'weekly' as const,
		price_per_lesson: 30.0,
		is_group_lesson: false,
		is_active: true,
	};

	it('admin can insert lesson type', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('lesson_types').insert(newLessonType).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.name).toBe(newLessonType.name);

		// Cleanup
		if (data?.[0]?.id) {
			await db.from('lesson_types').delete().eq('id', data[0].id);
		}
	});

	it('site_admin can insert lesson type', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('lesson_types').insert(newLessonType).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.name).toBe(newLessonType.name);

		// Cleanup
		if (data?.[0]?.id) {
			await db.from('lesson_types').delete().eq('id', data[0].id);
		}
	});
});

describe('RLS: lesson_types UPDATE - blocked for non-admin roles', () => {
	it('user without role cannot update lesson type', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		// Get first lesson type to try updating
		const { data: lessonTypes } = await db.from('lesson_types').select('id').limit(1);
		if (!lessonTypes || lessonTypes.length === 0) {
			throw new Error('No lesson types found for test');
		}

		const { data, error } = await db
			.from('lesson_types')
			.update({ name: 'Hacked Name' })
			.eq('id', lessonTypes[0].id)
			.select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot update lesson type', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data: lessonTypes } = await db.from('lesson_types').select('id').limit(1);
		if (!lessonTypes || lessonTypes.length === 0) {
			throw new Error('No lesson types found for test');
		}

		const { data, error } = await db
			.from('lesson_types')
			.update({ name: 'Hacked Name' })
			.eq('id', lessonTypes[0].id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot update lesson type', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data: lessonTypes } = await db.from('lesson_types').select('id').limit(1);
		if (!lessonTypes || lessonTypes.length === 0) {
			throw new Error('No lesson types found for test');
		}

		const { data, error } = await db
			.from('lesson_types')
			.update({ name: 'Hacked Name' })
			.eq('id', lessonTypes[0].id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: lesson_types UPDATE - admin permissions', () => {
	it('admin can update lesson type', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Get first lesson type to update
		const { data: lessonTypes } = await db.from('lesson_types').select('*').limit(1);
		if (!lessonTypes || lessonTypes.length === 0) {
			throw new Error('No lesson types found for test');
		}

		const originalLessonType = lessonTypes[0];
		const newName = 'Updated by Admin';

		// Update
		const { data, error } = await db
			.from('lesson_types')
			.update({ name: newName })
			.eq('id', originalLessonType.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.name).toBe(newName);

		// Restore original name
		await db.from('lesson_types').update({ name: originalLessonType.name }).eq('id', originalLessonType.id);
	});

	it('site_admin can update lesson type', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: lessonTypes } = await db.from('lesson_types').select('*').limit(1);
		if (!lessonTypes || lessonTypes.length === 0) {
			throw new Error('No lesson types found for test');
		}

		const originalLessonType = lessonTypes[0];
		const newName = 'Updated by Site Admin';

		// Update
		const { data, error } = await db
			.from('lesson_types')
			.update({ name: newName })
			.eq('id', originalLessonType.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.name).toBe(newName);

		// Restore original name
		await db.from('lesson_types').update({ name: originalLessonType.name }).eq('id', originalLessonType.id);
	});
});

describe('RLS: lesson_types DELETE - blocked for non-admin roles', () => {
	it('user without role cannot delete lesson type', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data: lessonTypes } = await db.from('lesson_types').select('id').limit(1);
		if (!lessonTypes || lessonTypes.length === 0) {
			throw new Error('No lesson types found for test');
		}

		const { data, error } = await db.from('lesson_types').delete().eq('id', lessonTypes[0].id).select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete lesson type', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data: lessonTypes } = await db.from('lesson_types').select('id').limit(1);
		if (!lessonTypes || lessonTypes.length === 0) {
			throw new Error('No lesson types found for test');
		}

		const { data, error } = await db.from('lesson_types').delete().eq('id', lessonTypes[0].id).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete lesson type', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data: lessonTypes } = await db.from('lesson_types').select('id').limit(1);
		if (!lessonTypes || lessonTypes.length === 0) {
			throw new Error('No lesson types found for test');
		}

		const { data, error } = await db.from('lesson_types').delete().eq('id', lessonTypes[0].id).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: lesson_types DELETE - admin permissions', () => {
	it('admin can delete lesson type', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Create a lesson type to delete
		const newLessonType: LessonTypeInsert = {
			name: 'Temporary Lesson Type for Delete Test',
			description: 'Will be deleted',
			icon: 'test-icon',
			color: '#0000FF',
			duration_minutes: 30,
			frequency: 'weekly' as const,
			price_per_lesson: 20.0,
			is_group_lesson: false,
			is_active: true,
		};

		const { data: inserted, error: insertError } = await db.from('lesson_types').insert(newLessonType).select();
		expect(insertError).toBeNull();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert lesson type');
		}

		const lessonTypeId = inserted[0].id;

		// Delete
		const { data, error } = await db.from('lesson_types').delete().eq('id', lessonTypeId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(lessonTypeId);
	});

	it('site_admin can delete lesson type', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Create a lesson type to delete
		const newLessonType: LessonTypeInsert = {
			name: 'Temporary Lesson Type for Site Admin Delete Test',
			description: 'Will be deleted',
			icon: 'test-icon',
			color: '#FFFF00',
			duration_minutes: 30,
			frequency: 'weekly' as const,
			price_per_lesson: 20.0,
			is_group_lesson: false,
			is_active: true,
		};

		const { data: inserted, error: insertError } = await db.from('lesson_types').insert(newLessonType).select();
		expect(insertError).toBeNull();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert lesson type');
		}

		const lessonTypeId = inserted[0].id;

		// Delete
		const { data, error } = await db.from('lesson_types').delete().eq('id', lessonTypeId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(lessonTypeId);
	});
});
