import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import type { LessonAgreementInsert } from '../../types';
import { expectNoError, unwrap, unwrapError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { type TestUser, TestUsers } from '../test-users';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

// Use student-009 who has agreement with teacher-alice
const studentAUserId = fixtures.requireUserId(TestUsers.STUDENT_009);
const teacherAliceUserId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);
const lessonTypeId = fixtures.requireLessonTypeId('Gitaarles');
const testAgreementId = fixtures.requireAgreementId(TestUsers.STUDENT_009, TestUsers.TEACHER_ALICE);

/**
 * Lesson agreements INSERT/UPDATE/DELETE permissions:
 *
 * STAFF/ADMIN/SITE_ADMIN:
 * - Can insert lesson agreements
 * - Can update lesson agreements
 * - Can delete lesson agreements
 *
 * STUDENTS and TEACHERS:
 * - Cannot insert, update, or delete lesson agreements (even their own)
 */
describe('RLS: lesson_agreements INSERT - blocked for students and teachers', () => {
	const newAgreement: LessonAgreementInsert = {
		student_user_id: studentAUserId,
		teacher_user_id: teacherAliceUserId,
		lesson_type_id: lessonTypeId,
		day_of_week: 4,
		start_time: '17:00',
		start_date: '2024-01-01',
		is_active: true,
		duration_minutes: 30,
		frequency: 'weekly',
		price_per_lesson: 30,
	};

	it('student cannot insert lesson agreement', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		unwrapError(await db.from('lesson_agreements').insert(newAgreement).select());
	});

	it('teacher cannot insert lesson agreement', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		unwrapError(await db.from('lesson_agreements').insert(newAgreement).select());
	});
});

describe('RLS: lesson_agreements INSERT - staff permissions', () => {
	const newAgreement: LessonAgreementInsert = {
		student_user_id: studentAUserId,
		teacher_user_id: teacherAliceUserId,
		lesson_type_id: lessonTypeId,
		day_of_week: 4,
		start_time: '17:00',
		start_date: '2024-01-01',
		is_active: true,
		duration_minutes: 30,
		frequency: 'weekly',
		price_per_lesson: 30,
	};

	async function insert(user: TestUser) {
		const db = await createClientAs(user);
		const [data] = unwrap(await db.from('lesson_agreements').insert(newAgreement).select());

		expect(data.student_user_id).toBe(newAgreement.student_user_id);
		expect(data.teacher_user_id).toBe(newAgreement.teacher_user_id);

		// Cleanup
		unwrap(await db.from('lesson_agreements').delete().eq('id', data.id).select());
	}

	it('staff can insert lesson agreement', async () => {
		await insert(TestUsers.STAFF_ONE);
	});

	it('admin can insert lesson agreement', async () => {
		await insert(TestUsers.ADMIN_ONE);
	});

	it('site_admin can insert lesson agreement', async () => {
		await insert(TestUsers.SITE_ADMIN);
	});
});

describe('RLS: lesson_agreements UPDATE - blocked for students and teachers', () => {
	it('student cannot update lesson agreement', async () => {
		// Use student-009 who has the agreement but cannot update it
		const db = await createClientAs(TestUsers.STUDENT_009);

		// Use agreement ID that student can see but cannot update
		const data = unwrap(
			await db.from('lesson_agreements').update({ notes: 'Hacked notes' }).eq('id', testAgreementId).select(),
		);

		// RLS blocks - 0 rows affected
		expect(data).toHaveLength(0);
	});

	it('teacher cannot update lesson agreement', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		// Use agreement ID that teacher can see but cannot update
		const data = unwrap(
			await db.from('lesson_agreements').update({ notes: 'Hacked notes' }).eq('id', testAgreementId).select(),
		);

		// RLS blocks - 0 rows affected
		expect(data).toHaveLength(0);
	});
});

describe('RLS: lesson_agreements UPDATE - staff permissions', () => {
	async function update(user: TestUser) {
		const db = await createClientAs(user);

		// Get first agreement to update
		const resultAgreement = await db.from('lesson_agreements').select('*').limit(1).single();
		const agreement = unwrap(resultAgreement);

		const newNotes = `Updated by ${user}`;
		const data = unwrap(
			await db.from('lesson_agreements').update({ notes: newNotes }).eq('id', agreement.id).select(),
		);

		expect(data).toHaveLength(1);
		expect(data[0].notes).toBe(newNotes);

		// Restore original notes
		unwrap(await db.from('lesson_agreements').update({ notes: agreement.notes }).eq('id', agreement.id));
	}

	it('staff can update lesson agreement', async () => {
		await update(TestUsers.STAFF_ONE);
	});

	it('admin can update lesson agreement', async () => {
		await update(TestUsers.ADMIN_ONE);
	});

	it('site_admin can update lesson agreement', async () => {
		await update(TestUsers.SITE_ADMIN);
	});
});

describe('RLS: lesson_agreements DELETE - blocked for students and teachers', () => {
	it('student cannot delete lesson agreement', async () => {
		// Use student-009 who has the agreement but cannot delete it
		const db = await createClientAs(TestUsers.STUDENT_009);

		// Use agreement ID that student can see but cannot delete
		const data = unwrap(await db.from('lesson_agreements').delete().eq('id', testAgreementId).select());

		// RLS blocks - 0 rows affected
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete lesson agreement', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		// Use agreement ID that teacher can see but cannot delete
		const data = unwrap(await db.from('lesson_agreements').delete().eq('id', testAgreementId).select());

		expect(data).toHaveLength(0);
	});
});

describe('RLS: lesson_agreements DELETE - staff permissions', () => {
	async function remove(user: TestUser) {
		const db = await createClientAs(user);

		// Create an agreement to delete
		const newAgreement: LessonAgreementInsert = {
			student_user_id: studentAUserId,
			teacher_user_id: teacherAliceUserId,
			lesson_type_id: lessonTypeId,
			day_of_week: 5,
			start_time: '18:00',
			start_date: '2024-01-01',
			is_active: true,
			duration_minutes: 30,
			frequency: 'weekly',
			price_per_lesson: 30,
		};

		const { data: inserted, error: insertError } = await db
			.from('lesson_agreements')
			.insert(newAgreement)
			.select()
			.single();
		expectNoError(inserted, insertError);

		// Delete
		const { data, error } = await db.from('lesson_agreements').delete().eq('id', inserted.id).select();

		expectNoError(data, error);
		expect(data).toHaveLength(1);
		expect(data[0].id).toBe(inserted.id);
	}

	it('staff can delete lesson agreement', async () => {
		await remove(TestUsers.STAFF_ONE);
	});

	it('admin can delete lesson agreement', async () => {
		await remove(TestUsers.ADMIN_ONE);
	});

	it('site_admin can delete lesson agreement', async () => {
		await remove(TestUsers.SITE_ADMIN);
	});
});

describe('RLS: lesson_agreements - teacher cannot be their own student', () => {
	// Teacher Alice's user_id - she cannot be a student in her own lesson
	const teacherAliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

	it('cannot insert lesson agreement where teacher is their own student', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const selfAgreement: LessonAgreementInsert = {
			student_user_id: teacherAliceUserId, // Teacher Alice as student
			teacher_user_id: teacherAliceUserId, // Teacher Alice as teacher
			lesson_type_id: lessonTypeId,
			day_of_week: 1,
			start_time: '10:00',
			start_date: '2024-01-01',
			is_active: true,
			duration_minutes: 30,
			frequency: 'weekly',
			price_per_lesson: 30,
		};

		const error = unwrapError(await db.from('lesson_agreements').insert(selfAgreement).select());

		// Should fail - teacher cannot be their own student
		expect(error.message).toContain('teacher cannot be their own student');
	});

	it('cannot update lesson agreement to make teacher their own student', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// First create a valid agreement
		const validAgreement: LessonAgreementInsert = {
			student_user_id: studentAUserId,
			teacher_user_id: teacherAliceUserId,
			lesson_type_id: lessonTypeId,
			day_of_week: 1,
			start_time: '11:00',
			start_date: '2024-01-01',
			is_active: true,
			duration_minutes: 30,
			frequency: 'weekly',
			price_per_lesson: 30,
		};

		const result = await db.from('lesson_agreements').insert(validAgreement).select().single();
		const inserted = unwrap(result);

		// Try to update student_user_id to be the teacher's user_id
		const error = unwrapError(
			await db
				.from('lesson_agreements')
				.update({ student_user_id: teacherAliceUserId })
				.eq('id', inserted.id)
				.select(),
		);

		// Should fail - teacher cannot be their own student
		expect(error.message).toContain('teacher cannot be their own student');

		// Cleanup
		await db.from('lesson_agreements').delete().eq('id', inserted.id);
	});
});
