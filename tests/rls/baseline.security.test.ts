import { describe, expect, it } from 'bun:test';
import { createClientBypassRLS } from './db';

const supabase = createClientBypassRLS();

// Ground truth: expected security configuration from baseline migration
const EXPECTED_RLS_TABLES = ['profiles', 'user_roles', 'teacher_students'];

const EXPECTED_POLICIES: Record<string, string[]> = {
	profiles: [
		// SELECT policies
		'profiles_select_own',
		'profiles_select_admin',
		'profiles_select_staff',
		'profiles_select_teacher_students',
		// UPDATE policies
		'profiles_update_own',
		'profiles_update_admin',
		'profiles_update_staff',
		// Intentionally NO INSERT policy - profiles are only created via handle_new_user() trigger
		// Intentionally NO DELETE policy - profiles are only removed via CASCADE from auth.users
	],
	user_roles: [
		// SELECT policies
		'roles_select_own',
		'roles_select_admin',
		'roles_select_staff',
		'roles_select_teacher_students',
		// UPDATE policy - only site_admin can change roles
		'roles_update_site_admin',
		// Intentionally NO INSERT policy - roles are only created via handle_new_user() trigger
		// Intentionally NO DELETE policy - roles are only removed via CASCADE from auth.users
	],
	teacher_students: [
		// Teachers manage their own student links
		'teacher_students_select_own',
		'teacher_students_insert_own',
		'teacher_students_delete_own',
		// Admin/staff can view all links
		'teacher_students_select_admin',
		'teacher_students_select_staff',
	],
};

const EXPECTED_FUNCTIONS = [
	// Role helper functions
	'_has_role',
	'is_site_admin',
	'is_admin',
	'is_staff',
	'is_teacher',
	'is_student',
	// User lifecycle
	'handle_new_user',
	'handle_auth_user_email_update',
	// Data integrity triggers
	'update_updated_at_column',
	'prevent_user_id_change',
	'prevent_profile_email_change',
	'prevent_last_site_admin_removal',
	// Introspection functions for CI testing
	'check_rls_enabled',
	'policy_exists',
	'get_table_policies',
	'function_exists',
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
