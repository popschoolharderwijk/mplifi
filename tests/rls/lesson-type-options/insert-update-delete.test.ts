import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { PostgresErrorCodes } from '../../../src/integrations/supabase/errorcodes';
import { createClientAs, createClientBypassRLS } from '../../db';
import type { LessonTypeOptionInsert } from '../../types';
import { unwrap, unwrapError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { fixtures } from '../fixtures';
import type { TestUser } from '../test-users';
import { TestUsers } from '../test-users';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

const dbNoRLS = createClientBypassRLS();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

/**
 * lesson_type_options RLS (SECTION 3B):
 *
 * SELECT: all authenticated can read.
 * INSERT / UPDATE / DELETE: only admin and site_admin.
 */

const lessonTypeId = fixtures.requireLessonTypeId('Gitaarles');

async function getOneOptionId(): Promise<string> {
	const { data } = await dbNoRLS
		.from('lesson_type_options')
		.select('id')
		.eq('lesson_type_id', lessonTypeId)
		.limit(1)
		.single();
	if (!data?.id) throw new Error('No lesson_type_option found for Gitaar');
	return data.id;
}

async function expectInsertBlocked(user: TestUser, payload: LessonTypeOptionInsert) {
	const db = await createClientAs(user);
	const error = unwrapError(await db.from('lesson_type_options').insert(payload).select());
	expect(error.code).toBe(PostgresErrorCodes.INSUFFICIENT_PRIVILEGE);
}

async function expectUpdateBlocked(user: TestUser, optionId: string) {
	const db = await createClientAs(user);
	const data = unwrap(
		await db.from('lesson_type_options').update({ duration_minutes: 99 }).eq('id', optionId).select(),
	);
	expect(data).toHaveLength(0);
}

async function expectDeleteBlocked(user: TestUser, optionId: string) {
	const db = await createClientAs(user);
	const data = unwrap(await db.from('lesson_type_options').delete().eq('id', optionId).select());
	expect(data).toHaveLength(0);
}

async function insertOption(user: TestUser, payload: LessonTypeOptionInsert) {
	const db = await createClientAs(user);
	const [row] = unwrap(await db.from('lesson_type_options').insert(payload).select());
	return {
		data: row,
		cleanup: async () => {
			unwrap(await db.from('lesson_type_options').delete().eq('id', row.id));
		},
	};
}

describe('RLS: lesson_type_options INSERT - blocked for non-admin roles', () => {
	const newOption: LessonTypeOptionInsert = {
		lesson_type_id: lessonTypeId,
		duration_minutes: 30,
		frequency: 'weekly',
		price_per_lesson: 25,
	};

	it('user without role cannot insert lesson_type_option', async () => {
		await expectInsertBlocked(TestUsers.STUDENT_001, newOption);
	});

	it('teacher cannot insert lesson_type_option', async () => {
		await expectInsertBlocked(TestUsers.TEACHER_ALICE, newOption);
	});

	it('staff cannot insert lesson_type_option', async () => {
		await expectInsertBlocked(TestUsers.STAFF_ONE, newOption);
	});
});

describe('RLS: lesson_type_options INSERT - admin permissions', () => {
	const newOption: LessonTypeOptionInsert = {
		lesson_type_id: lessonTypeId,
		duration_minutes: 45,
		frequency: 'biweekly',
		price_per_lesson: 30,
	};

	it('admin can insert lesson_type_option', async () => {
		const { cleanup } = await insertOption(TestUsers.ADMIN_ONE, newOption);
		await cleanup();
	});

	it('site_admin can insert lesson_type_option', async () => {
		const { cleanup } = await insertOption(TestUsers.SITE_ADMIN, newOption);
		await cleanup();
	});
});

describe('RLS: lesson_type_options UPDATE - blocked for non-admin roles', () => {
	it('user without role cannot update lesson_type_option', async () => {
		const optionId = await getOneOptionId();
		await expectUpdateBlocked(TestUsers.STUDENT_001, optionId);
	});

	it('teacher cannot update lesson_type_option', async () => {
		const optionId = await getOneOptionId();
		await expectUpdateBlocked(TestUsers.TEACHER_ALICE, optionId);
	});

	it('staff cannot update lesson_type_option', async () => {
		const optionId = await getOneOptionId();
		await expectUpdateBlocked(TestUsers.STAFF_ONE, optionId);
	});
});

describe('RLS: lesson_type_options UPDATE - admin permissions', () => {
	it('admin can update lesson_type_option', async () => {
		const { cleanup, data } = await insertOption(TestUsers.ADMIN_ONE, {
			lesson_type_id: lessonTypeId,
			duration_minutes: 30,
			frequency: 'weekly',
			price_per_lesson: 20,
		});
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const updated = unwrap(
			await db.from('lesson_type_options').update({ duration_minutes: 60 }).eq('id', data.id).select(),
		);
		expect(updated).toHaveLength(1);
		expect(updated[0].duration_minutes).toBe(60);
		await cleanup();
	});

	it('site_admin can update lesson_type_option', async () => {
		const { cleanup, data } = await insertOption(TestUsers.SITE_ADMIN, {
			lesson_type_id: lessonTypeId,
			duration_minutes: 30,
			frequency: 'monthly',
			price_per_lesson: 22,
		});
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const updated = unwrap(
			await db.from('lesson_type_options').update({ price_per_lesson: 28 }).eq('id', data.id).select(),
		);
		expect(updated).toHaveLength(1);
		expect(updated[0].price_per_lesson).toBe(28);
		await cleanup();
	});
});

describe('RLS: lesson_type_options DELETE - blocked for non-admin roles', () => {
	it('user without role cannot delete lesson_type_option', async () => {
		const optionId = await getOneOptionId();
		await expectDeleteBlocked(TestUsers.STUDENT_001, optionId);
	});

	it('teacher cannot delete lesson_type_option', async () => {
		const optionId = await getOneOptionId();
		await expectDeleteBlocked(TestUsers.TEACHER_ALICE, optionId);
	});

	it('staff cannot delete lesson_type_option', async () => {
		const optionId = await getOneOptionId();
		await expectDeleteBlocked(TestUsers.STAFF_ONE, optionId);
	});
});

describe('RLS: lesson_type_options DELETE - admin permissions', () => {
	it('admin can delete lesson_type_option', async () => {
		const { data } = await insertOption(TestUsers.ADMIN_ONE, {
			lesson_type_id: lessonTypeId,
			duration_minutes: 90,
			frequency: 'weekly',
			price_per_lesson: 35,
		});
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const deleted = unwrap(await db.from('lesson_type_options').delete().eq('id', data.id).select());
		expect(deleted).toHaveLength(1);
		expect(deleted[0].id).toBe(data.id);
	});

	it('site_admin can delete lesson_type_option', async () => {
		const { data } = await insertOption(TestUsers.SITE_ADMIN, {
			lesson_type_id: lessonTypeId,
			duration_minutes: 120,
			frequency: 'daily',
			price_per_lesson: 40,
		});
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const deleted = unwrap(await db.from('lesson_type_options').delete().eq('id', data.id).select());
		expect(deleted).toHaveLength(1);
		expect(deleted[0].id).toBe(data.id);
	});
});
