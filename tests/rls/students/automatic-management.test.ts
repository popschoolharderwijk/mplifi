import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { LessonAgreementInsert } from '../types';
import { setupDatabaseStateVerification, type DatabaseState } from '../db-state';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

const dbNoRLS = createClientBypassRLS();

// User IDs for testing
// Use a student that doesn't exist in seed data, or use a user without role
// We'll use USER_001 which has no student record initially
const studentCUserId = fixtures.requireUserId(TestUsers.USER_001);
const teacherAliceId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);
const lessonTypeId = fixtures.requireLessonTypeId('Gitaar');

/**
 * Automatic student management via lesson agreements:
 *
 * - Students are automatically created when a lesson agreement is inserted
 * - Students are automatically deleted when the last lesson agreement is deleted
 * - No one can manually insert or delete students
 */
describe('RLS: students automatic management via lesson agreements', () => {
	it('student is automatically created when lesson agreement is inserted and deleted when all agreements are removed', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		// Verify student does not exist
		const { data: studentsBefore } = await dbNoRLS.from('students').select('*').eq('user_id', studentCUserId);
		expect(studentsBefore).toHaveLength(0);

		// Insert lesson agreement
		const newAgreement: LessonAgreementInsert = {
			student_user_id: studentCUserId,
			teacher_id: teacherAliceId,
			lesson_type_id: lessonTypeId,
			day_of_week: 1,
			start_time: '10:00',
			start_date: '2024-01-01',
			is_active: true,
		};

		const { data: inserted, error: insertError } = await db.from('lesson_agreements').insert(newAgreement).select();
		expect(insertError).toBeNull();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert lesson agreement');
		}

		// Verify student was automatically created
		const { data: studentsAfter } = await dbNoRLS.from('students').select('*').eq('user_id', studentCUserId);
		expect(studentsAfter).toHaveLength(1);
		expect(studentsAfter?.[0]?.user_id).toBe(studentCUserId);

		// Cleanup: delete all agreements for this student via normal client (trigger should automatically delete student)
		await db.from('lesson_agreements').delete().eq('student_user_id', studentCUserId);

		// Verify all agreements are gone
		const { data: agreementsAfter } = await dbNoRLS
			.from('lesson_agreements')
			.select('*')
			.eq('student_user_id', studentCUserId);
		expect(agreementsAfter).toHaveLength(0);

		// Verify student was automatically deleted by trigger
		const { data: studentsAfterCleanup } = await dbNoRLS.from('students').select('*').eq('user_id', studentCUserId);
		expect(studentsAfterCleanup).toHaveLength(0);
	});

	it('student is created with 2 agreements and remains when 1 is deleted, but is deleted when the 2nd is removed', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		// Verify student does not exist initially
		const { data: studentsInitial } = await dbNoRLS.from('students').select('*').eq('user_id', studentCUserId);
		expect(studentsInitial).toHaveLength(0);

		// Create first lesson agreement (will create the student)
		const agreement1: LessonAgreementInsert = {
			student_user_id: studentCUserId,
			teacher_id: teacherAliceId,
			lesson_type_id: lessonTypeId,
			day_of_week: 3,
			start_time: '12:00',
			start_date: '2024-01-01',
			is_active: true,
		};

		const { data: inserted1, error: error1 } = await db.from('lesson_agreements').insert(agreement1).select();
		expect(error1).toBeNull();
		expect(inserted1).toHaveLength(1);
		if (!inserted1 || inserted1.length === 0) {
			throw new Error('Failed to insert first lesson agreement');
		}

		// Verify student was automatically created after first agreement
		const { data: studentsAfterFirst } = await dbNoRLS.from('students').select('*').eq('user_id', studentCUserId);
		expect(studentsAfterFirst).toHaveLength(1);
		expect(studentsAfterFirst?.[0]?.user_id).toBe(studentCUserId);

		// Create second lesson agreement
		const agreement2: LessonAgreementInsert = {
			student_user_id: studentCUserId,
			teacher_id: teacherAliceId,
			lesson_type_id: lessonTypeId,
			day_of_week: 4,
			start_time: '13:00',
			start_date: '2024-01-01',
			is_active: true,
		};

		const { data: inserted2, error: error2 } = await db.from('lesson_agreements').insert(agreement2).select();
		expect(error2).toBeNull();
		expect(inserted2).toHaveLength(1);
		if (!inserted2 || inserted2.length === 0) {
			throw new Error('Failed to insert second lesson agreement');
		}

		// Verify student still exists with 2 agreements
		const { data: studentsWithTwo } = await dbNoRLS.from('students').select('*').eq('user_id', studentCUserId);
		expect(studentsWithTwo).toHaveLength(1);

		// Verify there are 2 agreements
		const { data: agreementsBefore } = await dbNoRLS
			.from('lesson_agreements')
			.select('*')
			.eq('student_user_id', studentCUserId);
		expect(agreementsBefore).toHaveLength(2);

		// Delete first agreement
		const { error: deleteError1 } = await db.from('lesson_agreements').delete().eq('id', inserted1[0].id);
		expect(deleteError1).toBeNull();

		// Verify student still exists (because second agreement remains)
		const { data: studentsAfterOneDeleted } = await dbNoRLS
			.from('students')
			.select('*')
			.eq('user_id', studentCUserId);
		expect(studentsAfterOneDeleted).toHaveLength(1);

		// Verify only 1 agreement remains
		const { data: agreementsAfterOne } = await dbNoRLS
			.from('lesson_agreements')
			.select('*')
			.eq('student_user_id', studentCUserId);
		expect(agreementsAfterOne).toHaveLength(1);

		// Delete second (last) agreement
		const { error: deleteError2 } = await db.from('lesson_agreements').delete().eq('id', inserted2[0].id);
		expect(deleteError2).toBeNull();

		// Verify student was automatically deleted when last agreement was removed
		const { data: studentsAfterBothDeleted } = await dbNoRLS
			.from('students')
			.select('*')
			.eq('user_id', studentCUserId);
		expect(studentsAfterBothDeleted).toHaveLength(0);

		// Verify no agreements remain
		const { data: agreementsAfterBoth } = await dbNoRLS
			.from('lesson_agreements')
			.select('*')
			.eq('student_user_id', studentCUserId);
		expect(agreementsAfterBoth).toHaveLength(0);
	});

	it('expired agreements still count - student remains even if all agreements are expired', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		// Create an expired agreement
		const expiredAgreement: LessonAgreementInsert = {
			student_user_id: studentCUserId,
			teacher_id: teacherAliceId,
			lesson_type_id: lessonTypeId,
			day_of_week: 5,
			start_time: '14:00',
			start_date: '2020-01-01',
			end_date: '2020-12-31',
			is_active: false,
		};

		const { data: inserted } = await db.from('lesson_agreements').insert(expiredAgreement).select();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert expired lesson agreement');
		}

		// Verify student exists
		const { data: students } = await dbNoRLS.from('students').select('*').eq('user_id', studentCUserId);
		expect(students).toHaveLength(1);

		// Cleanup: delete all agreements for this student via normal client (trigger should automatically delete student)
		await db.from('lesson_agreements').delete().eq('student_user_id', studentCUserId);

		// Verify all agreements are gone
		const { data: agreementsAfter } = await dbNoRLS
			.from('lesson_agreements')
			.select('*')
			.eq('student_user_id', studentCUserId);
		expect(agreementsAfter).toHaveLength(0);

		// Verify student was automatically deleted by trigger
		const { data: studentsAfterCleanup } = await dbNoRLS.from('students').select('*').eq('user_id', studentCUserId);
		expect(studentsAfterCleanup).toHaveLength(0);
	});

	it('multiple agreements deleted in one operation removes student automatically', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		// Create multiple agreements for the same student
		const agreement1: LessonAgreementInsert = {
			student_user_id: studentCUserId,
			teacher_id: teacherAliceId,
			lesson_type_id: lessonTypeId,
			day_of_week: 1,
			start_time: '10:00',
			start_date: '2024-01-01',
			is_active: true,
		};

		const agreement2: LessonAgreementInsert = {
			student_user_id: studentCUserId,
			teacher_id: teacherAliceId,
			lesson_type_id: lessonTypeId,
			day_of_week: 2,
			start_time: '11:00',
			start_date: '2024-01-01',
			is_active: true,
		};

		const { data: inserted1 } = await db.from('lesson_agreements').insert(agreement1).select();
		const { data: inserted2 } = await db.from('lesson_agreements').insert(agreement2).select();
		expect(inserted1).toHaveLength(1);
		expect(inserted2).toHaveLength(1);

		// Verify student exists
		const { data: studentsBefore } = await dbNoRLS.from('students').select('*').eq('user_id', studentCUserId);
		expect(studentsBefore).toHaveLength(1);

		// Delete all agreements via normal client (should trigger automatic student deletion)
		const { error: deleteError } = await db
			.from('lesson_agreements')
			.delete()
			.eq('student_user_id', studentCUserId);
		expect(deleteError).toBeNull();

		// Verify all agreements are gone
		const { data: agreementsAfter } = await dbNoRLS
			.from('lesson_agreements')
			.select('*')
			.eq('student_user_id', studentCUserId);
		expect(agreementsAfter).toHaveLength(0);

		// Verify student was automatically deleted by trigger
		const { data: studentsAfter } = await dbNoRLS.from('students').select('*').eq('user_id', studentCUserId);
		expect(studentsAfter).toHaveLength(0);
	});
});
