import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { allProfiles } = fixtures;

/**
 * RLS tests for view_profiles_with_display_name
 *
 * This view uses security_invoker = on, meaning it respects the RLS policies
 * of the underlying profiles table. Users should see the same rows through
 * the view as they would querying the profiles table directly.
 *
 * This test file verifies that:
 * 1. The view respects RLS (doesn't bypass security)
 * 2. Users see the same data through the view as through the base table
 * 3. The display_name field is correctly calculated
 */
describe('RLS: view_profiles_with_display_name SELECT', () => {
	describe('view respects RLS like base profiles table', () => {
		it('site_admin sees all profiles via view', async () => {
			const db = await createClientAs(TestUsers.SITE_ADMIN);

			const { data, error } = await db.from('view_profiles_with_display_name').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(allProfiles.length);
		});

		it('admin sees all profiles via view', async () => {
			const db = await createClientAs(TestUsers.ADMIN_ONE);

			const { data, error } = await db.from('view_profiles_with_display_name').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(allProfiles.length);
		});

		it('staff sees all profiles via view', async () => {
			const db = await createClientAs(TestUsers.STAFF_ONE);

			const { data, error } = await db.from('view_profiles_with_display_name').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(allProfiles.length);
		});

		it('teacher sees only own profile via view', async () => {
			const db = await createClientAs(TestUsers.TEACHER_ALICE);

			const { data, error } = await db.from('view_profiles_with_display_name').select('*');

			expect(error).toBeNull();
			// Teacher sees only their own profile
			expect(data).toHaveLength(1);

			const [profile] = data ?? [];
			expect(profile?.email).toBe(TestUsers.TEACHER_ALICE);
		});

		it('student sees only own profile via view', async () => {
			const db = await createClientAs(TestUsers.STUDENT_001);

			const { data, error } = await db.from('view_profiles_with_display_name').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(1);

			const [profile] = data ?? [];
			expect(profile?.email).toBe(TestUsers.STUDENT_001);
		});

		it('user without role sees only own profile via view', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('view_profiles_with_display_name').select('*');

			expect(error).toBeNull();
			expect(data).toHaveLength(1);

			const [profile] = data ?? [];
			expect(profile?.email).toBe(TestUsers.USER_001);
		});
	});

	describe('view returns same rows as base table for same user', () => {
		it('teacher: view and table return identical user_ids', async () => {
			const db = await createClientAs(TestUsers.TEACHER_BOB);

			const { data: viewData } = await db.from('view_profiles_with_display_name').select('user_id');
			const { data: tableData } = await db.from('profiles').select('user_id');

			const viewUserIds = new Set(viewData?.map((r) => r.user_id));
			const tableUserIds = new Set(tableData?.map((r) => r.user_id));

			expect(viewUserIds).toEqual(tableUserIds);
		});

		it('student: view and table return identical user_ids', async () => {
			const db = await createClientAs(TestUsers.STUDENT_009);

			const { data: viewData } = await db.from('view_profiles_with_display_name').select('user_id');
			const { data: tableData } = await db.from('profiles').select('user_id');

			const viewUserIds = new Set(viewData?.map((r) => r.user_id));
			const tableUserIds = new Set(tableData?.map((r) => r.user_id));

			expect(viewUserIds).toEqual(tableUserIds);
		});

		it('staff: view and table return identical user_ids', async () => {
			const db = await createClientAs(TestUsers.STAFF_ONE);

			const { data: viewData } = await db.from('view_profiles_with_display_name').select('user_id');
			const { data: tableData } = await db.from('profiles').select('user_id');

			const viewUserIds = new Set(viewData?.map((r) => r.user_id));
			const tableUserIds = new Set(tableData?.map((r) => r.user_id));

			expect(viewUserIds).toEqual(tableUserIds);
		});
	});

	describe('user cannot access other profiles via view', () => {
		it('student cannot see other user profiles via view', async () => {
			const db = await createClientAs(TestUsers.STUDENT_001);

			const { data, error } = await db.from('view_profiles_with_display_name').select('*');

			expect(error).toBeNull();

			const emails = data?.map((p) => p.email) ?? [];
			// Should only see own email
			expect(emails).toContain(TestUsers.STUDENT_001);
			// Should NOT see other users
			expect(emails).not.toContain(TestUsers.STUDENT_002);
			expect(emails).not.toContain(TestUsers.TEACHER_ALICE);
			expect(emails).not.toContain(TestUsers.ADMIN_ONE);
		});

		it('teacher cannot see other user profiles via view', async () => {
			const db = await createClientAs(TestUsers.TEACHER_ALICE);

			const { data, error } = await db.from('view_profiles_with_display_name').select('*');

			expect(error).toBeNull();

			const emails = data?.map((p) => p.email) ?? [];
			// Should only see own email
			expect(emails).toContain(TestUsers.TEACHER_ALICE);
			// Should NOT see other users
			expect(emails).not.toContain(TestUsers.TEACHER_BOB);
			expect(emails).not.toContain(TestUsers.STUDENT_001);
			expect(emails).not.toContain(TestUsers.ADMIN_ONE);
		});

		it('user without role cannot see other user profiles via view', async () => {
			const db = await createClientAs(TestUsers.USER_001);

			const { data, error } = await db.from('view_profiles_with_display_name').select('*');

			expect(error).toBeNull();

			const emails = data?.map((p) => p.email) ?? [];
			// Should only see own email
			expect(emails).toContain(TestUsers.USER_001);
			// Should NOT see other users
			expect(emails).not.toContain(TestUsers.USER_002);
			expect(emails).not.toContain(TestUsers.STUDENT_001);
		});
	});

	describe('display_name field is correctly calculated', () => {
		it('display_name shows full name when first and last name are present', async () => {
			const db = await createClientAs(TestUsers.TEACHER_ALICE);
			const aliceProfile = fixtures.requireProfile(TestUsers.TEACHER_ALICE);

			const { data, error } = await db
				.from('view_profiles_with_display_name')
				.select('display_name, first_name, last_name')
				.single();

			expect(error).toBeNull();
			expect(data).toBeDefined();

			// display_name should be "first_name last_name"
			const expectedDisplayName = `${aliceProfile.first_name} ${aliceProfile.last_name}`;
			expect(data?.display_name).toBe(expectedDisplayName);
		});

		it('view includes expected fields', async () => {
			const db = await createClientAs(TestUsers.STUDENT_001);

			const { data, error } = await db.from('view_profiles_with_display_name').select('*').single();

			expect(error).toBeNull();
			expect(data).toBeDefined();

			// Verify all expected fields are present
			expect(data).toHaveProperty('user_id');
			expect(data).toHaveProperty('email');
			expect(data).toHaveProperty('first_name');
			expect(data).toHaveProperty('last_name');
			expect(data).toHaveProperty('phone_number');
			expect(data).toHaveProperty('avatar_url');
			expect(data).toHaveProperty('created_at');
			expect(data).toHaveProperty('display_name');
		});
	});
});
