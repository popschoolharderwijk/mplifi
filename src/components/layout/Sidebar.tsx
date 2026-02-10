import {
	LuChevronLeft,
	LuGraduationCap,
	LuLayoutDashboard,
	LuMusic,
	LuMusic2,
	LuShieldCheck,
	LuUserCog,
	LuUsers,
} from 'react-icons/lu';
import { NavLink } from 'react-router-dom';
import { DevTools } from '@/components/DevTools';
import { Button } from '@/components/ui/button';
import { EnvironmentBadge } from '@/components/ui/environment-badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// Navigation items configuration
const mainNavItems = [{ href: '/', label: 'Dashboard', icon: LuLayoutDashboard }];

// Admin-only navigation items
const adminNavItems = [
	{ href: '/users', label: 'Gebruikers', icon: LuUserCog },
	{ href: '/lesson-types', label: 'Lessoorten', icon: LuMusic2 },
];

interface SidebarProps {
	collapsed?: boolean;
	onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
	const { isAdmin, isSiteAdmin, isStaff, isTeacher } = useAuth();
	const showAdminNav = isAdmin || isSiteAdmin;
	const showTeachersNav = isAdmin || isSiteAdmin || isTeacher;
	const showStudentsNav = isAdmin || isSiteAdmin || isStaff;

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
						{/* Main navigation items */}
						{mainNavItems.map((item) => (
							<NavItem key={item.href} {...item} collapsed={collapsed} />
						))}

						{/* Teachers section */}
						{showTeachersNav && (
							<>
								{!collapsed && (
									<div className="mt-4 mb-2 px-3">
										<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											<LuGraduationCap className="h-3.5 w-3.5" />
											<span>Docenten</span>
										</div>
									</div>
								)}
								{collapsed && <Separator className="my-2" />}
								<NavItem
									href="/teachers"
									label="Docenten"
									icon={LuGraduationCap}
									collapsed={collapsed}
								/>
								{isTeacher && (
									<NavItem
										href="/students/my-students"
										label="Mijn Leerlingen"
										icon={LuUsers}
										collapsed={collapsed}
									/>
								)}
							</>
						)}

						{/* Students section */}
						{showStudentsNav && (
							<>
								{!collapsed && (
									<div className="mt-4 mb-2 px-3">
										<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											<LuUsers className="h-3.5 w-3.5" />
											<span>Leerlingen</span>
										</div>
									</div>
								)}
								{collapsed && <Separator className="my-2" />}
								<NavItem href="/students" label="Leerlingen" icon={LuUsers} collapsed={collapsed} />
							</>
						)}

						{/* Admin section */}
						{showAdminNav && (
							<>
								{!collapsed && (
									<div className="mt-4 mb-2 px-3">
										<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											<LuShieldCheck className="h-3.5 w-3.5" />
											<span>Beheer</span>
										</div>
									</div>
								)}
								{collapsed && <Separator className="my-2" />}
								{adminNavItems.map((item) => (
									<NavItem key={item.href} {...item} collapsed={collapsed} />
								))}
							</>
						)}
					</nav>
				</div>

				{/* Development tools */}
				<div
					className={cn(
						'border-t border-sidebar-border',
						collapsed ? 'flex justify-center p-2' : 'p-2 w-full',
					)}
				>
					{!collapsed && <DevTools className="w-full" />}
					{collapsed && <EnvironmentBadge />}
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
