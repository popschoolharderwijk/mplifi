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

/** Role labels and badge variants for display */
export const roleLabels: Record<
	AppRole,
	{ label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
	site_admin: { label: 'Site Admin', variant: 'destructive' },
	admin: { label: 'Admin', variant: 'default' },
	staff: { label: 'Medewerker', variant: 'secondary' },
	teacher: { label: 'Docent', variant: 'secondary' },
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

	switch (role) {
		case 'site_admin':
			return LuStar;
		case 'admin':
			return LuShieldCheck;
		case 'staff':
			return LuUserCog;
		case 'teacher':
			return LuGraduationCap;
		default:
			return LuUser;
	}
}
