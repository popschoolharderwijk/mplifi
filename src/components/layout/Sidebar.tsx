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
import { DevTools } from '@/components/DevTools';
import { NavItem } from '@/components/layout/NavItem';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NAV_LABELS } from '@/config/nav-labels';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// Single value for all vertical spacing between nav items (padding + gap)
const NAV_GAP = '1rem';

// Main nav items (labels from central config)
const mainNavItems = [{ href: '/', label: NAV_LABELS.dashboard, icon: LuLayoutDashboard }];

// Admin-only navigation items
const adminNavItems = [
	{ href: '/users', label: NAV_LABELS.users, icon: LuUserCog },
	{ href: '/lesson-types', label: NAV_LABELS.lessonTypes, icon: LuMusic2 },
];

interface SidebarProps {
	collapsed?: boolean;
	onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
	const { isAdmin, isSiteAdmin, isStaff, isTeacher } = useAuth();
	const showAdminNav = isAdmin || isSiteAdmin;
	const showTeachersNav = isAdmin || isSiteAdmin;
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
				<div
					className="flex-1 w-full px-2"
					style={{ paddingTop: NAV_GAP, paddingBottom: NAV_GAP } as React.CSSProperties}
				>
					<nav
						className="flex flex-col w-full"
						style={{ gap: NAV_GAP } as React.CSSProperties}
					>
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
											<span>{NAV_LABELS.teachers}</span>
										</div>
									</div>
								)}
								{collapsed && <Separator />}
								<NavItem
									href="/teachers"
									label={NAV_LABELS.teachers}
									icon={LuGraduationCap}
									collapsed={collapsed}
								/>
							</>
						)}

						{/* Teacher-specific navigation */}
						{isTeacher && !showTeachersNav && (
							<>
								{!collapsed && (
									<div className="mt-4 mb-2 px-3">
										<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											<LuUsers className="h-3.5 w-3.5" />
											<span>Mijn Overzicht</span>
										</div>
									</div>
								)}
								{collapsed && <Separator />}
								<NavItem
									href="/students/my-students"
									label={NAV_LABELS.myStudents}
									icon={LuUsers}
									collapsed={collapsed}
								/>
							</>
						)}

						{/* Students section */}
						{showStudentsNav && (
							<>
								{!collapsed && (
									<div className="mt-4 mb-2 px-3">
										<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											<LuUsers className="h-3.5 w-3.5" />
											<span>{NAV_LABELS.students}</span>
										</div>
									</div>
								)}
								{collapsed && <Separator />}
								<NavItem
									href="/students"
									label={NAV_LABELS.students}
									icon={LuUsers}
									collapsed={collapsed}
								/>
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
								{collapsed && <Separator />}
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
					<DevTools className={collapsed ? undefined : 'w-full'} collapsed={collapsed} />
				</div>
			</aside>
		</TooltipProvider>
	);
}
