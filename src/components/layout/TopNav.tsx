import { useEffect, useState } from 'react';
import { LuLogOut, LuMoon, LuSearch, LuSettings, LuSun } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/components/ThemeProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Quick navigation items for command palette
const quickNavItems = [
	{ href: '/', label: 'Dashboard', group: 'Navigatie' },
	{ href: '/students', label: 'Leerlingen', group: 'Navigatie' },
	{ href: '/teachers', label: 'Docenten', group: 'Navigatie' },
];

const quickActions = [{ action: 'new-student', label: 'Nieuwe leerling toevoegen', group: 'Acties' }];

export function TopNav() {
	const { user, signOut } = useAuth();
	const { setTheme, resolvedTheme } = useTheme();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [role, setRole] = useState<string | null>(null);
	const [profile, setProfile] = useState<{ firstname: string | null; lastname: string | null } | null>(null);

	useEffect(() => {
		async function fetchRoleAndProfile() {
			if (!user) return;

			const [roleResult, profileResult] = await Promise.all([
				supabase.from('user_roles').select('role').eq('user_id', user.id).single(),
				supabase.from('profiles').select('firstname, lastname').eq('user_id', user.id).single(),
			]);

			if (roleResult.data) {
				setRole(roleResult.data.role);
			}

			if (profileResult.data) {
				setProfile(profileResult.data);
			}
		}

		fetchRoleAndProfile();
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
		profile?.firstname && profile?.lastname
			? `${profile.firstname[0]}${profile.lastname[0]}`.toUpperCase()
			: profile?.firstname
				? profile.firstname.slice(0, 2).toUpperCase()
				: user?.email?.slice(0, 2).toUpperCase() || 'U';

	return (
		<>
			<header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				{/* Search / Command Palette Trigger */}
				<Button
					variant="outline"
					className="relative h-9 w-full max-w-sm justify-start text-sm text-muted-foreground"
					onClick={() => setOpen(true)}
				>
					<LuSearch className="mr-2 h-4 w-4" />
					<span>Zoeken...</span>
					<kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
						<span className="text-xs">⌘</span>K
					</kbd>
				</Button>

				<div className="flex-1" />

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
									{profile?.firstname && profile?.lastname
										? `${profile.firstname} ${profile.lastname}`
										: profile?.firstname
											? profile.firstname
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
							<span>Instellingen</span>
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
				</CommandList>
			</CommandDialog>
		</>
	);
}
