import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { requireUserId } = fixtures;

/**
 * User roles INSERT/DELETE are intentionally blocked.
 * - Roles are only created via direct database access (e.g. by site_admin via SQL)
 * - Roles are only deleted via CASCADE when auth.users is deleted
 * - Role changes are UPDATE operations, not INSERT+DELETE
 */

describe('RLS: user_roles INSERT - blocked for all roles', () => {
	const fakeUserId = '00000000-0000-0000-0000-999999999999';

	it('user without role cannot insert user_role', async () => {
		const db = await createClientAs(TestUsers.USER_A);

		const { data, error } = await db.from('user_roles').insert({ user_id: fakeUserId, role: 'teacher' }).select();

		// Should fail - no INSERT policy
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher cannot insert user_role', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').insert({ user_id: fakeUserId, role: 'teacher' }).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('staff cannot insert user_role', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('user_roles').insert({ user_id: fakeUserId, role: 'teacher' }).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('admin cannot insert user_role', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('user_roles').insert({ user_id: fakeUserId, role: 'teacher' }).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('site_admin cannot insert user_role', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('user_roles').insert({ user_id: fakeUserId, role: 'teacher' }).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: user_roles DELETE - blocked for all roles', () => {
	it('user without role cannot delete roles', async () => {
		const db = await createClientAs(TestUsers.USER_A);
		const userId = requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', userId).select();

		// RLS blocks - 0 rows affected (no DELETE policy)
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete roles', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const userId = requireUserId(TestUsers.TEACHER_BOB);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete roles', async () => {
		const db = await createClientAs(TestUsers.STAFF);
		const userId = requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('admin cannot delete roles', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const userId = requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('site_admin cannot delete roles', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const userId = requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
