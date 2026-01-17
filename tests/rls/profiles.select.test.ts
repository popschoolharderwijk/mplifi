import { describe, expect, it } from 'bun:test';
import { queryAs } from './impersonation';

describe('RLS: profiles SELECT', () => {
	it('student sees only own profile', async () => {
		// Query profiles table as student_a - RLS should filter to only their row
		const { data, error } = await queryAs(
			'student_a',
			'SELECT * FROM profiles',
		);

		console.log(data, error);

		expect(error).toBeNull();
		expect(data?.length).toBe(1);
	});
});
