import { describe, expect, it } from 'bun:test';
import { createClientAs } from './db';
import { fixtures } from './fixtures';
import { TestUsers } from './test-users';

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

	it('teacher sees own role and linked students roles', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();
		// Teacher Alice: own role + 2 linked students (A & B) = 3
		expect(data).toHaveLength(3);

		// Verify we see the correct user_ids
		const userIds = data?.map((r) => r.user_id) ?? [];
		expect(userIds).toContain(requireUserId(TestUsers.TEACHER_ALICE));
		expect(userIds).toContain(requireUserId(TestUsers.STUDENT_A));
		expect(userIds).toContain(requireUserId(TestUsers.STUDENT_B));
	});

	it('teacher cannot see roles of students not linked to them', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();

		const userIds = data?.map((r) => r.user_id) ?? [];
		// Teacher Alice should NOT see Student C & D (linked to Teacher Bob)
		expect(userIds).not.toContain(requireUserId(TestUsers.STUDENT_C));
		expect(userIds).not.toContain(requireUserId(TestUsers.STUDENT_D));
	});

	it('teacher cannot see other teacher roles', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();

		const userIds = data?.map((r) => r.user_id) ?? [];
		expect(userIds).not.toContain(requireUserId(TestUsers.TEACHER_BOB));
	});

	it('student sees only own role', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		const [role] = data ?? [];
		expect(role?.user_id).toBe(requireUserId(TestUsers.STUDENT_A));
		expect(role?.role).toBe('student');
	});

	it('student cannot see other user roles', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const otherUserId = requireUserId(TestUsers.STUDENT_B);

		const { data, error } = await db.from('user_roles').select('*').eq('user_id', otherUserId);

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
