import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { LessonAgreementInsert } from '../types';

const studentAUserId = fixtures.requireUserId(TestUsers.STUDENT_A);
const teacherAliceId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);
const lessonTypeId = fixtures.requireLessonTypeId('Gitaar');
const testAgreementId = fixtures.requireAgreementId(TestUsers.STUDENT_A, TestUsers.TEACHER_ALICE);

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
		teacher_id: teacherAliceId,
		lesson_type_id: lessonTypeId,
		day_of_week: 4,
		start_time: '17:00',
		start_date: '2024-01-01',
		is_active: true,
	};

	it('student cannot insert lesson agreement', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		const { data, error } = await db.from('lesson_agreements').insert(newAgreement).select();

		// Should fail - no INSERT policy for students
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('teacher cannot insert lesson agreement', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db.from('lesson_agreements').insert(newAgreement).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: lesson_agreements INSERT - staff permissions', () => {
	const newAgreement: LessonAgreementInsert = {
		student_user_id: studentAUserId,
		teacher_id: teacherAliceId,
		lesson_type_id: lessonTypeId,
		day_of_week: 4,
		start_time: '17:00',
		start_date: '2024-01-01',
		is_active: true,
	};

	it('staff can insert lesson agreement', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		const { data, error } = await db.from('lesson_agreements').insert(newAgreement).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.student_user_id).toBe(newAgreement.student_user_id);
		expect(data?.[0]?.teacher_id).toBe(newAgreement.teacher_id);

		// Cleanup
		if (data?.[0]?.id) {
			await db.from('lesson_agreements').delete().eq('id', data[0].id);
		}
	});

	it('admin can insert lesson agreement', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db.from('lesson_agreements').insert(newAgreement).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.student_user_id).toBe(newAgreement.student_user_id);
		expect(data?.[0]?.teacher_id).toBe(newAgreement.teacher_id);

		// Cleanup
		if (data?.[0]?.id) {
			await db.from('lesson_agreements').delete().eq('id', data[0].id);
		}
	});

	it('site_admin can insert lesson agreement', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const { data, error } = await db.from('lesson_agreements').insert(newAgreement).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.student_user_id).toBe(newAgreement.student_user_id);
		expect(data?.[0]?.teacher_id).toBe(newAgreement.teacher_id);

		// Cleanup
		if (data?.[0]?.id) {
			await db.from('lesson_agreements').delete().eq('id', data[0].id);
		}
	});
});

describe('RLS: lesson_agreements UPDATE - blocked for students and teachers', () => {
	it('student cannot update lesson agreement', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		// Use agreement ID that student can see but cannot update
		const { data, error } = await db
			.from('lesson_agreements')
			.update({ notes: 'Hacked notes' })
			.eq('id', testAgreementId)
			.select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot update lesson agreement', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		// Use agreement ID that teacher can see but cannot update
		const { data, error } = await db
			.from('lesson_agreements')
			.update({ notes: 'Hacked notes' })
			.eq('id', testAgreementId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: lesson_agreements UPDATE - staff permissions', () => {
	it('staff can update lesson agreement', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		// Get first agreement to update
		const { data: agreements } = await db.from('lesson_agreements').select('*').limit(1);
		if (!agreements || agreements.length === 0) {
			throw new Error('No lesson agreements found for test');
		}

		const originalAgreement = agreements[0];
		const newNotes = 'Updated by Staff';

		// Update
		const { data, error } = await db
			.from('lesson_agreements')
			.update({ notes: newNotes })
			.eq('id', originalAgreement.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.notes).toBe(newNotes);

		// Restore original notes
		await db.from('lesson_agreements').update({ notes: originalAgreement.notes }).eq('id', originalAgreement.id);
	});

	it('admin can update lesson agreement', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Get first agreement to update
		const { data: agreements } = await db.from('lesson_agreements').select('*').limit(1);
		if (!agreements || agreements.length === 0) {
			throw new Error('No lesson agreements found for test');
		}

		const originalAgreement = agreements[0];
		const newNotes = 'Updated by Admin';

		// Update
		const { data, error } = await db
			.from('lesson_agreements')
			.update({ notes: newNotes })
			.eq('id', originalAgreement.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.notes).toBe(newNotes);

		// Restore original notes
		await db.from('lesson_agreements').update({ notes: originalAgreement.notes }).eq('id', originalAgreement.id);
	});

	it('site_admin can update lesson agreement', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Get first agreement to update
		const { data: agreements } = await db.from('lesson_agreements').select('*').limit(1);
		if (!agreements || agreements.length === 0) {
			throw new Error('No lesson agreements found for test');
		}

		const originalAgreement = agreements[0];
		const newNotes = 'Updated by Site Admin';

		// Update
		const { data, error } = await db
			.from('lesson_agreements')
			.update({ notes: newNotes })
			.eq('id', originalAgreement.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.notes).toBe(newNotes);

		// Restore original notes
		await db.from('lesson_agreements').update({ notes: originalAgreement.notes }).eq('id', originalAgreement.id);
	});
});

describe('RLS: lesson_agreements DELETE - blocked for students and teachers', () => {
	it('student cannot delete lesson agreement', async () => {
		const db = await createClientAs(TestUsers.STUDENT_A);

		// Use agreement ID that student can see but cannot delete
		const { data, error } = await db.from('lesson_agreements').delete().eq('id', testAgreementId).select();

		// RLS blocks - 0 rows affected
		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete lesson agreement', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		// Use agreement ID that teacher can see but cannot delete
		const { data, error } = await db.from('lesson_agreements').delete().eq('id', testAgreementId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: lesson_agreements DELETE - staff permissions', () => {
	it('staff can delete lesson agreement', async () => {
		const db = await createClientAs(TestUsers.STAFF);

		// Create an agreement to delete
		const newAgreement: LessonAgreementInsert = {
			student_user_id: studentAUserId,
			teacher_id: teacherAliceId,
			lesson_type_id: lessonTypeId,
			day_of_week: 5,
			start_time: '18:00',
			start_date: '2024-01-01',
			is_active: true,
		};

		const { data: inserted, error: insertError } = await db.from('lesson_agreements').insert(newAgreement).select();
		expect(insertError).toBeNull();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert lesson agreement');
		}

		const agreementId = inserted[0].id;

		// Delete
		const { data, error } = await db.from('lesson_agreements').delete().eq('id', agreementId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(agreementId);
	});

	it('admin can delete lesson agreement', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Create an agreement to delete
		const newAgreement: LessonAgreementInsert = {
			student_user_id: studentAUserId,
			teacher_id: teacherAliceId,
			lesson_type_id: lessonTypeId,
			day_of_week: 6,
			start_time: '19:00',
			start_date: '2024-01-01',
			is_active: true,
		};

		const { data: inserted, error: insertError } = await db.from('lesson_agreements').insert(newAgreement).select();
		expect(insertError).toBeNull();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert lesson agreement');
		}

		const agreementId = inserted[0].id;

		// Delete
		const { data, error } = await db.from('lesson_agreements').delete().eq('id', agreementId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(agreementId);
	});

	it('site_admin can delete lesson agreement', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		// Create an agreement to delete
		const newAgreement: LessonAgreementInsert = {
			student_user_id: studentAUserId,
			teacher_id: teacherAliceId,
			lesson_type_id: lessonTypeId,
			day_of_week: 0,
			start_time: '20:00',
			start_date: '2024-01-01',
			is_active: true,
		};

		const { data: inserted, error: insertError } = await db.from('lesson_agreements').insert(newAgreement).select();
		expect(insertError).toBeNull();
		expect(inserted).toHaveLength(1);
		if (!inserted || inserted.length === 0) {
			throw new Error('Failed to insert lesson agreement');
		}

		const agreementId = inserted[0].id;

		// Delete
		const { data, error } = await db.from('lesson_agreements').delete().eq('id', agreementId).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(agreementId);
	});
});
