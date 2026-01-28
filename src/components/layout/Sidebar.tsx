import { LuChevronLeft, LuGraduationCap, LuLayoutDashboard, LuMusic, LuUsers } from 'react-icons/lu';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Navigation items configuration
const mainNavItems = [
	{ href: '/', label: 'Dashboard', icon: LuLayoutDashboard },
	{ href: '/students', label: 'Leerlingen', icon: LuUsers },
	{ href: '/teachers', label: 'Docenten', icon: LuGraduationCap },
];

interface SidebarProps {
	collapsed?: boolean;
	onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
	return (
		<TooltipProvider delayDuration={0}>
			<aside
				className={cn(
					'relative flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
					collapsed ? 'w-16' : 'w-64',
				)}
			>
				{/* Logo section */}
				<div
					className={cn(
						'flex h-16 items-center border-b border-sidebar-border',
						collapsed ? 'justify-center px-0' : 'gap-2 px-4',
					)}
				>
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<LuMusic className="h-5 w-5" />
					</div>
					{!collapsed && (
						<div className="flex flex-col">
							<span className="text-lg font-bold leading-tight">
								<span className="text-primary uppercase">POP</span>
								<span className="text-sidebar-foreground lowercase">school</span>
							</span>
							<span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-tight mt-0.5">
								HARDERWIJK
							</span>
						</div>
					)}
					{!collapsed && (
						<Button
							variant="ghost"
							size="icon"
							className="ml-auto h-8 w-8 text-muted-foreground hover:text-foreground"
							onClick={onToggle}
						>
							<LuChevronLeft className="h-4 w-4 transition-transform" />
						</Button>
					)}
					{collapsed && (
						<Button
							variant="ghost"
							size="icon"
							className="absolute right-2 top-4 h-8 w-8 text-muted-foreground hover:text-foreground"
							onClick={onToggle}
						>
							<LuChevronLeft className="h-4 w-4 rotate-180 transition-transform" />
						</Button>
					)}
				</div>

				{/* Navigation */}
				<div className={cn('flex-1 overflow-auto py-4', collapsed ? 'px-0' : 'px-2')}>
					<nav className={cn('flex flex-col gap-1', collapsed && 'items-center')}>
						{mainNavItems.map((item) => (
							<NavItem key={item.href} {...item} collapsed={collapsed} />
						))}
					</nav>
				</div>
			</aside>
		</TooltipProvider>
	);
}

interface NavItemProps {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	collapsed: boolean;
}

function NavItem({ href, label, icon: Icon, collapsed }: NavItemProps) {
	const navLink = (
		<NavLink
			to={href}
			className={({ isActive }) =>
				cn(
					// Base styles
					'flex h-10 items-center rounded-lg text-sm font-medium whitespace-nowrap',
					// Transition for smooth hover/active effects
					'transition-colors duration-150 ease-in-out',
					// Default state
					'text-sidebar-foreground',
					// Hover state - only when not active
					!isActive && 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
					// Active/selected state
					isActive && ['bg-primary text-primary-foreground', 'shadow-sm', 'hover:bg-primary/90'],
					// Expanded state
					!collapsed && 'gap-3 px-3',
					// Collapsed state - center icon in available space
					collapsed && 'w-10 justify-center',
				)
			}
		>
			<Icon className="h-5 w-5 shrink-0" />
			{!collapsed && <span className="truncate">{label}</span>}
		</NavLink>
	);

	if (collapsed) {
		return (
			<Tooltip delayDuration={0}>
				<TooltipTrigger asChild>{navLink}</TooltipTrigger>
				<TooltipContent side="right">{label}</TooltipContent>
			</Tooltip>
		);
	}

	return navLink;
}
