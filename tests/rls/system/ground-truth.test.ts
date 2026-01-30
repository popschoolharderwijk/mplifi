import { describe, expect, it } from 'bun:test';
import { fixtures } from '../fixtures';

const { allProfiles, allUserRoles } = fixtures;

describe('RLS: verify ground truth', () => {
	it('should have exactly 10 profiles', () => {
		expect(allProfiles).toHaveLength(10);
	});

	it('should have exactly 6 user roles (only explicit roles)', () => {
		// Only site_admin, admin (2), staff, teacher (2) have explicit roles
		// Users A-D have no role entry
		expect(allUserRoles).toHaveLength(6);
	});

	it('should have 1 site_admin', () => {
		const siteAdmins = allUserRoles.filter((ur) => ur.role === 'site_admin');
		expect(siteAdmins).toHaveLength(1);
	});

	it('should have 2 admins', () => {
		const admins = allUserRoles.filter((ur) => ur.role === 'admin');
		expect(admins).toHaveLength(2);
	});

	it('should have 1 staff', () => {
		const staff = allUserRoles.filter((ur) => ur.role === 'staff');
		expect(staff).toHaveLength(1);
	});

	it('should have 2 teachers', () => {
		const teachers = allUserRoles.filter((ur) => ur.role === 'teacher');
		expect(teachers).toHaveLength(2);
	});

	it('should have profiles for all user roles', () => {
		// Every user_role should have a corresponding profile
		for (const userRole of allUserRoles) {
			const profile = allProfiles.find((p) => p.user_id === userRole.user_id);
			expect(profile).toBeDefined();
			expect(profile?.user_id).toBe(userRole.user_id);
		}
	});

	it('should have 4 users without explicit roles', () => {
		// Users A-D exist in profiles but have no entry in user_roles
		const userIdsWithRoles = new Set(allUserRoles.map((ur) => ur.user_id));
		const profilesWithoutRoles = allProfiles.filter((p) => !userIdsWithRoles.has(p.user_id));
		expect(profilesWithoutRoles).toHaveLength(4);

		const emails = profilesWithoutRoles.map((p) => p.email).sort();
		expect(emails).toEqual(['student-a@test.nl', 'student-b@test.nl', 'student-c@test.nl', 'student-d@test.nl']);
	});

	it('should have correct email for site_admin', () => {
		const siteAdminRole = allUserRoles.find((ur) => ur.role === 'site_admin');
		expect(siteAdminRole).toBeDefined();
		if (!siteAdminRole) return;
		const siteAdminProfile = allProfiles.find((p) => p.user_id === siteAdminRole.user_id);
		expect(siteAdminProfile?.email).toBe('site-admin@test.nl');
	});
});
