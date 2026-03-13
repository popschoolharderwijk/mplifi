import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { unwrap } from '../../utils';
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

/**
 * project_domains / project_labels / projects SELECT permissions:
 *
 * All authenticated users can view all records (public reference data).
 */

async function selectProjectDomains(user: TestUser) {
	const db = await createClientAs(user);
	const data = unwrap(await db.from('project_domains').select('*'));
	expect(data.length).toBe(fixtures.allProjectDomains.length);
	return data;
}

async function selectProjectLabels(user: TestUser) {
	const db = await createClientAs(user);
	const data = unwrap(await db.from('project_labels').select('*'));
	expect(data.length).toBe(fixtures.allProjectLabels.length);
	return data;
}

async function selectProjects(user: TestUser) {
	const db = await createClientAs(user);
	const data = unwrap(await db.from('projects').select('*'));
	expect(data.length).toBe(fixtures.allProjects.length);
	return data;
}

describe('RLS: project_domains SELECT', () => {
	it('site_admin sees all domains', async () => {
		await selectProjectDomains(TestUsers.SITE_ADMIN);
	});

	it('admin sees all domains', async () => {
		await selectProjectDomains(TestUsers.ADMIN_ONE);
	});

	it('staff sees all domains', async () => {
		await selectProjectDomains(TestUsers.STAFF_ONE);
	});

	it('teacher sees all domains', async () => {
		await selectProjectDomains(TestUsers.TEACHER_ALICE);
	});

	it('student sees all domains', async () => {
		await selectProjectDomains(TestUsers.STUDENT_001);
	});

	it('user without role sees all domains', async () => {
		await selectProjectDomains(TestUsers.USER_001);
	});
});

describe('RLS: project_labels SELECT', () => {
	it('site_admin sees all labels', async () => {
		await selectProjectLabels(TestUsers.SITE_ADMIN);
	});

	it('admin sees all labels', async () => {
		await selectProjectLabels(TestUsers.ADMIN_ONE);
	});

	it('staff sees all labels', async () => {
		await selectProjectLabels(TestUsers.STAFF_ONE);
	});

	it('teacher sees all labels', async () => {
		await selectProjectLabels(TestUsers.TEACHER_ALICE);
	});

	it('student sees all labels', async () => {
		await selectProjectLabels(TestUsers.STUDENT_001);
	});

	it('user without role sees all labels', async () => {
		await selectProjectLabels(TestUsers.USER_001);
	});
});

describe('RLS: projects SELECT', () => {
	it('site_admin sees all projects', async () => {
		await selectProjects(TestUsers.SITE_ADMIN);
	});

	it('admin sees all projects', async () => {
		await selectProjects(TestUsers.ADMIN_ONE);
	});

	it('staff sees all projects', async () => {
		await selectProjects(TestUsers.STAFF_ONE);
	});

	it('teacher sees all projects', async () => {
		await selectProjects(TestUsers.TEACHER_ALICE);
	});

	it('student sees all projects', async () => {
		await selectProjects(TestUsers.STUDENT_001);
	});

	it('user without role sees all projects', async () => {
		await selectProjects(TestUsers.USER_001);
	});
});
