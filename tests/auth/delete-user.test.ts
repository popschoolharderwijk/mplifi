/**
 * Tests for user deletion functionality.
 *
 * Verifies that:
 * 1. Users can be deleted and CASCADE removes profile
 * 2. The last site_admin cannot be deleted (trigger protection)
 * 3. Non-last site_admin can be deleted after another is promoted
 *
 * Note: These tests verify the database-level behavior. The Edge Function
 * uses auth.admin.deleteUser() which triggers the same CASCADE behavior.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientBypassRLS } from '../db';
import { generateTestEmail, requireUser } from '../utils';

describe('User deletion', () => {
	const adminClient = createClientBypassRLS();
	const createdUserIds: string[] = [];

	// Cleanup: delete any remaining test users
	afterAll(async () => {
		for (const userId of createdUserIds) {
			try {
				await adminClient.auth.admin.deleteUser(userId);
			} catch {
				// Ignore errors - user might already be deleted by test
			}
		}
	});

	describe('CASCADE delete behavior', () => {
		it('should delete profile when user is deleted', async () => {
			const testEmail = generateTestEmail('delete-cascade');

			// Create a user (triggers handle_new_user which creates profile)
			const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
				email: testEmail,
				email_confirm: true,
				user_metadata: { first_name: 'Test', last_name: 'Delete' },
			});

			expect(createError).toBeNull();
			const userId = requireUser(createData).id;

			// Verify profile exists
			const { data: profileBefore } = await adminClient
				.from('profiles')
				.select('*')
				.eq('user_id', userId)
				.single();
			expect(profileBefore).not.toBeNull();
			expect(profileBefore?.email).toBe(testEmail);

			// New users do not have an entry in user_roles
			const { data: roleBefore } = await adminClient
				.from('user_roles')
				.select('*')
				.eq('user_id', userId)
				.maybeSingle();
			expect(roleBefore).toBeNull();

			// Delete the user
			const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
			expect(deleteError).toBeNull();

			// Verify profile is gone (CASCADE)
			const { data: profileAfter, error: profileError } = await adminClient
				.from('profiles')
				.select('*')
				.eq('user_id', userId)
				.single();
			expect(profileAfter).toBeNull();
			expect(profileError?.code).toBe('PGRST116'); // No rows returned
		});
	});

	describe('Last site_admin protection', () => {
		let seedSiteAdminId: string;

		beforeAll(async () => {
			// Get the existing site_admin from seed data
			const { data: siteAdmins, error } = await adminClient
				.from('user_roles')
				.select('user_id')
				.eq('role', 'site_admin');

			if (error || !siteAdmins || siteAdmins.length !== 1) {
				throw new Error(`Expected exactly 1 site_admin in seed data, found ${siteAdmins?.length ?? 0}`);
			}

			seedSiteAdminId = siteAdmins[0].user_id;
		});

		it('should prevent deleting the last site_admin', async () => {
			// Try to delete the only site_admin - should fail
			const { error: deleteError } = await adminClient.auth.admin.deleteUser(seedSiteAdminId);

			// The trigger should prevent this (Supabase wraps trigger errors in generic message)
			expect(deleteError).not.toBeNull();
			expect(deleteError?.message).toContain('Database error deleting user');

			// Verify the user still exists (deletion was actually blocked)
			const { data: userStillExists } = await adminClient.auth.admin.getUserById(seedSiteAdminId);
			expect(userStillExists.user).not.toBeNull();
		});

		it('should allow deleting a site_admin when another exists', async () => {
			// Create a second site_admin
			const secondAdminEmail = generateTestEmail('site-admin-second');
			const { data: secondData } = await adminClient.auth.admin.createUser({
				email: secondAdminEmail,
				email_confirm: true,
			});
			const secondAdminId = requireUser(secondData).id;
			createdUserIds.push(secondAdminId);

			// Create role entry and set to site_admin
			await adminClient.from('user_roles').insert({ user_id: secondAdminId, role: 'site_admin' });

			// Now we have 2 site_admins, so deleting the new one should work
			const { error: deleteError } = await adminClient.auth.admin.deleteUser(secondAdminId);
			expect(deleteError).toBeNull();

			// Remove from cleanup list since already deleted
			const index = createdUserIds.indexOf(secondAdminId);
			if (index > -1) createdUserIds.splice(index, 1);

			// Verify the seed site_admin still exists
			const { data: seedAdminStillExists } = await adminClient.auth.admin.getUserById(seedSiteAdminId);
			expect(seedAdminStillExists.user).not.toBeNull();
		});
	});
});
