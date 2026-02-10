import { describe, expect, it } from 'bun:test';
import { fixtures } from '../fixtures';

const { allProfiles, allUserRoles } = fixtures;

describe('RLS: verify ground truth', () => {
	it('should have exactly 88 profiles', () => {
		// 1 site_admin, 2 admins, 5 staff, 10 teachers, 60 students, 10 users (no role)
		expect(allProfiles).toHaveLength(88);
	});

	it('should have exactly 8 user roles (only explicit roles)', () => {
		// Only site_admin, admin (2), staff (5) have explicit roles
		// Teachers are identified by the teachers table, not by a role
		// Students and users without role have no role entry
		expect(allUserRoles).toHaveLength(8);
	});

	it('should have 1 site_admin', () => {
		const siteAdmins = allUserRoles.filter((ur) => ur.role === 'site_admin');
		expect(siteAdmins).toHaveLength(1);
	});

	it('should have 2 admins', () => {
		const admins = allUserRoles.filter((ur) => ur.role === 'admin');
		expect(admins).toHaveLength(2);
	});

	it('should have 5 staff', () => {
		const staff = allUserRoles.filter((ur) => ur.role === 'staff');
		expect(staff).toHaveLength(5);
	});

	it('should have 0 teachers in user_roles (teachers are in teachers table)', () => {
		const teachers = allUserRoles.filter((ur) => ur.role === 'teacher');
		expect(teachers).toHaveLength(0);
	});

	it('should have profiles for all user roles', () => {
		// Every user_role should have a corresponding profile
		for (const userRole of allUserRoles) {
			const profile = allProfiles.find((p) => p.user_id === userRole.user_id);
			expect(profile).toBeDefined();
			expect(profile?.user_id).toBe(userRole.user_id);
		}
	});

	it('should have 80 users without explicit roles', () => {
		// Teachers (10), students (60), and regular users (10) exist in profiles but have no entry in user_roles
		// Teachers are identified by the teachers table, not by a role
		const userIdsWithRoles = new Set(allUserRoles.map((ur) => ur.user_id));
		const profilesWithoutRoles = allProfiles.filter((p) => !userIdsWithRoles.has(p.user_id));
		expect(profilesWithoutRoles).toHaveLength(80);

		// Verify we have the expected distribution
		const teacherEmails = profilesWithoutRoles
			.filter((p) => p.email.startsWith('teacher-'))
			.map((p) => p.email)
			.sort();
		expect(teacherEmails).toHaveLength(10);

		const studentEmails = profilesWithoutRoles
			.filter((p) => p.email.startsWith('student-'))
			.map((p) => p.email)
			.sort();
		expect(studentEmails).toHaveLength(60);

		const userEmails = profilesWithoutRoles
			.filter((p) => p.email.startsWith('user-'))
			.map((p) => p.email)
			.sort();
		expect(userEmails).toHaveLength(10);
	});

	it('should have correct email for site_admin', () => {
		const siteAdminRole = allUserRoles.find((ur) => ur.role === 'site_admin');
		expect(siteAdminRole).toBeDefined();
		if (!siteAdminRole) return;
		const siteAdminProfile = allProfiles.find((p) => p.user_id === siteAdminRole.user_id);
		expect(siteAdminProfile?.email).toBe('site-admin@test.nl');
	});
});
