import { Badge } from '@/components/ui/badge';
import { type AppRole, roleLabels } from '@/lib/roles';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
	role: AppRole | null;
	className?: string;
}

/**
 * A badge component that displays a role with its icon and label.
 * Shows "Geen rol" for null roles.
 */
export function RoleBadge({ role, className }: RoleBadgeProps) {
	if (!role) {
		return (
			<Badge variant="outline" className={cn('gap-1', className)}>
				Geen rol
			</Badge>
		);
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
