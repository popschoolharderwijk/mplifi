import { useEffect, useMemo, useState } from 'react';
import { LuLogOut, LuMoon, LuSearch, LuSettings, LuSun } from 'react-icons/lu';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@/components/ThemeProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getBaseBreadcrumb } from '@/config/breadcrumbs';
import { NAV_LABELS } from '@/config/nav-labels';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const quickActions: Array<{ action: string; label: string; group: string }> = [];

export function TopNav() {
	const { user, signOut, isAdmin, isSiteAdmin } = useAuth();
	const { pathname } = useLocation();
	const { suffix } = useBreadcrumb();
	const breadcrumbItems = useMemo(() => [...getBaseBreadcrumb(pathname), ...suffix], [pathname, suffix]);

	// Quick navigation items for command palette (filtered by permissions)
	const quickNavItems = [
		{ href: '/', label: NAV_LABELS.dashboard, group: 'Navigatie' },
		...(isAdmin || isSiteAdmin ? [{ href: '/teachers', label: NAV_LABELS.teachers, group: 'Navigatie' }] : []),
	];
	const { setTheme, resolvedTheme } = useTheme();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [role, setRole] = useState<string | null>(null);
	const [profile, setProfile] = useState<{
		first_name: string | null;
		last_name: string | null;
		avatar_url: string | null;
	} | null>(null);

	useEffect(() => {
		async function fetchRoleAndProfile() {
			if (!user) return;

			const [roleResult, profileResult] = await Promise.all([
				supabase.from('user_roles').select('role').eq('user_id', user.id).single(),
				supabase.from('profiles').select('first_name, last_name, avatar_url').eq('user_id', user.id).single(),
			]);

			if (roleResult.data) {
				setRole(roleResult.data.role);
			}

			if (profileResult.data) {
				setProfile(profileResult.data);
			}
		}

		fetchRoleAndProfile();

		// Listen for profile updates from Settings page
		const handleProfileUpdate = () => {
			fetchRoleAndProfile();
		};

		window.addEventListener('profile-updated', handleProfileUpdate);

		return () => {
			window.removeEventListener('profile-updated', handleProfileUpdate);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user]);

	// Keyboard shortcut for command palette
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((open) => !open);
			}
		};

		document.addEventListener('keydown', down);
		return () => document.removeEventListener('keydown', down);
	}, []);

	const handleSignOut = async () => {
		await signOut();
		navigate('/login');
	};

	const userInitials =
		profile?.first_name && profile?.last_name
			? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
			: profile?.first_name
				? profile.first_name.slice(0, 2).toUpperCase()
				: user?.email?.slice(0, 2).toUpperCase() || 'U';

	return (
		<>
			<header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				{/* Breadcrumbs */}
				{breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} className="min-w-0 shrink-0" />}

				<div className="flex-1" />

				{/* Search / Command Palette Trigger */}
				<Button
					variant="outline"
					className="relative h-9 w-full max-w-sm justify-start text-sm text-muted-foreground shrink-0"
					onClick={() => setOpen(true)}
				>
					<LuSearch className="mr-2 h-4 w-4" />
					<span>Zoeken...</span>
					<kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
						<span className="text-xs">⌘</span>K
					</kbd>
				</Button>

				{/* Theme Toggle */}
				<Button
					variant="ghost"
					size="icon"
					className="h-9 w-9"
					onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
				>
					{resolvedTheme === 'dark' ? <LuMoon className="h-5 w-5" /> : <LuSun className="h-5 w-5" />}
					<span className="sr-only">Toggle theme</span>
				</Button>

				{/* User Menu */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="relative h-9 w-9 rounded-full">
							<Avatar className="h-9 w-9">
								<AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
								<AvatarFallback className="bg-primary text-primary-foreground text-sm">
									{userInitials}
								</AvatarFallback>
							</Avatar>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-56" align="end" forceMount>
						<DropdownMenuLabel className="font-normal">
							<div className="flex flex-col space-y-1">
								<p className="text-sm font-medium leading-none">
									{profile?.first_name && profile?.last_name
										? `${profile.first_name} ${profile.last_name}`
										: profile?.first_name
											? profile.first_name
											: user?.email?.split('@')[0]}
								</p>
								<p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
								{role && (
									<p className="text-xs leading-none text-muted-foreground capitalize mt-0.5">
										{role.replace('_', ' ')}
									</p>
								)}
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => navigate('/settings')}>
							<LuSettings className="mr-2 h-4 w-4" />
							<span>{NAV_LABELS.settings}</span>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleSignOut}>
							<LuLogOut className="mr-2 h-4 w-4" />
							<span>Uitloggen</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</header>

			{/* Command Palette */}
			<CommandDialog open={open} onOpenChange={setOpen}>
				<CommandInput placeholder="Zoek leerlingen, docenten, acties..." />
				<CommandList>
					<CommandEmpty>Geen resultaten gevonden.</CommandEmpty>
					<CommandGroup heading="Navigatie">
						{quickNavItems.map((item) => (
							<CommandItem
								key={item.href}
								onSelect={() => {
									navigate(item.href);
									setOpen(false);
								}}
							>
								{item.label}
							</CommandItem>
						))}
					</CommandGroup>
					{quickActions.length > 0 && (
						<CommandGroup heading="Acties">
							{quickActions.map((item) => (
								<CommandItem
									key={item.action}
									onSelect={() => {
										// Handle actions
										setOpen(false);
									}}
								>
									{item.label}
								</CommandItem>
							))}
						</CommandGroup>
					)}
				</CommandList>
			</CommandDialog>
		</>
	);
}
