import { describe, expect, it } from 'bun:test';
import { createClientAs } from '../../db';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';

const { requireProfile } = fixtures;

describe('Constraints: phone_number validation', () => {
	it('allows valid 10-digit phone number', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const profile = requireProfile(TestUsers.STUDENT_001);
		const originalPhoneNumber = profile.phone_number;

		const { data, error } = await db
			.from('profiles')
			.update({ phone_number: '0612345678' })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.phone_number).toBe('0612345678');

		// Restore original
		await db.from('profiles').update({ phone_number: originalPhoneNumber }).eq('user_id', profile.user_id);
	});

	it('allows NULL phone number', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const profile = requireProfile(TestUsers.STUDENT_001);
		const originalPhoneNumber = profile.phone_number;

		const { data, error } = await db
			.from('profiles')
			.update({ phone_number: null })
			.eq('user_id', profile.user_id)
			.select();

		expect(error).toBeNull();
		expect(data).toHaveLength(1);
		expect(data?.[0]?.phone_number).toBeNull();

		// Restore original
		await db.from('profiles').update({ phone_number: originalPhoneNumber }).eq('user_id', profile.user_id);
	});

	it('rejects phone number with less than 10 digits', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const profile = requireProfile(TestUsers.STUDENT_001);

		const { data, error } = await db
			.from('profiles')
			.update({ phone_number: '061234567' })
			.eq('user_id', profile.user_id)
			.select();

		// CHECK constraint should reject: must be exactly 10 digits
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('rejects phone number with more than 10 digits', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const profile = requireProfile(TestUsers.STUDENT_001);

		const { data, error } = await db
			.from('profiles')
			.update({ phone_number: '06123456789' })
			.eq('user_id', profile.user_id)
			.select();

		// CHECK constraint should reject: must be exactly 10 digits
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('rejects phone number with non-numeric characters', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const profile = requireProfile(TestUsers.STUDENT_001);

		const { data, error } = await db
			.from('profiles')
			.update({ phone_number: '06-12345678' })
			.eq('user_id', profile.user_id)
			.select();

		// CHECK constraint should reject: must contain only digits
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('rejects phone number with spaces', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const profile = requireProfile(TestUsers.STUDENT_001);

		const { data, error } = await db
			.from('profiles')
			.update({ phone_number: '06 12 34 56 78' })
			.eq('user_id', profile.user_id)
			.select();

		// CHECK constraint should reject: must contain only digits
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});

	it('rejects empty string phone number', async () => {
		const db = await createClientAs(TestUsers.STUDENT_001);
		const profile = requireProfile(TestUsers.STUDENT_001);

		const { data, error } = await db
			.from('profiles')
			.update({ phone_number: '' })
			.eq('user_id', profile.user_id)
			.select();

		// CHECK constraint should reject: empty string is not NULL and doesn't match pattern
		expect(error).not.toBeNull();
		expect(data).toBeNull();
	});
});
