/**
 * Tests for account deletion functionality.
 *
 * Verifies that:
 * 1. Users can be deleted and CASCADE removes profile + user_roles
 * 2. The last site_admin cannot be deleted (trigger protection)
 * 3. Non-last site_admin can be deleted after another is promoted
 *
 * Note: These tests verify the database-level behavior. The Edge Function
 * uses auth.admin.deleteUser() which triggers the same CASCADE behavior.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientBypassRLS } from '../db';
import { generateTestEmail, requireUser } from '../utils';

describe('Account deletion', () => {
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

			// Create a user (triggers handle_new_user which creates profile + role)
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

			// Verify user_roles exists
			const { data: roleBefore } = await adminClient
				.from('user_roles')
				.select('*')
				.eq('user_id', userId)
				.single();
			expect(roleBefore).not.toBeNull();
			expect(roleBefore?.role).toBe('student'); // Default role

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

			// Verify user_roles is gone (CASCADE)
			const { data: roleAfter, error: roleError } = await adminClient
				.from('user_roles')
				.select('*')
				.eq('user_id', userId)
				.single();
			expect(roleAfter).toBeNull();
			expect(roleError?.code).toBe('PGRST116'); // No rows returned
		});

		it('should delete teacher_students relations when teacher is deleted', async () => {
			const teacherEmail = generateTestEmail('delete-teacher');
			const studentEmail = generateTestEmail('delete-student');

			// Create teacher
			const { data: teacherData } = await adminClient.auth.admin.createUser({
				email: teacherEmail,
				email_confirm: true,
			});
			const teacherId = requireUser(teacherData).id;
			createdUserIds.push(teacherId);

			// Create student
			const { data: studentData } = await adminClient.auth.admin.createUser({
				email: studentEmail,
				email_confirm: true,
			});
			const studentId = requireUser(studentData).id;
			createdUserIds.push(studentId);

			// Set teacher role
			await adminClient.from('user_roles').update({ role: 'teacher' }).eq('user_id', teacherId);

			// Create teacher-student relation
			await adminClient.from('teacher_students').insert({ teacher_id: teacherId, student_id: studentId });

			// Verify relation exists
			const { data: relationBefore } = await adminClient
				.from('teacher_students')
				.select('*')
				.eq('teacher_id', teacherId)
				.eq('student_id', studentId)
				.single();
			expect(relationBefore).not.toBeNull();

			// Delete the teacher
			const { error: deleteError } = await adminClient.auth.admin.deleteUser(teacherId);
			expect(deleteError).toBeNull();
			// Remove from cleanup list since already deleted
			const teacherIndex = createdUserIds.indexOf(teacherId);
			if (teacherIndex > -1) createdUserIds.splice(teacherIndex, 1);

			// Verify relation is gone (CASCADE)
			const { data: relationAfter, error: relationError } = await adminClient
				.from('teacher_students')
				.select('*')
				.eq('teacher_id', teacherId)
				.eq('student_id', studentId)
				.single();
			expect(relationAfter).toBeNull();
			expect(relationError?.code).toBe('PGRST116'); // No rows returned

			// Student should still exist
			const { data: studentStillExists } = await adminClient.auth.admin.getUserById(studentId);
			expect(studentStillExists.user).not.toBeNull();
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

			// Promote to site_admin
			await adminClient.from('user_roles').update({ role: 'site_admin' }).eq('user_id', secondAdminId);

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
