import { LuChevronLeft, LuMusic, LuShieldCheck } from 'react-icons/lu';
import { DevTools } from '@/components/DevTools';
import { NavItem } from '@/components/layout/NavItem';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NAV_ICONS, NAV_LABELS } from '@/config/nav-labels';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// Single value for all vertical spacing between nav items (padding + gap)
const NAV_GAP = '1rem';

// Main nav items (for all authenticated users)
const mainNavItems = [
	{ href: '/', label: NAV_LABELS.dashboard, icon: NAV_ICONS.dashboard },
	{ href: '/agenda', label: NAV_LABELS.agenda, icon: NAV_ICONS.agenda },
];

// Admin-only navigation items
const adminNavItems = [
	{ href: '/users', label: NAV_LABELS.users, icon: NAV_ICONS.users },
	{ href: '/lesson-types', label: NAV_LABELS.lessonTypes, icon: NAV_ICONS.lessonTypes },
	{ href: '/agreements', label: NAV_LABELS.agreements, icon: NAV_ICONS.agreements },
	{ href: '/manual', label: NAV_LABELS.manual, icon: NAV_ICONS.manual },
];

interface SidebarProps {
	collapsed?: boolean;
	onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
	const { isAdmin, isSiteAdmin, isPrivileged, isTeacher } = useAuth();
	const showAdminNav = isAdmin || isSiteAdmin;
	const showTeachersNav = isAdmin || isSiteAdmin;
	const showStudentsNav = isPrivileged;
	const showReportsNav = isPrivileged || isTeacher;

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

				{/* Navigation – scrollable when content exceeds height */}
				<div className="flex-1 min-h-0 w-full overflow-hidden">
					<ScrollArea className="h-full">
						<div
							className="w-full px-2"
							style={{ paddingTop: NAV_GAP, paddingBottom: NAV_GAP } as React.CSSProperties}
						>
							<nav className="flex flex-col w-full" style={{ gap: NAV_GAP } as React.CSSProperties}>
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
													<NAV_ICONS.teachers className="h-3.5 w-3.5" />
													<span>{NAV_LABELS.teachers}</span>
												</div>
											</div>
										)}
										{collapsed && <Separator />}
										<NavItem
											href="/teachers"
											label={NAV_LABELS.teachers}
											icon={NAV_ICONS.teachers}
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
													<NAV_ICONS.myStudents className="h-3.5 w-3.5" />
													<span>Mijn Overzicht</span>
												</div>
											</div>
										)}
										{collapsed && <Separator />}
										<NavItem
											href="/students/my-students"
											label={NAV_LABELS.myStudents}
											icon={NAV_ICONS.myStudents}
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
													<NAV_ICONS.students className="h-3.5 w-3.5" />
													<span>{NAV_LABELS.students}</span>
												</div>
											</div>
										)}
										{collapsed && <Separator />}
										<NavItem
											href="/students"
											label={NAV_LABELS.students}
											icon={NAV_ICONS.students}
											collapsed={collapsed}
										/>
									</>
								)}

								{/* Reports section */}
								{showReportsNav && (
									<>
										{collapsed && <Separator />}
										<NavItem
											href="/reports"
											label={NAV_LABELS.reports}
											icon={NAV_ICONS.reports}
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
					</ScrollArea>
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
