import type { AppRole } from '@/lib/roles';
import type { User } from '@/types/users';

/** Filter for user list: base presets or a Supabase app_role (user_roles.role). */
export type UserFilter = 'all' | 'students' | 'teachers' | AppRole;

/** Shared props for UserSelectSingle and UserSelectMultiple */
export interface UserSelectBaseProps {
	filter?: UserFilter;
	excludeUserIds?: string[];
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export interface UserSelectSingleProps extends UserSelectBaseProps {
	value: string | null;
	onChange: (user: User | null) => void;
}

export interface UserSelectMultipleProps extends UserSelectBaseProps {
	value: string[];
	onChange: (users: User[]) => void;
	/** Maximum number of users that can be selected. When reached, adding more shows a toast. */
	max?: number;
}
