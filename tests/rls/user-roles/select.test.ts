import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { allUserRoles, requireUserId } = fixtures;

describe('RLS: user_roles SELECT', () => {
	it('site_admin sees all user roles', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allUserRoles.length);
	});

	it('admin sees all user roles', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allUserRoles.length);
	});

	it('staff sees all user roles', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allUserRoles.length);
	});

	it('teacher sees only own role', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();
		// Teacher sees only their own role
		expect(data).toHaveLength(1);

		const [role] = data ?? [];
		expect(role?.user_id).toBe(requireUserId(TestUsers.TEACHER_ALICE));
		expect(role?.role).toBe('teacher');
	});

	it('teacher cannot see other teacher roles', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();

		const userIds = data?.map((r) => r.user_id) ?? [];
		expect(userIds).not.toContain(requireUserId(TestUsers.TEACHER_BOB));
	});

	it('user without role sees nothing in user_roles', async () => {
		const db = await createClientAs(TestUsers.USER_A);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();
		// Users without a role have no entry in user_roles, so they see nothing
		expect(data).toHaveLength(0);
	});

	it('user without role cannot see other user roles', async () => {
		const db = await createClientAs(TestUsers.USER_A);
		const otherUserId = requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').select('*').eq('user_id', otherUserId);

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
