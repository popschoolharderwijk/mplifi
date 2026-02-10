import { describe, expect, it } from 'bun:test';
import { createClientBypassRLS } from '../../db';

const supabase = createClientBypassRLS();

// Ground truth: expected security configuration from baseline migration
const EXPECTED_RLS_TABLES = [
	'profiles',
	'user_roles',
	'lesson_types',
	'teachers',
	'teacher_availability',
	'teacher_lesson_types',
	'lesson_agreements',
	'students',
	'lesson_appointment_deviations',
];

const EXPECTED_POLICIES: Record<string, string[]> = {
	profiles: [
		// SELECT policies
		'profiles_select_own',
		'profiles_select_admin',
		'profiles_select_staff',
		// UPDATE policies
		'profiles_update_own',
		'profiles_update_admin',
		// Intentionally NO INSERT policy - profiles are only created via handle_new_user() trigger
		// Intentionally NO DELETE policy - profiles are only removed via CASCADE from auth.users
	],
	user_roles: [
		// SELECT policies
		'roles_select_own',
		'roles_select_admin',
		'roles_select_staff',
		// INSERT policy - admin/site_admin can assign roles (admin cannot assign site_admin)
		'roles_insert_admin',
		// UPDATE policy - admin/site_admin can change roles (admin cannot modify site_admin roles)
		'roles_update_admin',
		// DELETE policy - admin/site_admin can delete roles (admin cannot delete site_admin roles)
		'roles_delete_admin',
	],
	lesson_types: [
		// SELECT policy - all authenticated users can view lesson types
		'lesson_types_select_all',
		// INSERT policy - admin/site_admin can create lesson types
		'lesson_types_insert_admin',
		// UPDATE policy - admin/site_admin can update lesson types
		'lesson_types_update_admin',
		// DELETE policy - admin/site_admin can delete lesson types
		'lesson_types_delete_admin',
	],
	teachers: [
		// SELECT policies
		'teachers_select_own',
		'teachers_select_staff',
		// INSERT policy
		'teachers_insert_admin',
		// UPDATE policies
		'teachers_update_own',
		'teachers_update_admin',
		// DELETE policy
		'teachers_delete_admin',
	],
	teacher_availability: [
		// SELECT policies
		'teacher_availability_select_own',
		'teacher_availability_select_staff',
		// INSERT policies
		'teacher_availability_insert_own',
		'teacher_availability_insert_admin',
		// UPDATE policies
		'teacher_availability_update_own',
		'teacher_availability_update_admin',
		// DELETE policies
		'teacher_availability_delete_own',
		'teacher_availability_delete_admin',
	],
	teacher_lesson_types: [
		// SELECT policies
		'teacher_lesson_types_select_own',
		'teacher_lesson_types_select_staff',
		// INSERT policy
		'teacher_lesson_types_insert_admin',
		// DELETE policy
		'teacher_lesson_types_delete_admin',
	],
	lesson_agreements: [
		// SELECT policies
		'lesson_agreements_select_student',
		'lesson_agreements_select_teacher',
		'lesson_agreements_select_staff',
		// INSERT policy
		'lesson_agreements_insert_staff',
		// UPDATE policy
		'lesson_agreements_update_staff',
		// DELETE policy
		'lesson_agreements_delete_staff',
	],
	students: [
		// SELECT policies
		'students_select_own',
		'students_select_staff',
		// UPDATE policy - admin can update student notes
		'students_update_admin',
		// No INSERT/DELETE policies - students are managed via triggers
	],
	lesson_appointment_deviations: [
		// SELECT policies
		'lesson_appointment_deviations_select_teacher',
		'lesson_appointment_deviations_select_student',
		'lesson_appointment_deviations_select_staff',
		// INSERT policies
		'lesson_appointment_deviations_insert_teacher',
		'lesson_appointment_deviations_insert_staff',
		// UPDATE policies
		'lesson_appointment_deviations_update_teacher',
		'lesson_appointment_deviations_update_staff',
		// DELETE policies
		'lesson_appointment_deviations_delete_teacher',
		'lesson_appointment_deviations_delete_staff',
	],
};

const EXPECTED_FUNCTIONS = [
	// Role helper functions
	'_has_role',
	'is_site_admin',
	'is_admin',
	'is_staff',
	'is_privileged',
	'is_teacher',
	'get_teacher_id',
	// User lifecycle
	'handle_new_user',
	'handle_auth_user_email_update',
	// Data integrity triggers
	'update_updated_at_column',
	'prevent_user_id_change',
	'prevent_profile_email_change',
	'prevent_last_site_admin_removal',
	// Lesson agreements triggers
	'trigger_ensure_student_on_agreement_insert',
	'trigger_cleanup_student_on_agreement_delete',
	// Lesson appointment deviations triggers
	'enforce_deviation_immutable_fields',
	// Authorization helpers
	'can_delete_user',
	// Introspection functions for CI testing
	'check_rls_enabled',
	'policy_exists',
	'get_table_policies',
	'function_exists',
	'get_public_table_names',
	// Pagination functions
	'get_lesson_agreements_paginated',
];

describe('RLS Baseline Security Checks', () => {
	describe('RLS is enabled on all tables', () => {
		for (const table of EXPECTED_RLS_TABLES) {
			it(`${table} has RLS enabled`, async () => {
				const { data, error } = await supabase.rpc('check_rls_enabled', {
					p_table_name: table,
				});

				expect(error).toBeNull();
				expect(data).toBe(true);
			});
		}
	});

	describe('All expected policies exist', () => {
		for (const [table, policies] of Object.entries(EXPECTED_POLICIES)) {
			describe(table, () => {
				for (const policy of policies) {
					it(`has policy: ${policy}`, async () => {
						const { data, error } = await supabase.rpc('policy_exists', {
							p_table_name: table,
							p_policy_name: policy,
						});

						expect(error).toBeNull();
						expect(data).toBe(true);
					});
				}
			});
		}
	});

	describe('No unexpected policies exist', () => {
		for (const [table, expectedPolicies] of Object.entries(EXPECTED_POLICIES)) {
			it(`${table} has exactly the expected policies`, async () => {
				const { data: actualPolicies, error } = await supabase.rpc('get_table_policies', {
					p_table_name: table,
				});

				expect(error).toBeNull();
				expect(actualPolicies?.sort()).toEqual(expectedPolicies.sort());
			});
		}
	});

	describe('Security helper functions exist', () => {
		for (const fn of EXPECTED_FUNCTIONS) {
			it(`function ${fn} exists`, async () => {
				const { data, error } = await supabase.rpc('function_exists', {
					p_fn_name: fn,
				});

				expect(error).toBeNull();
				expect(data).toBe(true);
			});
		}
	});
});
