import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { requireUserId } = fixtures;

/**
 * Profiles INSERT/DELETE are intentionally blocked.
 * - Profiles are only created via handle_new_user() trigger
 * - Profiles are only deleted via CASCADE when auth.users is deleted
 */

describe('RLS: profiles INSERT - blocked for all roles', () => {
	const newProfileData = {
		user_id: '00000000-0000-0000-0000-999999999999',
		email: 'fake@test.nl',
		first_name: 'Fake',
		last_name: 'User',
	};

	it('student cannot insert profile', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db.from('profiles').insert(newProfileData).select();

		// Should fail - no INSERT policy
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher cannot insert profile', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('profiles').insert(newProfileData).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('staff cannot insert profile', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('profiles').insert(newProfileData).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('admin cannot insert profile', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('profiles').insert(newProfileData).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('site_admin cannot insert profile', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('profiles').insert(newProfileData).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: profiles DELETE - blocked for all roles', () => {
	it('student cannot delete own profile', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const userId = requireUserId(TestUsers.STUDENT_A);

		const { data, error } = await db.from('profiles').delete().eq('user_id', userId).select();

		// RLS blocks - 0 rows affected (no DELETE policy)
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('student cannot delete other profiles', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);
		const userId = requireUserId(TestUsers.STUDENT_B);

		const { data, error } = await db.from('profiles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete profiles', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const userId = requireUserId(TestUsers.STUDENT_A);

		const { data, error } = await db.from('profiles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete profiles', async () => {
		const db = await createClientAs(TestUsers.STAFF);
		const userId = requireUserId(TestUsers.STUDENT_A);

		const { data, error } = await db.from('profiles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('admin cannot delete profiles', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const userId = requireUserId(TestUsers.STUDENT_A);

		const { data, error } = await db.from('profiles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('site_admin cannot delete profiles', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const userId = requireUserId(TestUsers.STUDENT_A);

		const { data, error } = await db.from('profiles').delete().eq('user_id', userId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
