import { afterAll, beforeAll, describe, it } from 'bun:test';
import { createClientAnon } from '../../db';
import { unwrapError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

/**
 * Security helper and introspection functions are not granted to anon.
 * Table-specific anon tests live in each domain folder (profiles, user-roles, lesson-types, projects).
 */
describe('RLS: anonymous user – security functions', () => {
	it('anon cannot call role helper functions', async () => {
		const db = createClientAnon();
		unwrapError(
			await db.rpc('is_site_admin', {
				_user_id: '10000000-0001-0000-0000-000000000000',
			}),
		);
	});

	it('anon cannot call introspection functions', async () => {
		const db = createClientAnon();
		unwrapError(
			await db.rpc('check_rls_enabled', {
				p_table_name: 'profiles',
			}),
		);
	});
});
