import { describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from './db';

const dbNoRLS = createClientBypassRLS();

// Fetch ground truth data
const { data: allProfiles, error: groundTruthError } = await dbNoRLS.from('profiles').select('*');
const { data: allUserRoles, error: rolesError } = await dbNoRLS.from('user_roles').select('*');

if (groundTruthError || !allProfiles) {
	throw new Error(`Failed to fetch ground truth profiles: ${groundTruthError?.message}`);
}

if (rolesError || !allUserRoles) {
	throw new Error(`Failed to fetch ground truth roles: ${rolesError?.message}`);
}

// Create a map of user_id -> role for easy lookup
const userRoleMap = new Map(allUserRoles.map((ur) => [ur.user_id, ur.role]));

describe('RLS: profiles verify ground truth', () => {
	it('should have exactly 10 profiles', () => {
		expect(allProfiles).toHaveLength(10);
	});

	it('should have exactly 10 user roles', () => {
		expect(allUserRoles).toHaveLength(10);
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

	it('should have 4 students', () => {
		const students = allUserRoles.filter((ur) => ur.role === 'student');
		expect(students).toHaveLength(4);
	});

	it('should have profiles for all user roles', () => {
		// Every user_role should have a corresponding profile
		for (const userRole of allUserRoles) {
			const profile = allProfiles.find((p) => p.user_id === userRole.user_id);
			expect(profile).toBeDefined();
			expect(profile?.user_id).toBe(userRole.user_id);
		}
	});

	it('should have user roles for all profiles', () => {
		// Every profile should have a corresponding user_role
		for (const profile of allProfiles) {
			const userRole = allUserRoles.find((ur) => ur.user_id === profile.user_id);
			expect(userRole).toBeDefined();
			expect(userRole?.user_id).toBe(profile.user_id);
		}
	});

	it('should have correct email for site_admin', () => {
		const siteAdminRole = allUserRoles.find((ur) => ur.role === 'site_admin');
		expect(siteAdminRole).toBeDefined();
		if (!siteAdminRole) return;
		const siteAdminProfile = allProfiles.find((p) => p.user_id === siteAdminRole.user_id);
		expect(siteAdminProfile?.email).toBe('site-admin@test.nl');
	});

	it('should have correct emails for students', () => {
		const studentProfiles = allProfiles.filter((p) => {
			const role = userRoleMap.get(p.user_id);
			return role === 'student';
		});
		expect(studentProfiles).toHaveLength(4);
		const emails = studentProfiles.map((p) => p.email).sort();
		expect(emails).toEqual(['student-a@test.nl', 'student-b@test.nl', 'student-c@test.nl', 'student-d@test.nl']);
	});
});

describe('RLS: profiles SELECT', () => {
	it('site_admin sees all profiles', async () => {
		const db = await createClientAs('site-admin@test.nl');

		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(allProfiles.length);
	});

	it('student sees only own profile', async () => {
		// Sign in as student_a using real Supabase auth
		const db = await createClientAs('student-a@test.nl');

		// Query profiles - RLS should filter to only their row
		const { data, error } = await db.from('profiles').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		const [user] = data ?? [];
		expect(user).toBeDefined();
		expect(user.email).toBe('student-a@test.nl');
	});
});
