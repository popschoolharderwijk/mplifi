import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { PostgresErrorCodes } from '../../../src/integrations/supabase/errorcodes';
import { createClientAs } from '../../db';
import type { LessonTypeInsert } from '../../types';
import { unwrap, unwrapError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import type { TestUser } from '../test-users';
import { TestUsers } from '../test-users';

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

// Use a specific lesson type from fixtures for deterministic tests
const TEST_LESSON_TYPE_ID = fixtures.requireLessonTypeId('Gitaarles');

// Helper for INSERT that should fail (blocked by RLS)
async function expectInsertBlocked(user: TestUser, lessonType: LessonTypeInsert) {
	const db = await createClientAs(user);
	const error = unwrapError(await db.from('lesson_types').insert(lessonType).select());

	expect(error.code).toBe(PostgresErrorCodes.INSUFFICIENT_PRIVILEGE);
}

// Helper for UPDATE that should fail (blocked by RLS)
async function expectUpdateBlocked(user: TestUser, lessonTypeId: string) {
	const db = await createClientAs(user);
	const data = unwrap(await db.from('lesson_types').update({ name: 'Hacked Name' }).eq('id', lessonTypeId).select());

	// RLS blocks - 0 rows affected
	expect(data).toHaveLength(0);
}

// Helper for DELETE that should fail (blocked by RLS)
async function expectDeleteBlocked(user: TestUser, lessonTypeId: string) {
	const db = await createClientAs(user);
	const data = unwrap(await db.from('lesson_types').delete().eq('id', lessonTypeId).select());

	// RLS blocks - 0 rows affected
	expect(data).toHaveLength(0);
}

// Helper for successful INSERT with automatic cleanup
async function insertLessonType(user: TestUser, lessonType: LessonTypeInsert) {
	const db = await createClientAs(user);
	const [data] = unwrap(await db.from('lesson_types').insert(lessonType).select());
	expect(data.name).toBe(lessonType.name);

	return {
		data,
		cleanup: async () => {
			unwrap(await db.from('lesson_types').delete().eq('id', data.id));
		},
	};
}

// Helper for successful UPDATE with automatic restore
async function updateLessonType(
	user: TestUser,
	lessonTypeId: string,
	updates: Partial<LessonTypeInsert>,
	originalValues: Partial<LessonTypeInsert>,
) {
	const db = await createClientAs(user);
	const data = unwrap(await db.from('lesson_types').update(updates).eq('id', lessonTypeId).select());
	expect(data).toHaveLength(1);

	// Restore original values
	unwrap(await db.from('lesson_types').update(originalValues).eq('id', lessonTypeId));

	return data[0];
}

// Helper for successful DELETE (insert + delete in one)
async function deleteLessonType(user: TestUser, lessonType: LessonTypeInsert) {
	const db = await createClientAs(user);

	const [inserted] = unwrap(await db.from('lesson_types').insert(lessonType).select());

	const data = unwrap(await db.from('lesson_types').delete().eq('id', inserted.id).select());
	expect(data).toHaveLength(1);
	expect(data[0].id).toBe(inserted.id);
}

describe('RLS: lesson_types INSERT - blocked for non-admin roles', () => {
	const newLessonType: LessonTypeInsert = {
		name: 'Test Lesson Type',
		description: 'Test description',
		icon: 'test-icon',
		color: '#FF0000',
		is_group_lesson: false,
		is_active: true,
	};

	it('user without role cannot insert lesson type', async () => {
		await expectInsertBlocked(TestUsers.STUDENT_001, newLessonType);
	});

	it('teacher cannot insert lesson type', async () => {
		await expectInsertBlocked(TestUsers.TEACHER_ALICE, newLessonType);
	});

	it('staff cannot insert lesson type', async () => {
		await expectInsertBlocked(TestUsers.STAFF_ONE, newLessonType);
	});
});

describe('RLS: lesson_types INSERT - admin permissions', () => {
	const newLessonType: LessonTypeInsert = {
		name: 'Admin Test Lesson Type',
		description: 'Test description',
		icon: 'test-icon',
		color: '#00FF00',
		is_group_lesson: false,
		is_active: true,
	};

	it('admin can insert lesson type', async () => {
		const { cleanup } = await insertLessonType(TestUsers.ADMIN_ONE, newLessonType);
		await cleanup();
	});

	it('site_admin can insert lesson type', async () => {
		const { cleanup } = await insertLessonType(TestUsers.SITE_ADMIN, newLessonType);
		await cleanup();
	});
});

describe('RLS: lesson_types UPDATE - blocked for non-admin roles', () => {
	it('user without role cannot update lesson type', async () => {
		await expectUpdateBlocked(TestUsers.STUDENT_001, TEST_LESSON_TYPE_ID);
	});

	it('teacher cannot update lesson type', async () => {
		await expectUpdateBlocked(TestUsers.TEACHER_ALICE, TEST_LESSON_TYPE_ID);
	});

	it('staff cannot update lesson type', async () => {
		await expectUpdateBlocked(TestUsers.STAFF_ONE, TEST_LESSON_TYPE_ID);
	});
});

describe('RLS: lesson_types UPDATE - admin permissions', () => {
	it('admin can update lesson type', async () => {
		// Create a temporary lesson type for update test to avoid affecting fixtures
		const { cleanup, data: tempType } = await insertLessonType(TestUsers.ADMIN_ONE, {
			name: 'Temp Type for Update Test',
			description: 'Will be updated',
			icon: 'test-icon',
			color: '#999999',
			is_group_lesson: false,
			is_active: true,
		});

		await updateLessonType(TestUsers.ADMIN_ONE, tempType.id, { name: 'Updated by Admin' }, { name: tempType.name });

		await cleanup();
	});

	it('site_admin can update lesson type', async () => {
		const { cleanup, data: tempType } = await insertLessonType(TestUsers.SITE_ADMIN, {
			name: 'Temp Type for Site Admin Update',
			description: 'Will be updated',
			icon: 'test-icon',
			color: '#888888',
			is_group_lesson: false,
			is_active: true,
		});

		await updateLessonType(
			TestUsers.SITE_ADMIN,
			tempType.id,
			{ name: 'Updated by Site Admin' },
			{ name: tempType.name },
		);

		await cleanup();
	});
});

describe('RLS: lesson_types DELETE - blocked for non-admin roles', () => {
	it('user without role cannot delete lesson type', async () => {
		await expectDeleteBlocked(TestUsers.STUDENT_001, TEST_LESSON_TYPE_ID);
	});

	it('teacher cannot delete lesson type', async () => {
		await expectDeleteBlocked(TestUsers.TEACHER_ALICE, TEST_LESSON_TYPE_ID);
	});

	it('staff cannot delete lesson type', async () => {
		await expectDeleteBlocked(TestUsers.STAFF_ONE, TEST_LESSON_TYPE_ID);
	});
});

describe('RLS: lesson_types DELETE - admin permissions', () => {
	it('admin can delete lesson type', async () => {
		await deleteLessonType(TestUsers.ADMIN_ONE, {
			name: 'Temporary Lesson Type for Delete Test',
			description: 'Will be deleted',
			icon: 'test-icon',
			color: '#0000FF',
			is_group_lesson: false,
			is_active: true,
		});
	});

	it('site_admin can delete lesson type', async () => {
		await deleteLessonType(TestUsers.SITE_ADMIN, {
			name: 'Temporary Lesson Type for Site Admin Delete Test',
			description: 'Will be deleted',
			icon: 'test-icon',
			color: '#FFFF00',
			is_group_lesson: false,
			is_active: true,
		});
	});
});

/**
 * TRIGGER: lesson_types DELETE - blocked when agreements exist
 * A lesson_type can only be deleted if there are no lesson agreements
 * using that lesson type.
 */
describe('TRIGGER: lesson_types DELETE - blocked when agreements exist', () => {
	const lessonTypeId = fixtures.requireLessonTypeId('Gitaarles');

	it('admin cannot delete lesson_type when agreements exist for that lesson type', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const error = unwrapError(await db.from('lesson_types').delete().eq('id', lessonTypeId).select());

		expect(error.message).toContain('Cannot delete lesson type');
	});

	it('admin can delete lesson_type when no agreements exist for that lesson type', async () => {
		// Use existing helper for consistency and proper cleanup
		await deleteLessonType(TestUsers.ADMIN_ONE, {
			name: 'Test Lesson Type Without Agreements',
			description: 'For delete test',
			icon: 'test-icon',
			color: '#123456',
			is_group_lesson: false,
			is_active: true,
		});
	});

	// Symmetry: also test site_admin for trigger
	it('site_admin cannot delete lesson_type when agreements exist for that lesson type', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const error = unwrapError(await db.from('lesson_types').delete().eq('id', lessonTypeId).select());

		expect(error.message).toContain('Cannot delete lesson type');
	});
});
