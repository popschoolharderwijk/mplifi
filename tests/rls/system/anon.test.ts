import { describe, expect, it } from 'bun:test';
import { createClientAnon } from '../../db';

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
				.update({ first_name: 'Hacked', last_name: null })
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

			const { data, error } = await db.from('user_roles').delete().eq('role', 'teacher').select();

			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});
	});

	describe('lesson_types table', () => {
		it('anon cannot read lesson_types', async () => {
			const db = createClientAnon();

			const { data, error } = await db.from('lesson_types').select('*');

			// Should return empty result (RLS blocks all rows)
			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('anon cannot insert lesson_types', async () => {
			const db = createClientAnon();

			const { data, error } = await db
				.from('lesson_types')
				.insert({
					name: 'Hacked Lesson Type',
					icon: 'test',
					color: '#FF0000',
					duration_minutes: 30,
					frequency: 'weekly',
					price_per_lesson: 25.0,
				})
				.select();

			// Should fail - no INSERT policy for anon
			expect(error).not.toBeNull();
			expect(data).toBeNull();
		});

		it('anon cannot update lesson_types', async () => {
			const db = createClientAnon();

			const { data, error } = await db
				.from('lesson_types')
				.update({ name: 'Hacked' })
				.neq('name', 'Hacked')
				.select();

			// Should return empty result (RLS blocks)
			expect(error).toBeNull();
			expect(data).toHaveLength(0);
		});

		it('anon cannot delete lesson_types', async () => {
			const db = createClientAnon();

			const { data, error } = await db
				.from('lesson_types')
				.delete()
				.neq('id', '00000000-0000-0000-0000-000000000000')
				.select();

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
