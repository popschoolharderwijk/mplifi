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
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allUserRoles.length);
	});

	it('teacher (user without role) sees nothing in user_roles', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();
		// Teachers are identified by the teachers table, not by a role
		// So they see nothing in user_roles
		expect(data).toHaveLength(0);
	});

	it('user without role sees nothing in user_roles', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('user_roles').select('*');

		expect(error).toBeNull();
		// Users without a role have no entry in user_roles, so they see nothing
		expect(data).toHaveLength(0);
	});

	it('user without role cannot see other user roles', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const otherUserId = requireUserId(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('user_roles').select('*').eq('user_id', otherUserId);

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
