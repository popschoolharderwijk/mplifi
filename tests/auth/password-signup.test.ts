/**
 * Tests for password policy enforcement.
 *
 * This application uses passwordless (OTP/Magic Link) authentication exclusively.
 * The frontend offers no way to set or use passwords.
 *
 * However, Supabase's Auth API technically supports password-based signup.
 * To prevent abuse via direct API calls, we configure strict password requirements
 * in Supabase Dashboard (Authentication → Policies):
 *
 * - Minimum password length: 32 characters
 * - Password requirements: letters, digits, AND symbols
 *
 * These tests verify that Supabase correctly rejects passwords that don't meet
 * these requirements, making password-based signup practically unusable.
 */

import { afterAll, describe, expect, it } from 'bun:test';
import { createClientAnon, createClientBypassRLS } from '../db';
import { generateTestEmail } from '../utils';

describe('Password policy enforcement', () => {
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

	it('should reject password shorter than 32 characters', async () => {
		const supabase = createClientAnon();
		const testEmail = generateTestEmail();

		// 31 characters with letters, digits, and symbols - still too short
		const shortPassword = 'Aa1!Bb2@Cc3#Dd4$Ee5%Ff6^Gg7&Hh';

		const { data, error } = await supabase.auth.signUp({
			email: testEmail,
			password: shortPassword,
		});

		// Track for cleanup if user was unexpectedly created
		if (data.user?.id) {
			createdUserIds.push(data.user.id);
		}

		expect(error).not.toBeNull();
		expect(error?.message).toMatch(/password/i);
		expect(data.user).toBeNull();
	});

	it('should reject password without symbols', async () => {
		const supabase = createClientAnon();
		const testEmail = generateTestEmail();

		// 32+ characters with letters and digits, but no symbols
		const noSymbolsPassword = 'Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk';

		const { data, error } = await supabase.auth.signUp({
			email: testEmail,
			password: noSymbolsPassword,
		});

		// Track for cleanup if user was unexpectedly created
		if (data.user?.id) {
			createdUserIds.push(data.user.id);
		}

		expect(error).not.toBeNull();
		expect(error?.message).toMatch(/password/i);
		expect(data.user).toBeNull();
	});

	it('should reject password without digits', async () => {
		const supabase = createClientAnon();
		const testEmail = generateTestEmail();

		// 32+ characters with letters and symbols, but no digits
		const noDigitsPassword = 'Aa!Bb@Cc#Dd$Ee%Ff^Gg&Hh*Ii(Jj)Kk';

		const { data, error } = await supabase.auth.signUp({
			email: testEmail,
			password: noDigitsPassword,
		});

		// Track for cleanup if user was unexpectedly created
		if (data.user?.id) {
			createdUserIds.push(data.user.id);
		}

		expect(error).not.toBeNull();
		expect(error?.message).toMatch(/password/i);
		expect(data.user).toBeNull();
	});

	it('should reject password without uppercase letters', async () => {
		const supabase = createClientAnon();
		const testEmail = generateTestEmail();

		// 32+ characters with lowercase, digits, and symbols, but no uppercase
		const noUppercasePassword = 'aa1!bb2@cc3#dd4$ee5%ff6^gg7&hh8*';

		const { data, error } = await supabase.auth.signUp({
			email: testEmail,
			password: noUppercasePassword,
		});

		// Track for cleanup if user was unexpectedly created
		if (data.user?.id) {
			createdUserIds.push(data.user.id);
		}

		expect(error).not.toBeNull();
		expect(error?.message).toMatch(/password/i);
		expect(data.user).toBeNull();
	});

	it('should reject password without lowercase letters', async () => {
		const supabase = createClientAnon();
		const testEmail = generateTestEmail();

		// 32+ characters with uppercase, digits, and symbols, but no lowercase
		const noLowercasePassword = 'AA1!BB2@CC3#DD4$EE5%FF6^GG7&HH8*';

		const { data, error } = await supabase.auth.signUp({
			email: testEmail,
			password: noLowercasePassword,
		});

		// Track for cleanup if user was unexpectedly created
		if (data.user?.id) {
			createdUserIds.push(data.user.id);
		}

		expect(error).not.toBeNull();
		expect(error?.message).toMatch(/password/i);
		expect(data.user).toBeNull();
	});

	it('should accept a password that meets all requirements (user created but unconfirmed)', async () => {
		const supabase = createClientAnon();
		const testEmail = generateTestEmail();

		// 32 characters with uppercase, lowercase, digits, and symbols
		const validPassword = 'Aa1!Bb2@Cc3#Dd4$Ee5%Ff6^Gg7&Hh8*';

		const { data, error } = await supabase.auth.signUp({
			email: testEmail,
			password: validPassword,
		});

		// Track user for cleanup if created
		if (data.user?.id) {
			createdUserIds.push(data.user.id);
		}

		// Password meets requirements, so signup should succeed
		expect(error).toBeNull();
		expect(data.user).not.toBeNull();
		// User exists but is not confirmed (email verification required)
		expect(data.user?.email_confirmed_at).toBeFalsy();
	});
});
