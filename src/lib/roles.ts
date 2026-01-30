import type { ComponentType } from 'react';
import { LuGraduationCap, LuShieldCheck, LuStar, LuUser, LuUserCog } from 'react-icons/lu';
import type { Database } from '@/integrations/supabase/types';

/** Application role type from Supabase database */
export type AppRole = Database['public']['Enums']['app_role'];

/** All available roles in the system */
export const allRoles: AppRole[] = ['site_admin', 'admin', 'staff', 'teacher'];

/** Role priority for sorting (higher number = higher priority) */
export const rolePriority: Record<AppRole, number> = {
	site_admin: 4,
	admin: 3,
	staff: 2,
	teacher: 1,
};

/** Badge variant type */
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** Role configuration including label, icon, and badge variant */
export interface RoleConfig {
	label: string;
	variant: BadgeVariant;
	icon: ComponentType<{ className?: string }>;
}

/** Role labels, icons and badge variants for display */
export const roleLabels: Record<AppRole, RoleConfig> = {
	site_admin: { label: 'Site Admin', variant: 'destructive', icon: LuStar },
	admin: { label: 'Admin', variant: 'default', icon: LuShieldCheck },
	staff: { label: 'Medewerker', variant: 'secondary', icon: LuUserCog },
	teacher: { label: 'Docent', variant: 'secondary', icon: LuGraduationCap },
};

/**
 * Returns the icon component for a given role
 * @param role - The application role
 * @returns The icon component for the role
 */
export function getIcon(role: AppRole | null): ComponentType<{ className?: string }> {
	if (!role) {
		return LuUser;
	}
	return roleLabels[role].icon;
}
