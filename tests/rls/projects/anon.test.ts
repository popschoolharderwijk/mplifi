import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAnon } from '../../db';
import { unwrap, unwrapError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { TEST_PROJECT_OWNER_ADMIN_ID, TestProjectDomains, TestProjectLabels } from '../test-projects';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

/**
 * RLS policies for project_domains, project_labels and projects are for 'authenticated' only.
 * Anonymous users have no access.
 */
describe('RLS: anonymous user – project_domains', () => {
	it('anon cannot read project_domains', async () => {
		const db = createClientAnon();
		const data = unwrap(await db.from('project_domains').select('*'));
		expect(data).toHaveLength(0);
	});

	it('anon cannot insert project_domains', async () => {
		const db = createClientAnon();
		unwrapError(await db.from('project_domains').insert({ name: 'Anon Domain' }).select());
	});

	it('anon cannot update project_domains', async () => {
		const db = createClientAnon();
		const data = unwrap(
			await db
				.from('project_domains')
				.update({ name: 'Hacked' })
				.neq('id', '00000000-0000-0000-0000-000000000000')
				.select(),
		);
		expect(data).toHaveLength(0);
	});

	it('anon cannot delete project_domains', async () => {
		const db = createClientAnon();
		const data = unwrap(
			await db.from('project_domains').delete().neq('id', '00000000-0000-0000-0000-000000000000').select(),
		);
		expect(data).toHaveLength(0);
	});
});

describe('RLS: anonymous user – project_labels', () => {
	it('anon cannot read project_labels', async () => {
		const db = createClientAnon();
		const data = unwrap(await db.from('project_labels').select('*'));
		expect(data).toHaveLength(0);
	});

	it('anon cannot insert project_labels', async () => {
		const db = createClientAnon();
		unwrapError(
			await db
				.from('project_labels')
				.insert({ name: 'Anon Label', domain_id: TestProjectDomains.MUSIC })
				.select(),
		);
	});

	it('anon cannot update project_labels', async () => {
		const db = createClientAnon();
		const data = unwrap(
			await db
				.from('project_labels')
				.update({ name: 'Hacked' })
				.neq('id', '00000000-0000-0000-0000-000000000000')
				.select(),
		);
		expect(data).toHaveLength(0);
	});

	it('anon cannot delete project_labels', async () => {
		const db = createClientAnon();
		const data = unwrap(
			await db.from('project_labels').delete().neq('id', '00000000-0000-0000-0000-000000000000').select(),
		);
		expect(data).toHaveLength(0);
	});
});

describe('RLS: anonymous user – projects', () => {
	it('anon cannot read projects', async () => {
		const db = createClientAnon();
		const data = unwrap(await db.from('projects').select('*'));
		expect(data).toHaveLength(0);
	});

	it('anon cannot insert projects', async () => {
		const db = createClientAnon();
		unwrapError(
			await db
				.from('projects')
				.insert({
					name: 'Anon Project',
					label_id: TestProjectLabels.GUITAR_LESSONS,
					owner_user_id: TEST_PROJECT_OWNER_ADMIN_ID,
				})
				.select(),
		);
	});

	it('anon cannot update projects', async () => {
		const db = createClientAnon();
		const data = unwrap(
			await db
				.from('projects')
				.update({ name: 'Hacked' })
				.neq('id', '00000000-0000-0000-0000-000000000000')
				.select(),
		);
		expect(data).toHaveLength(0);
	});

	it('anon cannot delete projects', async () => {
		const db = createClientAnon();
		const data = unwrap(
			await db.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000').select(),
		);
		expect(data).toHaveLength(0);
	});
});
