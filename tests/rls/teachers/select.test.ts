import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

/**
 * Teachers SELECT permissions:
 *
 * TEACHERS:
 * - Can view their own teacher record only
 *
 * STAFF/ADMIN/SITE_ADMIN:
 * - Can view all teacher records
 *
 * OTHER USERS (students, users without role):
 * - Cannot view any teacher records
 */
describe('RLS: teachers SELECT', () => {
	it('site_admin sees all teachers', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('teachers').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allTeachers.length);
	});

	it('admin sees all teachers', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('teachers').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allTeachers.length);
	});

	it('staff sees all teachers', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('teachers').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(fixtures.allTeachers.length);
	});

	it('teacher can see only their own record', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('teachers').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.user_id).toBe(aliceUserId);
	});

	it('teacher cannot see other teachers', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const bobTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);

		const { data, error } = await db.from('teachers').select('*').eq('id', bobTeacherId);

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('student cannot see any teachers', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teachers').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('user without role cannot see any teachers', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.from('teachers').select('*');

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});
