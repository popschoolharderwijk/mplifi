/**
 * Tests for OTP sign-in flow with shouldCreateUser: false.
 *
 * Verifies that:
 * 1. Unregistered users cannot trigger OTP emails via sign-in
 * 2. Registered users can successfully request OTP
 *
 * This prevents enumeration attacks and ensures sign-in/sign-up flows are separate.
 */

import { afterAll, describe, expect, it } from 'bun:test';
import { createClientAnon, createClientBypassRLS } from '../db';
import { generateTestEmail } from '../utils';

describe('OTP sign-in flow (shouldCreateUser: false)', () => {
	// Track user IDs created during tests for cleanup
	const createdUserIds: string[] = [];

	// Cleanup: delete any users created during tests
	afterAll(async () => {
		if (createdUserIds.length === 0) return;

		const adminClient = createClientBypassRLS();
		for (const userId of createdUserIds) {
			await adminClient.auth.admin.deleteUser(userId);
		}
	});

	it('should reject OTP request for unregistered email when shouldCreateUser is false', async () => {
		const supabase = createClientAnon();
		const unregisteredEmail = generateTestEmail('test-otp');

		const { error } = await supabase.auth.signInWithOtp({
			email: unregisteredEmail,
			options: {
				shouldCreateUser: false,
			},
		});

		expect(error).not.toBeNull();
		expect(error?.message).toBe('Signups not allowed for otp');
	});

	it('should accept OTP request for registered and confirmed user', async () => {
		const adminClient = createClientBypassRLS();
		const supabase = createClientAnon();
		const registeredEmail = generateTestEmail('test-otp');

		// Create a confirmed user via admin API
		const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
			email: registeredEmail,
			email_confirm: true, // Mark as confirmed
			user_metadata: { display_name: 'Test User' },
		});

		expect(createError).toBeNull();
		expect(createData.user).not.toBeNull();

		if (createData.user?.id) {
			createdUserIds.push(createData.user.id);
		}

		// Now try to sign in with OTP - should succeed (no error)
		const { error: otpError } = await supabase.auth.signInWithOtp({
			email: registeredEmail,
			options: {
				shouldCreateUser: false,
			},
		});

		// OTP request should succeed for registered user
		expect(otpError).toBeNull();
	});

	it('should accept OTP request for unconfirmed user (OTP confirms email)', async () => {
		const adminClient = createClientBypassRLS();
		const supabase = createClientAnon();
		const unconfirmedEmail = generateTestEmail('test-otp');

		// Create an unconfirmed user via admin API
		const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
			email: unconfirmedEmail,
			email_confirm: false, // NOT confirmed
			user_metadata: { display_name: 'Unconfirmed User' },
		});

		expect(createError).toBeNull();
		expect(createData.user).not.toBeNull();

		if (createData.user?.id) {
			createdUserIds.push(createData.user.id);
		}

		// Try to sign in with OTP
		const { error: otpError } = await supabase.auth.signInWithOtp({
			email: unconfirmedEmail,
			options: {
				shouldCreateUser: false,
			},
		});

		// Supabase allows OTP for unconfirmed users - the OTP flow
		// itself confirms the email when the user clicks the link or enters the code.
		expect(otpError).toBeNull();
	});

	it('should allow OTP registration when shouldCreateUser is true (default)', async () => {
		const supabase = createClientAnon();
		const newUserEmail = generateTestEmail('test-otp');

		const { error } = await supabase.auth.signInWithOtp({
			email: newUserEmail,
			options: {
				shouldCreateUser: true,
				data: {
					display_name: 'New Registration',
				},
			},
		});

		// Should succeed - user will be created on OTP verification
		expect(error).toBeNull();

		// Clean up: find and delete the pending user if created
		const adminClient = createClientBypassRLS();
		const { data: users } = await adminClient.auth.admin.listUsers();
		const createdUser = users?.users?.find((u) => u.email === newUserEmail);
		if (createdUser?.id) {
			createdUserIds.push(createdUser.id);
		}
	});
});
