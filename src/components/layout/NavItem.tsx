import { NavLink } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NavItemProps {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	collapsed: boolean;
}

export function NavItem({ href, label, icon: Icon, collapsed }: NavItemProps) {
	const link = (
		<NavLink
			to={href}
			className={({ isActive }) =>
				cn(
					'flex items-center rounded-lg text-sm font-medium',
					'transition-colors duration-150 ease-in-out',
					collapsed && 'w-fit justify-center',
					isActive
						? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
						: 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
				)
			}
		>
			<span className="grid size-10 shrink-0 place-items-center">
				<Icon className="h-5 w-5" />
			</span>
			{!collapsed && <span className="truncate leading-none">{label}</span>}
		</NavLink>
	);

	if (collapsed) {
		return (
			<div className="flex justify-center w-full">
				<Tooltip delayDuration={0}>
					<TooltipTrigger asChild>
						<div className="flex justify-center w-full">{link}</div>
					</TooltipTrigger>
					<TooltipContent side="right">{label}</TooltipContent>
				</Tooltip>
			</div>
		);
	}

	return link;
}
