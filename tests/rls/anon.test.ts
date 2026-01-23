import { describe, expect, it } from 'bun:test';
import { createClientAnon } from './db';

/**
 * All RLS policies are defined for 'authenticated' role only.
 * Anonymous users should have NO access to any data.
 */
describe('RLS: anonymous user access', () => {
	describe('profiles table', () => {
		it('anon cannot read profiles', async () => {
			const db = createClientAnon();

			const { data, error } = await db.from('profiles').select('*');

			// Should return empty result (RLS blocks all rows)
			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('anon cannot insert profiles', async () => {
			const db = createClientAnon();

			const { data, error } = await db
				.from('profiles')
				.insert({
					user_id: '00000000-0000-0000-0000-999999999999',
					email: 'anon@test.nl',
				})
				.select();

			// Should fail - no INSERT policy for anon
			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});

		it('anon cannot update profiles', async () => {
			const db = createClientAnon();

			const { data, error } = await db
				.from('profiles')
				.update({ display_name: 'Hacked' })
				.eq('email', 'student-a@test.nl')
				.select();

			// Should return empty result (RLS blocks)
			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('anon cannot delete profiles', async () => {
			const db = createClientAnon();

			const { data, error } = await db.from('profiles').delete().eq('email', 'student-a@test.nl').select();

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('user_roles table', () => {
		it('anon cannot read user_roles', async () => {
			const db = createClientAnon();

			const { data, error } = await db.from('user_roles').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('anon cannot insert user_roles', async () => {
			const db = createClientAnon();

			const { data, error } = await db
				.from('user_roles')
				.insert({
					user_id: '00000000-0000-0000-0000-999999999999',
					role: 'site_admin',
				})
				.select();

			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});

		it('anon cannot update user_roles', async () => {
			const db = createClientAnon();

			const { data, error } = await db
				.from('user_roles')
				.update({ role: 'site_admin' })
				.neq('role', 'site_admin')
				.select();

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('anon cannot delete user_roles', async () => {
			const db = createClientAnon();

			const { data, error } = await db.from('user_roles').delete().eq('role', 'student').select();

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('teacher_students table', () => {
		it('anon cannot read teacher_students', async () => {
			const db = createClientAnon();

			const { data, error } = await db.from('teacher_students').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('anon cannot insert teacher_students', async () => {
			const db = createClientAnon();

			const { data, error } = await db
				.from('teacher_students')
				.insert({
					teacher_id: '00000000-0000-0000-0000-000000000030',
					student_id: '00000000-0000-0000-0000-000000000100',
				})
				.select();

			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});

		it('anon cannot delete teacher_students', async () => {
			const db = createClientAnon();

			const { data, error } = await db
				.from('teacher_students')
				.delete()
				.eq('teacher_id', '00000000-0000-0000-0000-000000000030')
				.select();

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('teacher_student_profiles view', () => {
		it('anon cannot read teacher_student_profiles view', async () => {
			const db = createClientAnon();

			const { data, error } = await db.from('teacher_student_profiles').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('security functions', () => {
		it('anon cannot call role helper functions', async () => {
			const db = createClientAnon();

			// Role helper functions are REVOKE'd from PUBLIC and only granted to authenticated.
			// Anon should NOT be able to call these functions.
			const { data, error } = await db.rpc('is_site_admin', {
				_user_id: '00000000-0000-0000-0000-000000000001',
			});

			// Anon must be blocked from calling this function
			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});

		it('anon cannot call introspection functions', async () => {
			const db = createClientAnon();

			// Introspection functions are REVOKE'd from PUBLIC and only granted to service_role.
			// Anon should NOT be able to call these functions.
			const { data, error } = await db.rpc('check_rls_enabled', {
				p_table_name: 'profiles',
			});

			// Anon must be blocked from calling this function
			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});
	});
});
