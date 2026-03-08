import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createClientBypassRLS } from '../../db';

import { type DatabaseState, setupDatabaseStateVerification } from '../db-state';

let initialState: DatabaseState;
const { setupState, verifyState } = setupDatabaseStateVerification();

beforeAll(async () => {
	initialState = await setupState();
});

afterAll(async () => {
	await verifyState(initialState);
});

const supabase = createClientBypassRLS();

// Ground truth: expected security configuration from baseline migration
const EXPECTED_RLS_TABLES = [
	'profiles',
	'user_roles',
	'lesson_types',
	'teachers',
	'teacher_availability',
	'teacher_lesson_types',
	'lesson_type_options',
	'lesson_agreements',
	'students',
	'agenda_events',
	'agenda_participants',
	'agenda_event_deviations',
];

const EXPECTED_POLICIES: Record<string, string[]> = {
	profiles: [
		// SELECT policy - combined: users can view own profile, privileged users can view all
		'profiles_select',
		// UPDATE policy - combined: users can update own profile, admins can update any
		'profiles_update',
		// SELECT - students can view profiles of teachers they have a lesson_agreement with
		'students_select_teacher_profiles',
		// SELECT - teachers can view profiles of students they have a lesson_agreement with
		'teachers_select_student_profiles',
		// Intentionally NO INSERT policy - profiles are only created via handle_new_user() trigger
		// Intentionally NO DELETE policy - profiles are only removed via CASCADE from auth.users
	],
	user_roles: [
		// SELECT policy - combined: users can view own role, privileged users can view all
		'roles_select',
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
		// SELECT policy - combined: teachers can view own record, privileged users can view all
		'teachers_select',
		// SELECT - students can view teachers they have a lesson_agreement with
		'students_select_own_teachers',
		// INSERT policy
		'teachers_insert_admin',
		// UPDATE policy - combined: teachers can update own record, admins can update any
		'teachers_update',
		// DELETE policy
		'teachers_delete_admin',
	],
	teacher_availability: [
		// SELECT policy - combined: teachers can view own availability, privileged users can view all
		'teacher_availability_select',
		// INSERT policy - combined: teachers can insert own availability, admins can insert for any
		'teacher_availability_insert',
		// UPDATE policy - combined: teachers can update own availability, admins can update any
		'teacher_availability_update',
		// DELETE policy - combined: teachers can delete own availability, admins can delete any
		'teacher_availability_delete',
	],
	teacher_lesson_types: [
		// SELECT policy - combined: teachers can view own lesson types, privileged users can view all
		'teacher_lesson_types_select',
		// INSERT policy
		'teacher_lesson_types_insert_admin',
		// DELETE policy
		'teacher_lesson_types_delete_admin',
	],
	lesson_type_options: [
		'lesson_type_options_select_all',
		'lesson_type_options_insert_admin',
		'lesson_type_options_update_admin',
		'lesson_type_options_delete_admin',
	],
	lesson_agreements: [
		// SELECT policy - combined: students, teachers, and privileged users can view agreements
		'lesson_agreements_select',
		// INSERT policy
		'lesson_agreements_insert_staff',
		// UPDATE policy
		'lesson_agreements_update_staff',
		// DELETE policy
		'lesson_agreements_delete_staff',
	],
	students: [
		// SELECT policy - combined: students can view own record, privileged users can view all
		'students_select',
		// SELECT - teachers can view students they have a lesson_agreement with
		'teachers_select_own_students',
		// UPDATE policy - admin can update student notes
		'students_update_admin',
		// No INSERT/DELETE policies - students are managed via triggers
	],
	agenda_events: [
		// SELECT policy - participants or privileged users can view events
		'agenda_events_select',
		// INSERT policy - owner or privileged users can insert events
		'agenda_events_insert',
		// UPDATE policy - owner or privileged users can update events
		'agenda_events_update',
		// DELETE policy - owner or privileged users can delete events
		'agenda_events_delete',
	],
	agenda_participants: [
		// SELECT policy - own rows, event owner, or privileged users
		'agenda_participants_select',
		// INSERT policy - event owner or privileged users
		'agenda_participants_insert',
		// UPDATE policy - event owner or privileged users
		'agenda_participants_update',
		// DELETE policy - event owner or privileged users
		'agenda_participants_delete',
	],
	agenda_event_deviations: [
		// SELECT policy - participants or privileged users can view deviations
		'agenda_event_deviations_select',
		// INSERT policy - event owner or privileged users can insert deviations
		'agenda_event_deviations_insert',
		// UPDATE policy - event owner or privileged users can update deviations
		'agenda_event_deviations_update',
		// DELETE policy - event owner or privileged users can delete deviations
		'agenda_event_deviations_delete',
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
	// Agenda system functions and triggers
	'trigger_lesson_agreement_create_agenda_event',
	'get_agenda_event_owner',
	'enforce_agenda_deviation_immutable_fields',
	'auto_delete_noop_agenda_deviation',
	'enforce_agenda_deviation_validity',
	'prevent_owner_participant_removal',
	'shift_recurring_deviation_to_next_week',
	'end_recurring_deviation_from_week',
	'ensure_week_shows_original_slot',
	// Authorization helpers
	'can_delete_user',
	// Introspection functions for CI testing
	'check_rls_enabled',
	'policy_exists',
	'get_table_policies',
	'function_exists',
	'get_public_table_names',
	'get_security_definer_views',
	// Pagination functions
	'get_lesson_agreements_paginated',
];

// Views that are INTENTIONALLY using SECURITY DEFINER semantics (security_invoker = false)
// These views bypass RLS and must be carefully reviewed for security implications.
// Each entry requires a documented justification in the migration file.
//
// IMPORTANT: Adding a view here should be a conscious security decision with:
// 1. Documentation in the migration explaining WHY security_definer is needed
// 2. Explicit authorization checks within the view/function (e.g., auth.uid() checks)
// 3. Tests verifying that unauthorized users cannot access data through the view
const ALLOWED_SECURITY_DEFINER_VIEWS: string[] = [];

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

	describe('View security configuration', () => {
		it('no unexpected SECURITY DEFINER views exist', async () => {
			// Get all views and their security_invoker setting
			const { data: views, error } = await supabase.rpc('get_security_definer_views');

			expect(error).toBeNull();
			expect(views).toBeDefined();

			// Filter views that are NOT using security_invoker (i.e., using security_definer semantics)
			// These bypass RLS and should be explicitly allowed
			const securityDefinerViews = (views ?? [])
				.filter((v: { view_name: string; security_invoker: boolean }) => !v.security_invoker)
				.map((v: { view_name: string }) => v.view_name);

			// Find any views that are security_definer but NOT in our allowlist
			const unexpectedSecurityDefinerViews = securityDefinerViews.filter(
				(viewName: string) => !ALLOWED_SECURITY_DEFINER_VIEWS.includes(viewName),
			);

			// This test will fail if someone adds a new view without security_invoker = on
			// To fix: either add security_invoker = on to the view, or add it to ALLOWED_SECURITY_DEFINER_VIEWS
			// with proper documentation and security review
			expect(unexpectedSecurityDefinerViews).toEqual([]);
		});

		it('all allowed SECURITY DEFINER views exist', async () => {
			// Verify that all views in our allowlist actually exist
			const { data: views, error } = await supabase.rpc('get_security_definer_views');

			expect(error).toBeNull();
			expect(views).toBeDefined();

			const viewNames = (views ?? []).map((v: { view_name: string }) => v.view_name);

			for (const allowedView of ALLOWED_SECURITY_DEFINER_VIEWS) {
				expect(viewNames).toContain(allowedView);
			}
		});

		it('views with security_invoker respect RLS', async () => {
			// Get all views with security_invoker = true
			const { data: views, error } = await supabase.rpc('get_security_definer_views');

			expect(error).toBeNull();

			const securityInvokerViews = (views ?? [])
				.filter((v: { security_invoker: boolean }) => v.security_invoker)
				.map((v: { view_name: string }) => v.view_name);

			// Verify view_profiles_with_display_name is using security_invoker
			expect(securityInvokerViews).toContain('view_profiles_with_display_name');
		});
	});
});
