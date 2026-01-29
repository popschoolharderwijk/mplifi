/**
 * RLS Role Analyzer
 *
 * Parses RLS policy expressions to extract which roles have access to which operations.
 * This enables dynamic generation of a roles comparison matrix.
 */

import { ALL_ROLES, type AppRole } from './roles';

export interface RLSPolicy {
	table_name: string;
	policy_name: string;
	command: string;
	roles: string;
	using_expression: string;
	with_check_expression: string;
}

export type PermissionLevel = 'full' | 'own' | 'limited' | 'none';

export interface RolePermission {
	role: AppRole;
	level: PermissionLevel;
	description?: string;
}

export interface PermissionEntry {
	id: string;
	table: string;
	operation: string;
	description: string;
	permissions: Map<AppRole, PermissionLevel>;
	policies: string[];
}

export type PermissionCategory = 'select' | 'update' | 'insert' | 'delete';

export interface GroupedPermission {
	id: string;
	category: PermissionCategory;
	table: string;
	description: string;
	checkPolicies: (policies: RLSPolicy[]) => Map<AppRole, PermissionLevel>;
}

/**
 * Category display names
 */
export const CATEGORY_DISPLAY: Record<PermissionCategory, string> = {
	select: 'Bekijken',
	update: 'Wijzigen',
	insert: 'Toevoegen',
	delete: 'Verwijderen',
};

/**
 * Helper to create a default permission map
 */
function createDefaultMap(): Map<AppRole, PermissionLevel> {
	const result = new Map<AppRole, PermissionLevel>();
	for (const role of ALL_ROLES) {
		result.set(role, 'none');
	}
	return result;
}

/**
 * Grouped permission descriptions for the matrix (user-friendly)
 */
export const GROUPED_PERMISSIONS: GroupedPermission[] = [
	// =====================================================
	// PROFILES - SELECT
	// =====================================================
	{
		id: 'view_own_profile',
		category: 'select',
		table: 'profiles',
		description: 'Eigen profiel',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'profiles' || policy.command !== 'SELECT') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('auth.uid()') && expr.includes('user_id') && !expr.includes('is_')) {
					for (const role of ALL_ROLES) {
						result.set(role, 'own');
					}
				}
			}
			return result;
		},
	},
	{
		id: 'view_all_profiles',
		category: 'select',
		table: 'profiles',
		description: 'Alle profielen',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'profiles' || policy.command !== 'SELECT') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('is_site_admin') || expr.includes('is_admin')) {
					result.set('site_admin', 'full');
					result.set('admin', 'full');
				}
				if (expr.includes('is_staff')) {
					result.set('staff', 'full');
				}
			}
			return result;
		},
	},
	{
		id: 'view_student_profiles',
		category: 'select',
		table: 'profiles',
		description: 'Leerling profielen (eigen)',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'profiles' || policy.command !== 'SELECT') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('is_teacher') && expr.includes('teacher_students')) {
					result.set('teacher', 'limited');
				}
			}
			return result;
		},
	},
	// =====================================================
	// PROFILES - UPDATE
	// =====================================================
	{
		id: 'edit_own_profile',
		category: 'update',
		table: 'profiles',
		description: 'Eigen profiel',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'profiles' || policy.command !== 'UPDATE') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('auth.uid()') && expr.includes('user_id') && !expr.includes('is_')) {
					for (const role of ALL_ROLES) {
						result.set(role, 'own');
					}
				}
			}
			return result;
		},
	},
	{
		id: 'edit_all_profiles',
		category: 'update',
		table: 'profiles',
		description: 'Alle profielen',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'profiles' || policy.command !== 'UPDATE') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('is_site_admin') || expr.includes('is_admin')) {
					result.set('site_admin', 'full');
					result.set('admin', 'full');
				}
			}
			return result;
		},
	},
	{
		id: 'edit_student_profiles',
		category: 'update',
		table: 'profiles',
		description: 'Leerling profielen',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'profiles' || policy.command !== 'UPDATE') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('is_staff') && expr.includes('is_student')) {
					result.set('staff', 'limited');
				}
			}
			return result;
		},
	},
	// =====================================================
	// USER_ROLES - SELECT
	// =====================================================
	{
		id: 'view_own_role',
		category: 'select',
		table: 'user_roles',
		description: 'Eigen rol',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'user_roles' || policy.command !== 'SELECT') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('auth.uid()') && expr.includes('user_id')) {
					for (const role of ALL_ROLES) {
						result.set(role, 'own');
					}
				}
			}
			return result;
		},
	},
	{
		id: 'view_all_roles',
		category: 'select',
		table: 'user_roles',
		description: 'Alle rollen',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'user_roles' || policy.command !== 'SELECT') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('is_site_admin') || expr.includes('is_admin')) {
					result.set('site_admin', 'full');
					result.set('admin', 'full');
				}
				if (expr.includes('is_staff')) {
					result.set('staff', 'full');
				}
			}
			return result;
		},
	},
	{
		id: 'view_student_roles',
		category: 'select',
		table: 'user_roles',
		description: 'Leerling rollen (eigen)',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'user_roles' || policy.command !== 'SELECT') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('is_teacher') && expr.includes('teacher_students')) {
					result.set('teacher', 'limited');
				}
			}
			return result;
		},
	},
	// =====================================================
	// USER_ROLES - UPDATE
	// =====================================================
	{
		id: 'change_roles',
		category: 'update',
		table: 'user_roles',
		description: 'Rollen wijzigen',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'user_roles' || policy.command !== 'UPDATE') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('is_site_admin')) {
					result.set('site_admin', 'limited'); // Limited because can't change own role
				}
			}
			return result;
		},
	},
	// =====================================================
	// TEACHER_STUDENTS - SELECT
	// =====================================================
	{
		id: 'view_own_students',
		category: 'select',
		table: 'teacher_students',
		description: 'Eigen leerlingen',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'teacher_students' || policy.command !== 'SELECT') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('teacher_id') && expr.includes('auth.uid()')) {
					result.set('teacher', 'own');
				}
			}
			return result;
		},
	},
	{
		id: 'view_all_student_links',
		category: 'select',
		table: 'teacher_students',
		description: 'Alle koppelingen',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'teacher_students' || policy.command !== 'SELECT') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('is_site_admin') || expr.includes('is_admin')) {
					result.set('site_admin', 'full');
					result.set('admin', 'full');
				}
				if (expr.includes('is_staff')) {
					result.set('staff', 'full');
				}
			}
			return result;
		},
	},
	// =====================================================
	// TEACHER_STUDENTS - INSERT
	// =====================================================
	{
		id: 'link_students',
		category: 'insert',
		table: 'teacher_students',
		description: 'Leerlingen koppelen',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'teacher_students' || policy.command !== 'INSERT') continue;
				const expr = (policy.using_expression + ' ' + policy.with_check_expression).toLowerCase();
				if (expr.includes('is_teacher') && expr.includes('teacher_id')) {
					result.set('teacher', 'own');
				}
			}
			return result;
		},
	},
	// =====================================================
	// TEACHER_STUDENTS - DELETE
	// =====================================================
	{
		id: 'unlink_students',
		category: 'delete',
		table: 'teacher_students',
		description: 'Leerlingen ontkoppelen',
		checkPolicies: (policies) => {
			const result = createDefaultMap();
			for (const policy of policies) {
				if (policy.table_name !== 'teacher_students' || policy.command !== 'DELETE') continue;
				const expr = policy.using_expression.toLowerCase();
				if (expr.includes('teacher_id') && expr.includes('auth.uid()')) {
					result.set('teacher', 'own');
				}
			}
			return result;
		},
	},
	// =====================================================
	// AUTH.USERS - DELETE (via can_delete_user function)
	// =====================================================
	// These are not RLS policies but authorization function logic.
	// The can_delete_user() function in the database defines these rules.
	{
		id: 'delete_own_account',
		category: 'delete',
		table: 'auth.users',
		description: 'Eigen account verwijderen',
		checkPolicies: () => {
			// All authenticated users can delete their own account
			// This is defined in can_delete_user(): _requester_id = _target_id
			const result = createDefaultMap();
			for (const role of ALL_ROLES) {
				result.set(role, 'own');
			}
			return result;
		},
	},
	{
		id: 'delete_other_accounts',
		category: 'delete',
		table: 'auth.users',
		description: 'Andere accounts verwijderen',
		checkPolicies: () => {
			// Admin and site_admin can delete any user's account
			// This is defined in can_delete_user(): is_admin() OR is_site_admin()
			const result = createDefaultMap();
			result.set('site_admin', 'full');
			result.set('admin', 'full');
			return result;
		},
	},
];

export interface AnalyzedPermission {
	id: string;
	category: PermissionCategory;
	table: string;
	description: string;
	permissions: Map<AppRole, PermissionLevel>;
}

/**
 * Analyze policies and generate the role permission matrix
 */
export function analyzeRolePermissions(policies: RLSPolicy[]): AnalyzedPermission[] {
	return GROUPED_PERMISSIONS.map((permission) => ({
		id: permission.id,
		category: permission.category,
		table: permission.table,
		description: permission.description,
		permissions: permission.checkPolicies(policies),
	}));
}

/**
 * Group analyzed permissions by category
 */
export function groupPermissionsByCategory(
	permissions: AnalyzedPermission[],
): Map<PermissionCategory, AnalyzedPermission[]> {
	const grouped = new Map<PermissionCategory, AnalyzedPermission[]>();

	for (const permission of permissions) {
		const existing = grouped.get(permission.category) || [];
		existing.push(permission);
		grouped.set(permission.category, existing);
	}

	return grouped;
}

/**
 * Get display info for a permission level
 */
export function getPermissionDisplay(level: PermissionLevel): {
	icon: 'check' | 'x' | 'limited';
	color: string;
	label: string;
} {
	switch (level) {
		case 'full':
			return { icon: 'check', color: 'text-green-600 dark:text-green-400', label: 'Ja' };
		case 'own':
			return { icon: 'check', color: 'text-green-600 dark:text-green-400', label: 'Eigen' };
		case 'limited':
			return { icon: 'limited', color: 'text-amber-600 dark:text-amber-400', label: 'Beperkt' };
		case 'none':
			return { icon: 'x', color: 'text-red-600 dark:text-red-400', label: 'Nee' };
	}
}

// Role display names and icons are now in @/lib/role-icons.ts
// Use getRoleDisplayName and getRoleIcon from there
