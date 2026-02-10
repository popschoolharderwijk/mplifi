import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { LessonAppointmentDeviationInsert } from '../types';

const dbNoRLS = createClientBypassRLS();

const agreementStudent009TeacherAlice = fixtures.requireAgreementId(TestUsers.STUDENT_009, TestUsers.TEACHER_ALICE);
const agreementStudent026TeacherBob = fixtures.requireAgreementId(TestUsers.STUDENT_026, TestUsers.TEACHER_BOB);

// Helper to calculate original_date from day_of_week and a reference date
function calculateOriginalDate(dayOfWeek: number, referenceDate: Date): string {
	const date = new Date(referenceDate);
	const currentDay = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
	const diff = dayOfWeek - currentDay;
	date.setDate(date.getDate() + diff);
	return date.toISOString().split('T')[0];
}

/**
 * Lesson Appointment Deviations INSERT/UPDATE/DELETE permissions:
 *
 * TEACHERS:
 * - Can insert/update/delete deviations for their own lessons
 *
 * ADMIN/SITE_ADMIN/STAFF:
 * - Can insert/update/delete deviations for any lesson
 *
 * STUDENTS:
 * - Cannot insert/update/delete deviations (only SELECT)
 *
 * OTHER USERS:
 * - Cannot insert/update/delete deviations
 */
describe('RLS: lesson_appointment_deviations INSERT - blocked for non-teacher/admin roles', () => {
	const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
	if (!agreementAlice) {
		throw new Error('Agreement not found');
	}

	const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-02-13'));
	const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

	const newDeviation: LessonAppointmentDeviationInsert = {
		lesson_agreement_id: agreementStudent009TeacherAlice,
		original_date: originalDate,
		original_start_time: agreementAlice.start_time,
		actual_date: '2024-02-15',
		actual_start_time: '14:00',
		created_by_user_id: aliceUserId,
		last_updated_by_user_id: aliceUserId,
	};

	it('user without role cannot insert deviation', async () => {
		const db = await createClientAs(TestUsers.USER_001);

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('student cannot insert deviation', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: lesson_appointment_deviations INSERT - teacher permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('teacher can insert deviation for their own lesson', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-02-13'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const newDeviation: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: agreementStudent009TeacherAlice,
			original_date: originalDate,
			original_start_time: agreementAlice.start_time,
			actual_date: '2024-02-15',
			actual_start_time: '14:00',
			created_by_user_id: aliceUserId,
			last_updated_by_user_id: aliceUserId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.lesson_agreement_id).toBe(agreementStudent009TeacherAlice);
		expect(data?.[0]?.created_by_user_id).toBe(aliceUserId);
		expect(data?.[0]?.last_updated_by_user_id).toBe(aliceUserId);

		// Cleanup
		if (data?.[0]?.id) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', data[0].id);
		}
	});

	it('teacher cannot insert deviation for other teachers lesson', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const agreementBob = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent026TeacherBob);
		if (!agreementBob) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementBob.day_of_week, new Date('2024-02-13'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const newDeviation: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: agreementStudent026TeacherBob,
			original_date: originalDate,
			original_start_time: agreementBob.start_time,
			actual_date: '2024-02-16',
			actual_start_time: '15:00',
			created_by_user_id: aliceUserId,
			last_updated_by_user_id: aliceUserId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('constraint: actual_date must be within 7 days of original_date', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-02-13'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const newDeviation: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: agreementStudent009TeacherAlice,
			original_date: originalDate,
			original_start_time: agreementAlice.start_time,
			actual_date: '2024-02-25', // More than 7 days away
			actual_start_time: '14:00',
			created_by_user_id: aliceUserId,
			last_updated_by_user_id: aliceUserId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: lesson_appointment_deviations INSERT - admin/staff permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		await verifyState(initialState);
	});

	it('admin can insert deviation for any lesson', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-02-13'));
		const adminUserId = fixtures.requireUserId(TestUsers.ADMIN_ONE);

		const newDeviation: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: agreementStudent009TeacherAlice,
			original_date: originalDate,
			original_start_time: agreementAlice.start_time,
			actual_date: '2024-02-15',
			actual_start_time: '14:00',
			created_by_user_id: adminUserId,
			last_updated_by_user_id: adminUserId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		// Cleanup
		if (data?.[0]?.id) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', data[0].id);
		}
	});

	it('site_admin can insert deviation for any lesson', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const agreementBob = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent026TeacherBob);
		if (!agreementBob) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementBob.day_of_week, new Date('2024-02-13'));
		const siteAdminUserId = fixtures.requireUserId(TestUsers.SITE_ADMIN);

		const newDeviation: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: agreementStudent026TeacherBob,
			original_date: originalDate,
			original_start_time: agreementBob.start_time,
			actual_date: '2024-02-16',
			actual_start_time: '15:00',
			created_by_user_id: siteAdminUserId,
			last_updated_by_user_id: siteAdminUserId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		// Cleanup
		if (data?.[0]?.id) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', data[0].id);
		}
	});
});

describe('RLS: lesson_appointment_deviations UPDATE - teacher permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let testDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		// Create a test deviation
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-02-13'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
				original_start_time: agreementAlice.start_time,
				actual_date: '2024-02-15',
				actual_start_time: '14:00',
				created_by_user_id: aliceUserId,
				last_updated_by_user_id: aliceUserId,
			})
			.select()
			.single();

		if (data) {
			testDeviationId = data.id;
		}
	});

	afterAll(async () => {
		if (testDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', testDeviationId);
		}
		await verifyState(initialState);
	});

	it('teacher can update deviation for their own lesson', async () => {
		if (!testDeviationId) {
			throw new Error('Test deviation not created');
		}

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.update({
				actual_date: '2024-02-16',
				actual_start_time: '15:00',
				last_updated_by_user_id: aliceUserId,
			})
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.actual_date).toBe('2024-02-16');
		expect(data?.[0]?.actual_start_time).toBe('15:00:00');
		expect(data?.[0]?.last_updated_by_user_id).toBe(aliceUserId);
	});

	it('teacher cannot update deviation for other teachers lesson', async () => {
		if (!testDeviationId) {
			throw new Error('Test deviation not created');
		}

		const db = await createClientAs(TestUsers.TEACHER_BOB);
		const bobUserId = fixtures.requireUserId(TestUsers.TEACHER_BOB);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.update({
				actual_date: '2024-02-17',
				actual_start_time: '16:00',
				last_updated_by_user_id: bobUserId,
			})
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot change original_date or original_start_time', async () => {
		if (!testDeviationId) {
			throw new Error('Test deviation not created');
		}

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		// Try to change original_date (should be blocked by trigger)
		const { error } = await db
			.from('lesson_appointment_deviations')
			.update({
				original_date: '2024-02-20',
				last_updated_by_user_id: aliceUserId,
			})
			.eq('id', testDeviationId)
			.select();

		// Should fail due to immutability trigger
		expect(error).not.toBeNull();
		expect(error?.message).toContain('Cannot change original_date after creation');
	});
});

describe('RLS: lesson_appointment_deviations UPDATE - admin/staff permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let testDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		// Create a test deviation
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-02-13'));
		const adminUserId = fixtures.requireUserId(TestUsers.ADMIN_ONE);

		const { data } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
				original_start_time: agreementAlice.start_time,
				actual_date: '2024-02-15',
				actual_start_time: '14:00',
				created_by_user_id: adminUserId,
				last_updated_by_user_id: adminUserId,
			})
			.select()
			.single();

		if (data) {
			testDeviationId = data.id;
		}
	});

	afterAll(async () => {
		if (testDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', testDeviationId);
		}
		await verifyState(initialState);
	});

	it('admin can update deviation for any lesson', async () => {
		if (!testDeviationId) {
			throw new Error('Test deviation not created');
		}

		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const adminUserId = fixtures.requireUserId(TestUsers.ADMIN_ONE);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.update({
				actual_date: '2024-02-17',
				actual_start_time: '16:00',
				last_updated_by_user_id: adminUserId,
			})
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.last_updated_by_user_id).toBe(adminUserId);
	});
});

describe('RLS: lesson_appointment_deviations DELETE - teacher permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let testDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		// Create a test deviation
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-02-13'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
				original_start_time: agreementAlice.start_time,
				actual_date: '2024-02-15',
				actual_start_time: '14:00',
				created_by_user_id: aliceUserId,
				last_updated_by_user_id: aliceUserId,
			})
			.select()
			.single();

		if (data) {
			testDeviationId = data.id;
		}
	});

	afterAll(async () => {
		if (testDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', testDeviationId);
		}
		await verifyState(initialState);
	});

	it('teacher can delete deviation for their own lesson', async () => {
		if (!testDeviationId) {
			throw new Error('Test deviation not created');
		}

		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(testDeviationId);

		// Mark as deleted so afterAll doesn't try to delete again
		testDeviationId = null;
	});
});

describe('RLS: lesson_appointment_deviations DELETE - blocked for non-teacher/admin roles', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let testDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		// Create a test deviation
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-02-13'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
				original_start_time: agreementAlice.start_time,
				actual_date: '2024-02-15',
				actual_start_time: '14:00',
				created_by_user_id: aliceUserId,
				last_updated_by_user_id: aliceUserId,
			})
			.select()
			.single();

		if (data) {
			testDeviationId = data.id;
		}
	});

	afterAll(async () => {
		if (testDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', testDeviationId);
		}
		await verifyState(initialState);
	});

	it('student cannot delete deviation', async () => {
		if (!testDeviationId) {
			throw new Error('Test deviation not created');
		}

		const db = await createClientAs(TestUsers.STUDENT_009);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('teacher cannot delete deviation for other teachers lesson', async () => {
		if (!testDeviationId) {
			throw new Error('Test deviation not created');
		}

		const db = await createClientAs(TestUsers.TEACHER_BOB);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: lesson_appointment_deviations DELETE - admin/staff permissions', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let testDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		// Create a test deviation
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-02-13'));
		const adminUserId = fixtures.requireUserId(TestUsers.ADMIN_ONE);

		const { data } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
				original_start_time: agreementAlice.start_time,
				actual_date: '2024-02-15',
				actual_start_time: '14:00',
				created_by_user_id: adminUserId,
				last_updated_by_user_id: adminUserId,
			})
			.select()
			.single();

		if (data) {
			testDeviationId = data.id;
		}
	});

	afterAll(async () => {
		if (testDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', testDeviationId);
		}
		await verifyState(initialState);
	});

	it('admin can delete deviation for any lesson', async () => {
		if (!testDeviationId) {
			throw new Error('Test deviation not created');
		}

		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(testDeviationId);

		// Mark as deleted so afterAll doesn't try to delete again
		testDeviationId = null;
	});
});

// =============================================================================
// IS_CANCELLED FUNCTIONALITY TESTS
// =============================================================================

describe('RLS: lesson_appointment_deviations is_cancelled - teacher can cancel lessons', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let testDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		if (testDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', testDeviationId);
		}
		await verifyState(initialState);
	});

	it('teacher can insert a cancelled lesson (is_cancelled=true with same original/actual dates)', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-03-05'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const newDeviation: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: agreementStudent009TeacherAlice,
			original_date: originalDate,
			original_start_time: agreementAlice.start_time,
			actual_date: originalDate, // Same as original (lesson is cancelled, not moved)
			actual_start_time: agreementAlice.start_time, // Same as original
			is_cancelled: true,
			created_by_user_id: aliceUserId,
			last_updated_by_user_id: aliceUserId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.is_cancelled).toBe(true);
		expect(data?.[0]?.actual_date).toBe(originalDate);
		expect(data?.[0]?.original_date).toBe(originalDate);

		testDeviationId = data?.[0]?.id ?? null;
	});
});

describe('RLS: lesson_appointment_deviations is_cancelled - constraint prevents invalid cancellations', () => {
	const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
	if (!agreementAlice) {
		throw new Error('Agreement not found');
	}

	it('constraint: cannot insert deviation with same dates when is_cancelled=false', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-03-12'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const newDeviation: LessonAppointmentDeviationInsert = {
			lesson_agreement_id: agreementStudent009TeacherAlice,
			original_date: originalDate,
			original_start_time: agreementAlice.start_time,
			actual_date: originalDate, // Same as original
			actual_start_time: agreementAlice.start_time, // Same as original
			is_cancelled: false, // Not cancelled, so this should fail
			created_by_user_id: aliceUserId,
			last_updated_by_user_id: aliceUserId,
		};

		const { data, error } = await db.from('lesson_appointment_deviations').insert(newDeviation).select();

		// Should fail due to constraint: deviation_must_actually_deviate_or_be_cancelled
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: lesson_appointment_deviations is_cancelled - update to cancel/restore', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let testDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();

		// Create a regular deviation (not cancelled)
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-03-19'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
				original_start_time: agreementAlice.start_time,
				actual_date: '2024-03-20', // Different date
				actual_start_time: '14:00',
				is_cancelled: false,
				created_by_user_id: aliceUserId,
				last_updated_by_user_id: aliceUserId,
			})
			.select()
			.single();

		if (data) {
			testDeviationId = data.id;
		}
	});

	afterAll(async () => {
		if (testDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', testDeviationId);
		}
		await verifyState(initialState);
	});

	it('teacher can update deviation to cancelled', async () => {
		if (!testDeviationId) {
			throw new Error('Test deviation not created');
		}

		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-03-19'));

		// Cancel the lesson by setting is_cancelled=true and restoring original dates
		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.update({
				actual_date: originalDate,
				actual_start_time: agreementAlice.start_time,
				is_cancelled: true,
				last_updated_by_user_id: aliceUserId,
			})
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.is_cancelled).toBe(true);
	});

	it('teacher can restore a cancelled lesson by deleting the deviation', async () => {
		if (!testDeviationId) {
			throw new Error('Test deviation not created');
		}

		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		// Restore the lesson by deleting the deviation
		const { data, error } = await db
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', testDeviationId)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.id).toBe(testDeviationId);

		// Mark as deleted so afterAll doesn't try to delete again
		testDeviationId = null;
	});
});

describe('RLS: lesson_appointment_deviations is_cancelled - auto-delete trigger respects cancelled flag', () => {
	let initialState: DatabaseState;
	const { setupState, verifyState } = setupDatabaseStateVerification();
	let testDeviationId: string | null = null;

	beforeAll(async () => {
		initialState = await setupState();
	});

	afterAll(async () => {
		if (testDeviationId) {
			await dbNoRLS.from('lesson_appointment_deviations').delete().eq('id', testDeviationId);
		}
		await verifyState(initialState);
	});

	it('cancelled deviation is NOT auto-deleted even when actual matches original', async () => {
		// Create a cancelled deviation
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-03-26'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data: insertData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
				original_start_time: agreementAlice.start_time,
				actual_date: originalDate, // Same as original
				actual_start_time: agreementAlice.start_time, // Same as original
				is_cancelled: true, // Cancelled
				created_by_user_id: aliceUserId,
				last_updated_by_user_id: aliceUserId,
			})
			.select()
			.single();

		if (insertData) {
			testDeviationId = insertData.id;
		}

		// Verify the deviation was created and still exists
		const { data: verifyData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select()
			.eq('id', testDeviationId ?? '')
			.single();

		expect(verifyData).not.toBeNull();
		expect(verifyData?.is_cancelled).toBe(true);
	});

	it('non-cancelled deviation IS auto-deleted when updated to match original', async () => {
		// Create a regular deviation (not cancelled)
		const agreementAlice = fixtures.allLessonAgreements.find((a) => a.id === agreementStudent009TeacherAlice);
		if (!agreementAlice) {
			throw new Error('Agreement not found');
		}

		const originalDate = calculateOriginalDate(agreementAlice.day_of_week, new Date('2024-04-02'));
		const aliceUserId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

		const { data: insertData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.insert({
				lesson_agreement_id: agreementStudent009TeacherAlice,
				original_date: originalDate,
				original_start_time: agreementAlice.start_time,
				actual_date: '2024-04-03', // Different date
				actual_start_time: '14:00',
				is_cancelled: false,
				created_by_user_id: aliceUserId,
				last_updated_by_user_id: aliceUserId,
			})
			.select()
			.single();

		const tempDeviationId = insertData?.id;

		// Now update it to match original (should trigger auto-delete)
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		await db
			.from('lesson_appointment_deviations')
			.update({
				actual_date: originalDate,
				actual_start_time: agreementAlice.start_time,
				is_cancelled: false,
				last_updated_by_user_id: aliceUserId,
			})
			.eq('id', tempDeviationId ?? '');

		// Verify the deviation was auto-deleted
		const { data: verifyData } = await dbNoRLS
			.from('lesson_appointment_deviations')
			.select()
			.eq('id', tempDeviationId ?? '')
			.maybeSingle();

		expect(verifyData).toBeNull();
	});
});
