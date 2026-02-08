import { createClientBypassRLS } from '../db';
import type { TestUser } from './test-users';

const dbNoRLS = createClientBypassRLS();

// Fetch ground truth data once
const { data: allProfiles, error: profilesError } = await dbNoRLS.from('profiles').select('*');
const { data: allUserRoles, error: rolesError } = await dbNoRLS.from('user_roles').select('*');
const { data: allStudents, error: studentsError } = await dbNoRLS.from('students').select('*');
const { data: allTeachers, error: teachersError } = await dbNoRLS.from('teachers').select('*');
const { data: allLessonTypes, error: lessonTypesError } = await dbNoRLS.from('lesson_types').select('*');
const { data: allLessonAgreements, error: agreementsError } = await dbNoRLS.from('lesson_agreements').select('*');

if (profilesError || !allProfiles) {
	throw new Error(`Failed to fetch profiles: ${profilesError?.message}`);
}

if (rolesError || !allUserRoles) {
	throw new Error(`Failed to fetch user roles: ${rolesError?.message}`);
}

if (studentsError || !allStudents) {
	throw new Error(`Failed to fetch students: ${studentsError?.message}`);
}

if (teachersError || !allTeachers) {
	throw new Error(`Failed to fetch teachers: ${teachersError?.message}`);
}

if (lessonTypesError || !allLessonTypes) {
	throw new Error(`Failed to fetch lesson types: ${lessonTypesError?.message}`);
}

if (agreementsError || !allLessonAgreements) {
	throw new Error(`Failed to fetch lesson agreements: ${agreementsError?.message}`);
}

// Build lookup maps for fast access
const profileByEmail = new Map(allProfiles.map((p) => [p.email, p]));
const studentByUserId = new Map(allStudents.map((s) => [s.user_id, s]));
const teacherByUserId = new Map(allTeachers.map((t) => [t.user_id, t]));

export const fixtures = {
	allProfiles,
	allUserRoles,
	allStudents,
	allTeachers,
	allLessonTypes,
	allLessonAgreements,

	userRoleMap: new Map(allUserRoles.map((ur) => [ur.user_id, ur.role])),

	// --- Soft helpers (return undefined if not found) ---

	getProfile: (user: TestUser) => profileByEmail.get(user),

	getUserId: (user: TestUser) => profileByEmail.get(user)?.user_id,

	getRole: (user: TestUser) => {
		const profile = profileByEmail.get(user);
		if (!profile) return undefined;
		return allUserRoles.find((ur) => ur.user_id === profile.user_id);
	},

	// --- Strict helpers (throw if not found) ---

	requireProfile: (user: TestUser) => {
		const profile = profileByEmail.get(user);
		if (!profile) {
			throw new Error(`Profile not found for ${user}`);
		}
		return profile;
	},

	requireUserId: (user: TestUser) => {
		const profile = profileByEmail.get(user);
		if (!profile) {
			throw new Error(`Profile not found for ${user}`);
		}
		return profile.user_id;
	},

	requireRole: (user: TestUser) => {
		const profile = profileByEmail.get(user);
		if (!profile) {
			throw new Error(`Profile not found for ${user}`);
		}
		const role = allUserRoles.find((ur) => ur.user_id === profile.user_id);
		if (!role) {
			throw new Error(`Role not found for ${user}`);
		}
		return role;
	},

	requireStudentId: (user: TestUser) => {
		const profile = profileByEmail.get(user);
		if (!profile) {
			throw new Error(`Profile not found for ${user}`);
		}
		const student = studentByUserId.get(profile.user_id);
		if (!student) {
			throw new Error(`Student record not found for ${user}`);
		}
		return student.id;
	},

	requireTeacherId: (user: TestUser) => {
		const profile = profileByEmail.get(user);
		if (!profile) {
			throw new Error(`Profile not found for ${user}`);
		}
		const teacher = teacherByUserId.get(profile.user_id);
		if (!teacher) {
			throw new Error(`Teacher record not found for ${user}`);
		}
		return teacher.id;
	},

	requireLessonTypeId: (name: string) => {
		const lt = allLessonTypes.find((l) => l.name === name);
		if (!lt) {
			throw new Error(`Lesson type not found: ${name}`);
		}
		return lt.id;
	},

	requireAgreementId: (studentUser: TestUser, teacherUser: TestUser) => {
		const studentUserId = fixtures.requireUserId(studentUser);
		const teacherId = fixtures.requireTeacherId(teacherUser);
		const agreement = allLessonAgreements.find(
			(a) => a.student_user_id === studentUserId && a.teacher_id === teacherId,
		);
		if (!agreement) {
			throw new Error(`Lesson agreement not found for ${studentUser} with ${teacherUser}`);
		}
		return agreement.id;
	},
};
