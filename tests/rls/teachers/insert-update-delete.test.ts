import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { TeacherInsert } from '../types';

const dbNoRLS = createClientBypassRLS();

// User IDs from fixtures for insert tests
const studentBUserId = fixtures.requireUserId(TestUsers.STUDENT_002);
const studentCUserId = fixtures.requireUserId(TestUsers.STUDENT_003);
const studentDUserId = fixtures.requireUserId(TestUsers.STUDENT_004);

// Use Bob's teacher ID for UPDATE/DELETE block tests (not Alice, since Alice is used in the test)
const testTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);

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
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher cannot insert teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teachers').insert(newTeacher).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('staff cannot insert teacher', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('teachers').insert(newTeacher).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
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

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(newTeacher.user_id);

		// Cleanup
		if (data?.[0]?.id) {
			await dbNoRLS.from('teachers').delete().eq('id', data[0].id);
		}
	});

	it('site_admin can insert teacher', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const newTeacher: TeacherInsert = { user_id: studentCUserId };
		const { data, error } = await db.from('teachers').insert(newTeacher).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(newTeacher.user_id);

		// Cleanup
		if (data?.[0]?.id) {
			await dbNoRLS.from('teachers').delete().eq('id', data[0].id);
		}
	});
});

describe('RLS: teachers UPDATE - blocked for non-admin roles', () => {
	it('user without role cannot update teacher', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db
			.from('teachers')
			.update({ updated_at: new Date().toISOString() })
			.eq('id', testTeacherId)
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
			.eq('id', testTeacherId)
			.select();

		// Should fail - teacher can only update their own record
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot update teacher', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data: teachers } = await db.from('teachers').select('id').limit(1);
		if (!teachers || teachers.length === 0) {
			throw new Error('No teachers found for test');
		}

		const { data, error } = await db
			.from('teachers')
			.update({ updated_at: new Date().toISOString() })
			.eq('id', teachers[0].id)
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
		const aliceTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);

		// Get original bio
		const { data: original } = await db.from('teachers').select('bio').eq('id', aliceTeacherId).single();
		const originalBio = original?.bio;

		// Update bio
		const newBio = 'Updated bio by teacher';
		const { data, error } = await db.from('teachers').update({ bio: newBio }).eq('id', aliceTeacherId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.bio).toBe(newBio);

		// Restore original bio
		await db.from('teachers').update({ bio: originalBio }).eq('id', aliceTeacherId);
	});

	it('teacher cannot update other teachers records', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const bobTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);

		const { data, error } = await db.from('teachers').update({ bio: 'Hacked bio' }).eq('id', bobTeacherId).select();

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
			.eq('id', originalTeacher.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(originalTeacher.id);
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
			.eq('id', originalTeacher.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(originalTeacher.id);
	});
});

describe('RLS: teachers DELETE - blocked for non-admin roles', () => {
	it('user without role cannot delete teacher', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teachers').delete().eq('id', testTeacherId).select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teachers').delete().eq('id', testTeacherId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete teacher', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data: teachers } = await db.from('teachers').select('id').limit(1);
		if (!teachers || teachers.length === 0) {
			throw new Error('No teachers found for test');
		}

		const { data, error } = await db.from('teachers').delete().eq('id', teachers[0].id).select();

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
		expect(insertError).toBeNull();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert teacher');
		}

		const teacherId = inserted[0].id;

		// Delete
		const { data, error } = await db.from('teachers').delete().eq('id', teacherId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(teacherId);
	});

	it('site_admin can delete teacher', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Create a teacher to delete (use studentDUserId - should not be a teacher in seed)
		const newTeacher: TeacherInsert = { user_id: studentDUserId };
		const { data: inserted, error: insertError } = await db.from('teachers').insert(newTeacher).select();
		expect(insertError).toBeNull();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert teacher');
		}

		const teacherId = inserted[0].id;

		// Delete
		const { data, error } = await db.from('teachers').delete().eq('id', teacherId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(teacherId);
	});
});
