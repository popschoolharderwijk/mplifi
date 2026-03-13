import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientAnon } from '../../db';
import type { ProfileInsert } from '../../types';
import { unwrap, unwrapError } from '../../utils';
import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';
import { TestUsers } from '../test-users';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

/**
 * RLS policies for profiles are for 'authenticated' only.
 * Anonymous users have no access.
 */
describe('RLS: anonymous user – profiles', () => {
	it('anon cannot read profiles', async () => {
		const db = createClientAnon();
		const data = unwrap(await db.from('profiles').select('*'));
		expect(data).toHaveLength(0);
	});

	it('anon cannot insert profiles', async () => {
		const db = createClientAnon();
		const newProfile: ProfileInsert = {
			user_id: '00000000-0000-0000-0000-999999999999',
			email: 'anon@test.nl',
		};
		unwrapError(await db.from('profiles').insert(newProfile).select());
	});

	it('anon cannot update profiles', async () => {
		const db = createClientAnon();
		const data = unwrap(
			await db
				.from('profiles')
				.update({ first_name: 'Hacked', last_name: null })
				.eq('email', TestUsers.STUDENT_001)
				.select(),
		);
		expect(data).toHaveLength(0);
	});

	it('anon cannot delete profiles', async () => {
		const db = createClientAnon();
		const data = unwrap(await db.from('profiles').delete().eq('email', TestUsers.STUDENT_001).select());
		expect(data).toHaveLength(0);
	});
});
