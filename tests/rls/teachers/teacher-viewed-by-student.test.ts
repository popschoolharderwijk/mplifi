import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const teacherAliceId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);
const teacherBobId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);
const teacherEveId = fixtures.requireTeacherId(TestUsers.TEACHER_EVE);
const teacherAliceProfile = fixtures.requireProfile(TestUsers.TEACHER_ALICE);

/**
 * teacher_viewed_by_student view permissions:
 *
 * This view is intended ONLY for students. It exposes limited teacher info
 * (name, avatar, phone) for teachers the student has lesson agreements with.
 *
 * STUDENTS:
 * - Can only see teachers they have lesson agreements with
 * - Only see: teacher_id, first_name, last_name, avatar_url, phone_number
 * - Cannot see: email or other profile fields
 *
 * ALL OTHER ROLES (teacher, staff, admin, site_admin, user without role):
 * - See nothing via this view
 * - Staff/admin/site_admin access teachers and profiles directly via their own RLS policies
 */
describe('RLS: teacher_viewed_by_student SELECT', () => {
	it('student sees only their own teachers', async () => {
		// Student 009 has agreements with Teacher Alice and Teacher Diana
		const db = await createClientAs(TestUsers.STUDENT_009);

		const { data, error } = await db.from('teacher_viewed_by_student').select('*');

		expect(error).toBeNull();
		// Student 009 should see at least 1 teacher (Alice)
		expect(data?.length).toBeGreaterThanOrEqual(1);
		const teacherIds = data?.map((t) => t.teacher_id) ?? [];
		expect(teacherIds).toContain(teacherAliceId);

		// Verify only allowed fields are present
		const firstTeacher = data?.[0];
		expect(firstTeacher).toHaveProperty('teacher_id');
		expect(firstTeacher).toHaveProperty('first_name');
		expect(firstTeacher).toHaveProperty('last_name');
		expect(firstTeacher).toHaveProperty('avatar_url');
		expect(firstTeacher).toHaveProperty('phone_number');
		// Should NOT have email
		expect(firstTeacher).not.toHaveProperty('email');
	});

	it('student sees correct teacher data', async () => {
		// Student 009 has agreement with Teacher Alice
		const db = await createClientAs(TestUsers.STUDENT_009);

		const { data, error } = await db
			.from('teacher_viewed_by_student')
			.select('*')
			.eq('teacher_id', teacherAliceId)
			.single();

		expect(error).toBeNull();
		expect(data).toBeDefined();
		expect(data?.teacher_id).toBe(teacherAliceId);
		expect(data?.first_name).toBe(teacherAliceProfile.first_name);
		expect(data?.last_name).toBe(teacherAliceProfile.last_name);
		expect(data?.avatar_url).toBe(teacherAliceProfile.avatar_url);
		expect(data?.phone_number).toBe(teacherAliceProfile.phone_number);
	});

	it('student cannot see teachers they have no agreements with', async () => {
		// Student 001 has only Bandcoaching with Teacher Eve, not with Alice or Bob
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teacher_viewed_by_student').select('*');

		expect(error).toBeNull();
		// Student 001 should see only Teacher Eve (from Bandcoaching)
		expect(data?.length).toBeGreaterThanOrEqual(1);
		const teacherIds = data?.map((t) => t.teacher_id) ?? [];
		expect(teacherIds).toContain(teacherEveId);
		// Should NOT see Teacher Alice or Bob (no agreements with them)
		expect(teacherIds).not.toContain(teacherAliceId);
		expect(teacherIds).not.toContain(teacherBobId);
	});

	it('teacher sees nothing via view', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teacher_viewed_by_student').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff sees nothing via view', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('teacher_viewed_by_student').select('*');

		expect(error).toBeNull();
		// Staff should access teachers and profiles tables directly
		expect(data).toHaveLength(0);
	});

	it('admin sees nothing via view', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('teacher_viewed_by_student').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('site_admin sees nothing via view', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('teacher_viewed_by_student').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('user without role sees nothing via view', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.from('teacher_viewed_by_student').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('view does not expose email or other sensitive fields', async () => {
		// Student 009 has agreement with Teacher Alice
		const db = await createClientAs(TestUsers.STUDENT_009);

		const { data, error } = await db.from('teacher_viewed_by_student').select('*').limit(1).single();

		expect(error).toBeNull();
		expect(data).toBeDefined();

		// Should have allowed fields
		expect(data).toHaveProperty('teacher_id');
		expect(data).toHaveProperty('first_name');
		expect(data).toHaveProperty('last_name');
		expect(data).toHaveProperty('avatar_url');
		expect(data).toHaveProperty('phone_number');

		// Should NOT have sensitive fields
		expect(data).not.toHaveProperty('email');
		expect(data).not.toHaveProperty('user_id');
		expect(data).not.toHaveProperty('created_at');
		expect(data).not.toHaveProperty('updated_at');
	});
});
