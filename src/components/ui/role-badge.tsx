import { Badge } from '@/components/ui/badge';
import { type AppRole, roleLabels } from '@/lib/roles';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
	role: AppRole | null;
	className?: string;
}

/**
 * A badge component that displays a role with its icon and label.
 * Returns null for null roles (no badge displayed).
 */
export function RoleBadge({ role, className }: RoleBadgeProps) {
	if (!role) {
		return null;
	}

	const config = roleLabels[role];
	const Icon = config.icon;

	return (
		<Badge variant={config.variant} className={cn('gap-1', className)}>
			<Icon className="h-3 w-3" />
			{config.label}
		</Badge>
	);
}
