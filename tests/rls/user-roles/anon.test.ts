import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAnon } from '../../db';
import type { UserRoleInsert } from '../../types';
import { unwrap, unwrapError } from '../../utils';
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
 * RLS policies for user_roles are for 'authenticated' only.
 * Anonymous users have no access.
 */
describe('RLS: anonymous user – user_roles', () => {
	it('anon cannot read user_roles', async () => {
		const db = createClientAnon();
		const data = unwrap(await db.from('user_roles').select('*'));
		expect(data).toHaveLength(0);
	});

	it('anon cannot insert user_roles', async () => {
		const db = createClientAnon();
		const newUserRole: UserRoleInsert = {
			user_id: '00000000-0000-0000-0000-999999999999',
			role: 'site_admin',
		};
		unwrapError(await db.from('user_roles').insert(newUserRole).select());
	});

	it('anon cannot update user_roles', async () => {
		const db = createClientAnon();
		const data = unwrap(
			await db.from('user_roles').update({ role: 'site_admin' }).neq('role', 'site_admin').select(),
		);
		expect(data).toHaveLength(0);
	});

	it('anon cannot delete user_roles', async () => {
		const db = createClientAnon();
		const data = unwrap(await db.from('user_roles').delete().eq('role', 'staff').select());
		expect(data).toHaveLength(0);
	});
});
