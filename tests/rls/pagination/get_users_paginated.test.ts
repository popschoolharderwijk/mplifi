import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { USERS } from '../seed-data-constants';
import { TestUsers } from '../test-users';

interface PaginatedUsersResponse {
	data: Array<{
		user_id: string;
		email: string;
		first_name: string | null;
		last_name: string | null;
		phone_number: string | null;
		avatar_url: string | null;
		created_at: string;
		role: 'site_admin' | 'admin' | 'staff' | null;
	}>;
	total_count: number;
	limit: number;
	offset: number;
}

/**
 * RLS tests for get_users_paginated function
 *
 * This function uses SECURITY DEFINER but must respect the same RLS rules as
 * the profiles table. It should return only the users that the calling user
 * is allowed to see according to RLS policies.
 *
 * Expected behavior:
 * - ADMIN/SITE_ADMIN: Can see all users
 * - STAFF: Cannot access this function (only admin/site_admin can see all users)
 * - TEACHERS/STUDENTS/USERS: Cannot access this function (only admin/site_admin can see all users)
 *
 * Note: The function explicitly checks for admin/site_admin in the WHERE clause,
 * so only these roles can see users via this function.
 */
describe('RLS: get_users_paginated', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('site_admin sees all users', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.rpc('get_users_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedUsersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(USERS.TOTAL);
		expect(result.data.length).toBe(USERS.TOTAL);
	});

	it('admin sees all users', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.rpc('get_users_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedUsersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(USERS.TOTAL);
		expect(result.data.length).toBe(USERS.TOTAL);
	});

	it('staff cannot see any users (function only allows admin/site_admin)', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.rpc('get_users_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedUsersResponse;
		expect(result.data).toBeInstanceOf(Array);
		// Staff cannot see any users via this function (only admin/site_admin can)
		expect(result.total_count).toBe(0);
		expect(result.data.length).toBe(0);
	});

	it('teacher cannot see any users', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.rpc('get_users_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedUsersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(0);
		expect(result.data.length).toBe(0);
	});

	it('student cannot see any users', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.rpc('get_users_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedUsersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(0);
		expect(result.data.length).toBe(0);
	});

	it('user without role cannot see any users', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.rpc('get_users_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		expect(error).toBeNull();
		expect(data).not.toBeNull();
		const result = data as unknown as PaginatedUsersResponse;
		expect(result.data).toBeInstanceOf(Array);
		expect(result.total_count).toBe(0);
		expect(result.data.length).toBe(0);
	});

	it('pagination works correctly', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Get first page
		const { data: page1Data, error: error1 } = await db.rpc('get_users_paginated', {
			p_limit: 20,
			p_offset: 0,
		});

		expect(error1).toBeNull();
		const page1 = page1Data as unknown as PaginatedUsersResponse;
		expect(page1.data.length).toBe(20);
		expect(page1.limit).toBe(20);
		expect(page1.offset).toBe(0);
		expect(page1.total_count).toBe(USERS.TOTAL);

		// Get second page
		const { data: page2Data, error: error2 } = await db.rpc('get_users_paginated', {
			p_limit: 20,
			p_offset: 20,
		});

		expect(error2).toBeNull();
		const page2 = page2Data as unknown as PaginatedUsersResponse;
		expect(page2.data.length).toBe(20);
		expect(page2.limit).toBe(20);
		expect(page2.offset).toBe(20);
		expect(page2.total_count).toBe(USERS.TOTAL);

		// Total count should be the same
		expect(page1.total_count).toBe(page2.total_count);

		// No overlap between pages
		const page1Ids = new Set(page1.data.map((u) => u.user_id));
		const page2Ids = new Set(page2.data.map((u) => u.user_id));
		const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
		expect(intersection.length).toBe(0);
	});

	it('search filter works', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Get all users first
		const { data: allDataRaw } = await db.rpc('get_users_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		const allData = allDataRaw as unknown as PaginatedUsersResponse;
		expect(allData).not.toBeNull();
		expect(allData.data.length).toBe(USERS.TOTAL);
		const firstUser = allData.data[0];
		const searchTerm = firstUser.email.substring(0, 5);

		const { data: searchDataRaw, error } = await db.rpc('get_users_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_search: searchTerm,
		});

		expect(error).toBeNull();
		const searchData = searchDataRaw as unknown as PaginatedUsersResponse;
		expect(searchData.total_count).toBeGreaterThan(0);
		expect(searchData.total_count).toBeLessThanOrEqual(USERS.TOTAL);
		// All results should match the search term
		searchData.data.forEach((user) => {
			const email = user.email.toLowerCase();
			const firstName = (user.first_name || '').toLowerCase();
			const lastName = (user.last_name || '').toLowerCase();
			const phoneNumber = (user.phone_number || '').toLowerCase();
			const displayName = `${firstName} ${lastName}`.trim().toLowerCase() || email;
			const matches =
				email.includes(searchTerm.toLowerCase()) ||
				firstName.includes(searchTerm.toLowerCase()) ||
				lastName.includes(searchTerm.toLowerCase()) ||
				phoneNumber.includes(searchTerm.toLowerCase()) ||
				displayName.includes(searchTerm.toLowerCase());
			expect(matches).toBe(true);
		});
	});

	it('role filter works - site_admin', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: siteAdminDataRaw, error: siteAdminError } = await db.rpc('get_users_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_role: 'site_admin',
		});

		expect(siteAdminError).toBeNull();
		const siteAdminData = siteAdminDataRaw as unknown as PaginatedUsersResponse;
		expect(siteAdminData.total_count).toBe(USERS.SITE_ADMIN);
		siteAdminData.data.forEach((user) => {
			expect(user.role).toBe('site_admin');
		});
	});

	it('role filter works - admin', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: adminDataRaw, error: adminError } = await db.rpc('get_users_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_role: 'admin',
		});

		expect(adminError).toBeNull();
		const adminData = adminDataRaw as unknown as PaginatedUsersResponse;
		expect(adminData.total_count).toBe(USERS.ADMIN);
		adminData.data.forEach((user) => {
			expect(user.role).toBe('admin');
		});
	});

	it('role filter works - staff', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: staffDataRaw, error: staffError } = await db.rpc('get_users_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_role: 'staff',
		});

		expect(staffError).toBeNull();
		const staffData = staffDataRaw as unknown as PaginatedUsersResponse;
		expect(staffData.total_count).toBe(USERS.STAFF);
		staffData.data.forEach((user) => {
			expect(user.role).toBe('staff');
		});
	});

	it('role filter works - none (users without role)', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: noneDataRaw, error: noneError } = await db.rpc('get_users_paginated', {
			p_limit: 100,
			p_offset: 0,
			p_role: 'none',
		});

		expect(noneError).toBeNull();
		const noneData = noneDataRaw as unknown as PaginatedUsersResponse;
		// Users without app_role (teachers, students, and regular users)
		expect(noneData.total_count).toBe(USERS.WITHOUT_ROLE);
		noneData.data.forEach((user) => {
			expect(user.role).toBeNull();
		});
	});

	it('role filter works - null (all users)', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data: allDataRaw, error: allError } = await db.rpc('get_users_paginated', {
			p_limit: 1000,
			p_offset: 0,
			p_role: undefined,
		});

		expect(allError).toBeNull();
		const allData = allDataRaw as unknown as PaginatedUsersResponse;
		expect(allData.total_count).toBe(USERS.TOTAL);
	});

	it('returns correct user data structure', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const siteAdminUserId = fixtures.requireUserId(TestUsers.SITE_ADMIN);

		const { data, error } = await db.rpc('get_users_paginated', {
			p_limit: 1000,
			p_offset: 0,
		});

		expect(error).toBeNull();
		const result = data as unknown as PaginatedUsersResponse;
		expect(result.data.length).toBeGreaterThan(0);

		// Find site admin user
		const siteAdmin = result.data.find((u) => u.user_id === siteAdminUserId);
		expect(siteAdmin).toBeDefined();
		expect(siteAdmin?.email).toBe(TestUsers.SITE_ADMIN);
		expect(siteAdmin?.role).toBe('site_admin');
		expect(siteAdmin?.user_id).toBe(siteAdminUserId);
		expect(siteAdmin).toHaveProperty('first_name');
		expect(siteAdmin).toHaveProperty('last_name');
		expect(siteAdmin).toHaveProperty('phone_number');
		expect(siteAdmin).toHaveProperty('avatar_url');
		expect(siteAdmin).toHaveProperty('created_at');
	});
});
