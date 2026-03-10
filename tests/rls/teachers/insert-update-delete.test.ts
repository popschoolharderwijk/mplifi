import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import type { TeacherInsert } from '../../types';
import { expectError, expectNoError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const dbNoRLS = createClientBypassRLS();

// User IDs from fixtures for insert tests
const studentBUserId = fixtures.requireUserId(TestUsers.STUDENT_002);
const studentCUserId = fixtures.requireUserId(TestUsers.STUDENT_003);
const studentDUserId = fixtures.requireUserId(TestUsers.STUDENT_004);

// Use Bob's teacher ID for UPDATE/DELETE block tests (not Alice, since Alice is used in the test)
const testTeacherUserId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);

/**
 * Teachers INSERT/UPDATE/DELETE permissions:
 *
 * ADMINS and SITE_ADMINS:
 * - Can insert teachers
 * - Can update any teacher
 * - Can delete teachers
 *
 * TEACHERS:
 * - Can update their own teacher record (especially for bio)
 *
 * All other roles (staff, user without role) cannot insert, update, or delete teachers.
 * Note: Teachers are identified by the teachers table, not by a role.
 */
describe('RLS: teachers INSERT - blocked for non-admin roles', () => {
	const newTeacher: TeacherInsert = { user_id: studentBUserId };

	it('user without role cannot insert teacher', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teachers').insert(newTeacher).select();

		// Should fail - no INSERT policy for regular users
		expectError(data, error);
	});

	it('teacher cannot insert teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teachers').insert(newTeacher).select();

		expectError(data, error);
	});

	it('staff cannot insert teacher', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('teachers').insert(newTeacher).select();

		expectError(data, error);
	});
});

describe('RLS: teachers INSERT - admin permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('admin can insert teacher', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const newTeacher: TeacherInsert = { user_id: studentCUserId };
		const { data, error } = await db.from('teachers').insert(newTeacher).select();

		expectNoError(data, error);
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(newTeacher.user_id);

		// Cleanup
		if (data?.[0]?.user_id) {
			await dbNoRLS.from('teachers').delete().eq('user_id', data[0].user_id);
		}
	});

	it('site_admin can insert teacher', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const newTeacher: TeacherInsert = { user_id: studentCUserId };
		const { data, error } = await db.from('teachers').insert(newTeacher).select();

		expectNoError(data, error);
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(newTeacher.user_id);

		// Cleanup
		if (data?.[0]?.user_id) {
			await dbNoRLS.from('teachers').delete().eq('user_id', data[0].user_id);
		}
	});
});

describe('RLS: teachers UPDATE - blocked for non-admin roles', () => {
	it('user without role cannot update teacher', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db
			.from('teachers')
			.update({ updated_at: new Date().toISOString() })
			.eq('user_id', testTeacherUserId)
			.select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot update other teachers', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('teachers')
			.update({ updated_at: new Date().toISOString() })
			.eq('user_id', testTeacherUserId)
			.select();

		// Should fail - teacher can only update their own record
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot update teacher', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data: teachers } = await db.from('teachers').select('user_id').limit(1);
		if (!teachers || teachers.length === 0) {
			throw new Error('No teachers found for test');
		}

		const { data, error } = await db
			.from('teachers')
			.update({ updated_at: new Date().toISOString() })
			.eq('user_id', teachers[0].user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: teachers UPDATE - teacher own record', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('teacher can update own teacher record (bio)', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceTeacherUserId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);

		// Get original bio
		const { data: original } = await db.from('teachers').select('bio').eq('user_id', aliceTeacherUserId).single();
		const originalBio = original?.bio;

		// Update bio
		const newBio = 'Updated bio by teacher';
		const { data, error } = await db
			.from('teachers')
			.update({ bio: newBio })
			.eq('user_id', aliceTeacherUserId)
			.select();

		expectNoError(data, error);
		expect(data).toHaveLength(1);
		expect(data?.[0]?.bio).toBe(newBio);

		// Restore original bio
		await db.from('teachers').update({ bio: originalBio }).eq('user_id', aliceTeacherUserId);
	});

	it('teacher cannot update other teachers records', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const bobTeacherUserId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);

		const { data, error } = await db
			.from('teachers')
			.update({ bio: 'Hacked bio' })
			.eq('user_id', bobTeacherUserId)
			.select();

		// Should fail - teacher can only update their own record
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: teachers UPDATE - admin permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('admin can update teacher', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data: teachers } = await db.from('teachers').select('*').limit(1);
		if (!teachers || teachers.length === 0) {
			throw new Error('No teachers found for test');
		}

		const originalTeacher = teachers[0];

		const { data, error } = await db
			.from('teachers')
			.update({ updated_at: new Date().toISOString() })
			.eq('user_id', originalTeacher.user_id)
			.select();

		expectNoError(data, error);
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(originalTeacher.user_id);
	});

	it('site_admin can update teacher', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: teachers } = await db.from('teachers').select('*').limit(1);
		if (!teachers || teachers.length === 0) {
			throw new Error('No teachers found for test');
		}

		const originalTeacher = teachers[0];

		const { data, error } = await db
			.from('teachers')
			.update({ updated_at: new Date().toISOString() })
			.eq('user_id', originalTeacher.user_id)
			.select();

		expectNoError(data, error);
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(originalTeacher.user_id);
	});
});

describe('RLS: teachers DELETE - blocked for non-admin roles', () => {
	it('user without role cannot delete teacher', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teachers').delete().eq('user_id', testTeacherUserId).select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teachers').delete().eq('user_id', testTeacherUserId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete teacher', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data: teachers } = await db.from('teachers').select('user_id').limit(1);
		if (!teachers || teachers.length === 0) {
			throw new Error('No teachers found for test');
		}

		const { data, error } = await db.from('teachers').delete().eq('user_id', teachers[0].user_id).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: teachers DELETE - admin permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('admin can delete teacher', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Create a teacher to delete (use studentDUserId - should not be a teacher in seed)
		const newTeacher: TeacherInsert = { user_id: studentDUserId };
		const { data: inserted, error: insertError } = await db.from('teachers').insert(newTeacher).select();
		expectNoError(inserted, insertError);
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert teacher');
		}

		const teacherUserId = inserted[0].user_id;

		// Delete
		const { data, error } = await db.from('teachers').delete().eq('user_id', teacherUserId).select();

		expectNoError(data, error);
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(teacherUserId);
	});

	it('site_admin can delete teacher', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Create a teacher to delete (use studentDUserId - should not be a teacher in seed)
		const newTeacher: TeacherInsert = { user_id: studentDUserId };
		const { data: inserted, error: insertError } = await db.from('teachers').insert(newTeacher).select();
		expectNoError(inserted, insertError);
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert teacher');
		}

		const teacherUserId = inserted[0].user_id;

		// Delete
		const { data, error } = await db.from('teachers').delete().eq('user_id', teacherUserId).select();

		expectNoError(data, error);
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(teacherUserId);
	});
});
