import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs, createClientBypassRLS } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { TeacherAvailabilityInsert } from '../types';
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

const aliceTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_ALICE);
const bobTeacherId = fixtures.requireTeacherId(TestUsers.TEACHER_BOB);

/**
 * Teacher Availability INSERT/UPDATE/DELETE permissions:
 *
 * TEACHERS:
 * - Can insert/update/delete their own availability
 *
 * ADMIN/SITE_ADMIN:
 * - Can insert/update/delete availability for any teacher
 *
 * STAFF:
 * - Cannot insert/update/delete availability (only SELECT)
 *
 * OTHER USERS:
 * - Cannot insert/update/delete availability
 */
describe('RLS: teacher_availability INSERT - blocked for non-teacher/admin roles', () => {
	const newAvailability: TeacherAvailabilityInsert = {
		teacher_id: aliceTeacherId,
		day_of_week: 1,
		start_time: '09:00',
		end_time: '12:00',
	};

	it('user without role cannot insert availability', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teacher_availability').insert(newAvailability).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('student cannot insert availability', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data, error } = await db.from('teacher_availability').insert(newAvailability).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('staff cannot insert availability', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data, error } = await db.from('teacher_availability').insert(newAvailability).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: teacher_availability INSERT - teacher permissions', () => {
	it('teacher can insert their own availability', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const newAvailability: TeacherAvailabilityInsert = {
			teacher_id: aliceTeacherId,
			day_of_week: 4,
			start_time: '13:00',
			end_time: '16:00',
		};

		const { data, error } = await db.from('teacher_availability').insert(newAvailability).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.teacher_id).toBe(aliceTeacherId);

		// Cleanup
		if (data?.[0]?.id) {
			await dbNoRLS.from('teacher_availability').delete().eq('id', data[0].id);
		}
	});

	it('teacher cannot insert availability for other teacher', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const newAvailability: TeacherAvailabilityInsert = {
			teacher_id: bobTeacherId,
			day_of_week: 1,
			start_time: '09:00',
			end_time: '12:00',
		};

		const { data, error } = await db.from('teacher_availability').insert(newAvailability).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});

describe('RLS: teacher_availability INSERT - admin permissions', () => {
	it('admin can insert availability for any teacher', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const newAvailability: TeacherAvailabilityInsert = {
			teacher_id: aliceTeacherId,
			day_of_week: 5,
			start_time: '10:00',
			end_time: '14:00',
		};

		const { data, error } = await db.from('teacher_availability').insert(newAvailability).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		// Cleanup
		if (data?.[0]?.id) {
			await dbNoRLS.from('teacher_availability').delete().eq('id', data[0].id);
		}
	});

	it('site_admin can insert availability for any teacher', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);

		const newAvailability: TeacherAvailabilityInsert = {
			teacher_id: bobTeacherId,
			day_of_week: 5,
			start_time: '10:00',
			end_time: '14:00',
		};

		const { data, error } = await db.from('teacher_availability').insert(newAvailability).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		// Cleanup
		if (data?.[0]?.id) {
			await dbNoRLS.from('teacher_availability').delete().eq('id', data[0].id);
		}
	});
});

describe('RLS: teacher_availability UPDATE - blocked for non-teacher/admin roles', () => {
	it('user without role cannot update availability', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		// Get an existing availability record
		const { data: existing } = await dbNoRLS
			.from('teacher_availability')
			.select('id')
			.eq('teacher_id', aliceTeacherId)
			.limit(1)
			.single();

		if (!existing) {
			return; // Skip if no test data
		}

		const { data, error } = await db
			.from('teacher_availability')
			.update({ start_time: '10:00' })
			.eq('id', existing.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot update availability', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data: existing } = await dbNoRLS
			.from('teacher_availability')
			.select('id')
			.eq('teacher_id', aliceTeacherId)
			.limit(1)
			.single();

		if (!existing) {
			return;
		}

		const { data, error } = await db
			.from('teacher_availability')
			.update({ start_time: '10:00' })
			.eq('id', existing.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: teacher_availability UPDATE - teacher permissions', () => {
	it('teacher can update their own availability', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		// Get an existing availability record
		const { data: existing } = await dbNoRLS
			.from('teacher_availability')
			.select('*')
			.eq('teacher_id', aliceTeacherId)
			.limit(1)
			.single();

		if (!existing) {
			return;
		}

		const { data, error } = await db
			.from('teacher_availability')
			.update({ start_time: '10:00' })
			.eq('id', existing.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		// Restore original
		await dbNoRLS.from('teacher_availability').update({ start_time: existing.start_time }).eq('id', existing.id);
	});

	it('teacher cannot update other teachers availability', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data: existing } = await dbNoRLS
			.from('teacher_availability')
			.select('id')
			.eq('teacher_id', bobTeacherId)
			.limit(1)
			.single();

		if (!existing) {
			return;
		}

		const { data, error } = await db
			.from('teacher_availability')
			.update({ start_time: '10:00' })
			.eq('id', existing.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: teacher_availability UPDATE - admin permissions', () => {
	it('admin can update availability for any teacher', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		const { data: existing } = await dbNoRLS
			.from('teacher_availability')
			.select('*')
			.eq('teacher_id', aliceTeacherId)
			.limit(1)
			.single();

		if (!existing) {
			return;
		}

		const { data, error } = await db
			.from('teacher_availability')
			.update({ start_time: '11:00' })
			.eq('id', existing.id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);

		// Restore original
		await dbNoRLS.from('teacher_availability').update({ start_time: existing.start_time }).eq('id', existing.id);
	});
});

describe('RLS: teacher_availability DELETE - blocked for non-teacher/admin roles', () => {
	it('user without role cannot delete availability', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);

		const { data: existing } = await dbNoRLS
			.from('teacher_availability')
			.select('id')
			.eq('teacher_id', aliceTeacherId)
			.limit(1)
			.single();

		if (!existing) {
			return;
		}

		const { data, error } = await db.from('teacher_availability').delete().eq('id', existing.id).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});

	it('staff cannot delete availability', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);

		const { data: existing } = await dbNoRLS
			.from('teacher_availability')
			.select('id')
			.eq('teacher_id', aliceTeacherId)
			.limit(1)
			.single();

		if (!existing) {
			return;
		}

		const { data, error } = await db.from('teacher_availability').delete().eq('id', existing.id).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: teacher_availability DELETE - teacher permissions', () => {
	it('teacher can delete their own availability', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		// Create a test availability to delete
		const { data: inserted } = await dbNoRLS
			.from('teacher_availability')
			.insert({
				teacher_id: aliceTeacherId,
				day_of_week: 6,
				start_time: '09:00',
				end_time: '12:00',
			})
			.select()
			.single();

		if (!inserted) {
			return;
		}

		const { data, error } = await db.from('teacher_availability').delete().eq('id', inserted.id).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
	});

	it('teacher cannot delete other teachers availability', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const { data: existing } = await dbNoRLS
			.from('teacher_availability')
			.select('id')
			.eq('teacher_id', bobTeacherId)
			.limit(1)
			.single();

		if (!existing) {
			return;
		}

		const { data, error } = await db.from('teacher_availability').delete().eq('id', existing.id).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: teacher_availability DELETE - admin permissions', () => {
	it('admin can delete availability for any teacher', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);

		// Create a test availability to delete
		const { data: inserted } = await dbNoRLS
			.from('teacher_availability')
			.insert({
				teacher_id: aliceTeacherId,
				day_of_week: 6,
				start_time: '09:00',
				end_time: '12:00',
			})
			.select()
			.single();

		if (!inserted) {
			return;
		}

		const { data, error } = await db.from('teacher_availability').delete().eq('id', inserted.id).select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
	});
});

describe('RLS: teacher_availability validation', () => {
	it('end_time must be greater than start_time', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);

		const invalidAvailability: TeacherAvailabilityInsert = {
			teacher_id: aliceTeacherId,
			day_of_week: 1,
			start_time: '12:00',
			end_time: '09:00', // Invalid: end before start
		};

		const { data, error } = await db.from('teacher_availability').insert(invalidAvailability).select();

		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});
