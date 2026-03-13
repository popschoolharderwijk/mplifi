import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { PostgresErrorCodes } from '../../../src/integrations/supabase/errorcodes';
import { createClientAs } from '../../db';
import { unwrap, unwrapError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { TEST_PROJECT_OWNER_ADMIN_ID, TestProjectDomains, TestProjectLabels, TestProjects } from '../test-projects';
import { type TestUser, TestUsers } from '../test-users';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

// ============================================================================
// project_domains INSERT/UPDATE/DELETE
// ============================================================================

const TEST_DOMAIN_ID = TestProjectDomains.MUSIC;

async function expectDomainInsertBlocked(user: TestUser) {
	const db = await createClientAs(user);
	const error = unwrapError(await db.from('project_domains').insert({ name: 'Test Domain' }).select());
	expect(error.code).toBe(PostgresErrorCodes.INSUFFICIENT_PRIVILEGE);
}

async function expectDomainUpdateBlocked(user: TestUser) {
	const db = await createClientAs(user);
	const data = unwrap(
		await db.from('project_domains').update({ name: 'Hacked Domain' }).eq('id', TEST_DOMAIN_ID).select(),
	);
	expect(data).toHaveLength(0);
}

async function expectDomainDeleteBlocked(user: TestUser) {
	const db = await createClientAs(user);
	const data = unwrap(await db.from('project_domains').delete().eq('id', TEST_DOMAIN_ID).select());
	expect(data).toHaveLength(0);
}

async function insertDomain(user: TestUser, name: string) {
	const db = await createClientAs(user);
	const [data] = unwrap(await db.from('project_domains').insert({ name }).select());
	expect(data.name).toBe(name);
	return {
		data,
		cleanup: async () => {
			unwrap(await db.from('project_domains').delete().eq('id', data.id));
		},
	};
}

describe('RLS WITH CHECK: project_domains INSERT/UPDATE rejected for non-admin', () => {
	it('INSERT rejected by WITH CHECK for staff (policy requires admin/site_admin)', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);
		const { error } = await db.from('project_domains').insert({ name: 'Staff Domain' }).select();
		expect(error?.code).toBe(PostgresErrorCodes.INSUFFICIENT_PRIVILEGE);
	});
	it('UPDATE rejected by WITH CHECK for staff (policy requires admin/site_admin)', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);
		const { data } = await db.from('project_domains').update({ name: 'Hacked' }).eq('id', TEST_DOMAIN_ID).select();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: project_domains INSERT - blocked for non-admin', () => {
	it('staff cannot insert domain', async () => {
		await expectDomainInsertBlocked(TestUsers.STAFF_ONE);
	});
	it('teacher cannot insert domain', async () => {
		await expectDomainInsertBlocked(TestUsers.TEACHER_ALICE);
	});
	it('user without role cannot insert domain', async () => {
		await expectDomainInsertBlocked(TestUsers.USER_001);
	});
});

describe('RLS: project_domains INSERT - admin permissions', () => {
	it('admin can insert domain', async () => {
		const { cleanup } = await insertDomain(TestUsers.ADMIN_ONE, 'Admin Test Domain');
		await cleanup();
	});
	it('site_admin can insert domain', async () => {
		const { cleanup } = await insertDomain(TestUsers.SITE_ADMIN, 'Site Admin Test Domain');
		await cleanup();
	});
});

describe('RLS: project_domains UPDATE - blocked for non-admin', () => {
	it('staff cannot update domain', async () => {
		await expectDomainUpdateBlocked(TestUsers.STAFF_ONE);
	});
	it('teacher cannot update domain', async () => {
		await expectDomainUpdateBlocked(TestUsers.TEACHER_ALICE);
	});
	it('user without role cannot update domain', async () => {
		await expectDomainUpdateBlocked(TestUsers.USER_001);
	});
});

describe('RLS: project_domains UPDATE - admin permissions', () => {
	it('admin can update domain', async () => {
		const { data: temp, cleanup } = await insertDomain(TestUsers.ADMIN_ONE, 'Temp Update Domain');
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const updated = unwrap(
			await db.from('project_domains').update({ name: 'Updated Domain' }).eq('id', temp.id).select(),
		);
		expect(updated).toHaveLength(1);
		await cleanup();
	});
});

describe('RLS: project_domains DELETE - blocked for non-admin', () => {
	it('staff cannot delete domain', async () => {
		await expectDomainDeleteBlocked(TestUsers.STAFF_ONE);
	});
	it('teacher cannot delete domain', async () => {
		await expectDomainDeleteBlocked(TestUsers.TEACHER_ALICE);
	});
	it('user without role cannot delete domain', async () => {
		await expectDomainDeleteBlocked(TestUsers.USER_001);
	});
});

describe('RLS: project_domains DELETE - admin permissions', () => {
	it('admin can delete domain', async () => {
		const { data: temp } = await insertDomain(TestUsers.ADMIN_ONE, 'Delete Test Domain');
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const deleted = unwrap(await db.from('project_domains').delete().eq('id', temp.id).select());
		expect(deleted).toHaveLength(1);
	});
});

// ============================================================================
// project_labels INSERT/UPDATE/DELETE
// ============================================================================

const TEST_LABEL_ID = TestProjectLabels.GUITAR_LESSONS;

async function expectLabelInsertBlocked(user: TestUser) {
	const db = await createClientAs(user);
	const error = unwrapError(
		await db.from('project_labels').insert({ name: 'Test Label', domain_id: TEST_DOMAIN_ID }).select(),
	);
	expect(error.code).toBe(PostgresErrorCodes.INSUFFICIENT_PRIVILEGE);
}

async function expectLabelUpdateBlocked(user: TestUser) {
	const db = await createClientAs(user);
	const data = unwrap(
		await db.from('project_labels').update({ name: 'Hacked Label' }).eq('id', TEST_LABEL_ID).select(),
	);
	expect(data).toHaveLength(0);
}

async function expectLabelDeleteBlocked(user: TestUser) {
	const db = await createClientAs(user);
	const data = unwrap(await db.from('project_labels').delete().eq('id', TEST_LABEL_ID).select());
	expect(data).toHaveLength(0);
}

describe('RLS WITH CHECK: project_labels INSERT/UPDATE rejected for non-admin', () => {
	it('INSERT rejected by WITH CHECK for staff (policy requires admin/site_admin)', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);
		const { error } = await db
			.from('project_labels')
			.insert({ name: 'Staff Label', domain_id: TEST_DOMAIN_ID })
			.select();
		expect(error?.code).toBe(PostgresErrorCodes.INSUFFICIENT_PRIVILEGE);
	});
	it('UPDATE rejected by WITH CHECK for staff (policy requires admin/site_admin)', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);
		const { data } = await db.from('project_labels').update({ name: 'Hacked' }).eq('id', TEST_LABEL_ID).select();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: project_labels INSERT - blocked for non-admin', () => {
	it('staff cannot insert label', async () => {
		await expectLabelInsertBlocked(TestUsers.STAFF_ONE);
	});
	it('teacher cannot insert label', async () => {
		await expectLabelInsertBlocked(TestUsers.TEACHER_ALICE);
	});
	it('user without role cannot insert label', async () => {
		await expectLabelInsertBlocked(TestUsers.USER_001);
	});
});

describe('RLS: project_labels INSERT - admin permissions', () => {
	it('admin can insert label', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const [label] = unwrap(
			await db.from('project_labels').insert({ name: 'Admin Test Label', domain_id: TEST_DOMAIN_ID }).select(),
		);
		unwrap(await db.from('project_labels').delete().eq('id', label.id));
	});
	it('site_admin can insert label', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const [label] = unwrap(
			await db
				.from('project_labels')
				.insert({ name: 'SiteAdmin Test Label', domain_id: TEST_DOMAIN_ID })
				.select(),
		);
		unwrap(await db.from('project_labels').delete().eq('id', label.id));
	});
});

describe('RLS: project_labels UPDATE - blocked for non-admin', () => {
	it('staff cannot update label', async () => {
		await expectLabelUpdateBlocked(TestUsers.STAFF_ONE);
	});
	it('teacher cannot update label', async () => {
		await expectLabelUpdateBlocked(TestUsers.TEACHER_ALICE);
	});
	it('user without role cannot update label', async () => {
		await expectLabelUpdateBlocked(TestUsers.USER_001);
	});
});

describe('RLS: project_labels UPDATE - admin permissions', () => {
	it('admin can update label', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const [label] = unwrap(
			await db.from('project_labels').insert({ name: 'Temp Label Update', domain_id: TEST_DOMAIN_ID }).select(),
		);
		const updated = unwrap(
			await db.from('project_labels').update({ name: 'Updated Label' }).eq('id', label.id).select(),
		);
		expect(updated).toHaveLength(1);
		unwrap(await db.from('project_labels').delete().eq('id', label.id));
	});
});

describe('RLS: project_labels DELETE - blocked for non-admin', () => {
	it('staff cannot delete label', async () => {
		await expectLabelDeleteBlocked(TestUsers.STAFF_ONE);
	});
	it('teacher cannot delete label', async () => {
		await expectLabelDeleteBlocked(TestUsers.TEACHER_ALICE);
	});
	it('user without role cannot delete label', async () => {
		await expectLabelDeleteBlocked(TestUsers.USER_001);
	});
});

describe('RLS: project_labels DELETE - admin permissions', () => {
	it('admin can delete label', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const [label] = unwrap(
			await db.from('project_labels').insert({ name: 'Delete Test Label', domain_id: TEST_DOMAIN_ID }).select(),
		);
		const deleted = unwrap(await db.from('project_labels').delete().eq('id', label.id).select());
		expect(deleted).toHaveLength(1);
	});
});

// ============================================================================
// projects INSERT/UPDATE/DELETE
// ============================================================================

const TEST_PROJECT_ID = TestProjects.GUITAR_PROJECT_SPRING;
const OWNER_ADMIN_ID = TEST_PROJECT_OWNER_ADMIN_ID;

async function expectProjectInsertBlocked(user: TestUser) {
	const db = await createClientAs(user);
	const error = unwrapError(
		await db
			.from('projects')
			.insert({ name: 'Test Project', label_id: TEST_LABEL_ID, owner_user_id: OWNER_ADMIN_ID })
			.select(),
	);
	expect(error.code).toBe(PostgresErrorCodes.INSUFFICIENT_PRIVILEGE);
}

async function expectProjectUpdateBlocked(user: TestUser) {
	const db = await createClientAs(user);
	const data = unwrap(
		await db.from('projects').update({ name: 'Hacked Project' }).eq('id', TEST_PROJECT_ID).select(),
	);
	expect(data).toHaveLength(0);
}

async function expectProjectDeleteBlocked(user: TestUser) {
	const db = await createClientAs(user);
	const data = unwrap(await db.from('projects').delete().eq('id', TEST_PROJECT_ID).select());
	expect(data).toHaveLength(0);
}

describe('RLS WITH CHECK: projects INSERT/UPDATE rejected for non-admin', () => {
	it('INSERT rejected by WITH CHECK for staff (policy requires admin/site_admin)', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);
		const { error } = await db
			.from('projects')
			.insert({
				name: 'Staff Project',
				label_id: TEST_LABEL_ID,
				owner_user_id: OWNER_ADMIN_ID,
			})
			.select();
		expect(error?.code).toBe(PostgresErrorCodes.INSUFFICIENT_PRIVILEGE);
	});
	it('INSERT rejected by WITH CHECK for teacher (policy requires admin/site_admin)', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { error } = await db
			.from('projects')
			.insert({
				name: 'Teacher Project',
				label_id: TEST_LABEL_ID,
				owner_user_id: OWNER_ADMIN_ID,
			})
			.select();
		expect(error?.code).toBe(PostgresErrorCodes.INSUFFICIENT_PRIVILEGE);
	});
	it('UPDATE rejected by WITH CHECK for staff (policy requires admin/site_admin)', async () => {
		const db = await createClientAs(TestUsers.STAFF_ONE);
		const { data } = await db.from('projects').update({ name: 'Hacked' }).eq('id', TEST_PROJECT_ID).select();
		expect(data).toHaveLength(0);
	});
	it('UPDATE rejected by WITH CHECK for teacher (policy requires admin/site_admin)', async () => {
		const db = await createClientAs(TestUsers.TEACHER_ALICE);
		const { data } = await db.from('projects').update({ name: 'Hacked' }).eq('id', TEST_PROJECT_ID).select();
		expect(data).toHaveLength(0);
	});
});

describe('RLS: projects INSERT - blocked for non-admin', () => {
	it('staff cannot insert project', async () => {
		await expectProjectInsertBlocked(TestUsers.STAFF_ONE);
	});
	it('teacher cannot insert project', async () => {
		await expectProjectInsertBlocked(TestUsers.TEACHER_ALICE);
	});
	it('student cannot insert project', async () => {
		await expectProjectInsertBlocked(TestUsers.STUDENT_001);
	});
	it('user without role cannot insert project', async () => {
		await expectProjectInsertBlocked(TestUsers.USER_001);
	});
});

describe('RLS: projects INSERT - admin permissions', () => {
	it('admin can insert project', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const [project] = unwrap(
			await db
				.from('projects')
				.insert({ name: 'Admin Test Project', label_id: TEST_LABEL_ID, owner_user_id: OWNER_ADMIN_ID })
				.select(),
		);
		unwrap(await db.from('projects').delete().eq('id', project.id));
	});

	it('site_admin can insert project', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const [project] = unwrap(
			await db
				.from('projects')
				.insert({ name: 'SiteAdmin Test Project', label_id: TEST_LABEL_ID, owner_user_id: OWNER_ADMIN_ID })
				.select(),
		);
		unwrap(await db.from('projects').delete().eq('id', project.id));
	});
});

describe('RLS: projects UPDATE - blocked for non-admin', () => {
	it('staff cannot update project', async () => {
		await expectProjectUpdateBlocked(TestUsers.STAFF_ONE);
	});
	it('teacher cannot update project', async () => {
		await expectProjectUpdateBlocked(TestUsers.TEACHER_ALICE);
	});
	it('student cannot update project', async () => {
		await expectProjectUpdateBlocked(TestUsers.STUDENT_001);
	});
	it('user without role cannot update project', async () => {
		await expectProjectUpdateBlocked(TestUsers.USER_001);
	});
});

describe('RLS: projects UPDATE - admin permissions', () => {
	it('admin can update project', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const [project] = unwrap(
			await db
				.from('projects')
				.insert({ name: 'Admin Update Test', label_id: TEST_LABEL_ID, owner_user_id: OWNER_ADMIN_ID })
				.select(),
		);
		const updated = unwrap(
			await db.from('projects').update({ name: 'Updated by Admin' }).eq('id', project.id).select(),
		);
		expect(updated).toHaveLength(1);
		unwrap(await db.from('projects').delete().eq('id', project.id));
	});

	it('site_admin can update project', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const [project] = unwrap(
			await db
				.from('projects')
				.insert({ name: 'SiteAdmin Update Test', label_id: TEST_LABEL_ID, owner_user_id: OWNER_ADMIN_ID })
				.select(),
		);
		const updated = unwrap(
			await db.from('projects').update({ name: 'Updated by SiteAdmin' }).eq('id', project.id).select(),
		);
		expect(updated).toHaveLength(1);
		unwrap(await db.from('projects').delete().eq('id', project.id));
	});
});

describe('RLS: projects DELETE - blocked for non-admin', () => {
	it('staff cannot delete project', async () => {
		await expectProjectDeleteBlocked(TestUsers.STAFF_ONE);
	});
	it('teacher cannot delete project', async () => {
		await expectProjectDeleteBlocked(TestUsers.TEACHER_ALICE);
	});
	it('user without role cannot delete project', async () => {
		await expectProjectDeleteBlocked(TestUsers.USER_001);
	});
});

describe('RLS: projects DELETE - admin permissions', () => {
	it('admin can delete project', async () => {
		const db = await createClientAs(TestUsers.ADMIN_ONE);
		const [project] = unwrap(
			await db
				.from('projects')
				.insert({ name: 'Delete Test', label_id: TEST_LABEL_ID, owner_user_id: OWNER_ADMIN_ID })
				.select(),
		);
		const deleted = unwrap(await db.from('projects').delete().eq('id', project.id).select());
		expect(deleted).toHaveLength(1);
	});

	it('site_admin can delete project', async () => {
		const db = await createClientAs(TestUsers.SITE_ADMIN);
		const [project] = unwrap(
			await db
				.from('projects')
				.insert({ name: 'SiteAdmin Delete Test', label_id: TEST_LABEL_ID, owner_user_id: OWNER_ADMIN_ID })
				.select(),
		);
		const deleted = unwrap(await db.from('projects').delete().eq('id', project.id).select());
		expect(deleted).toHaveLength(1);
	});
});
