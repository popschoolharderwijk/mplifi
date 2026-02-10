import { useEffect, useState } from 'react';
import { LuLoaderCircle, LuZap } from 'react-icons/lu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Development-only quick login button with role selection.
 * This component is completely removed from production builds via dead-code elimination.
 * Early return in production ensures all code below is tree-shaken.
 */
export function DevLoginButton({
	className,
	showButton = true,
	autoLogin = false,
}: {
	className?: string;
	showButton?: boolean;
	autoLogin?: boolean;
}) {
	// Production check - enables Vite dead code elimination
	// This entire component will be tree-shaken out of production builds
	// All code below (including imports usage) is eliminated in production
	if (import.meta.env.MODE === 'production') {
		return null;
	}

	return <DevLoginButtonInner className={className} showButton={showButton} autoLogin={autoLogin} />;
}

// Constants defined outside but only used in non-production code
// Vite will tree-shake these in production builds due to the early return above
const STORAGE_KEY = 'dev-login-selected-role';
const STORAGE_KEY_DEV_USER = 'dev-login-selected-dev-user';

type DevLoginRole = 'site_admin' | 'admin' | 'teacher' | 'staff' | 'student' | 'user' | 'dev';

// Dev users with first names
interface DevUser {
	email: string;
	firstName: string;
	description?: string;
}

const DEV_TEACHERS: DevUser[] = [
	{ email: 'teacher-alice@test.nl', firstName: 'Alice', description: 'Veel leerlingen' },
	{ email: 'teacher-jack@test.nl', firstName: 'Jacques', description: 'Geen leerlingen' },
	{ email: 'teacher-eve@test.nl', firstName: 'Eva', description: 'Bandcoaching' },
];

const DEV_STUDENTS: DevUser[] = [
	{ email: 'student-001@test.nl', firstName: 'Lucas', description: 'Met Bandcoaching' },
	{ email: 'student-009@test.nl', firstName: 'Luuk', description: 'Zonder Bandcoaching' },
	{ email: 'student-010@test.nl', firstName: 'Bram', description: 'Zonder Bandcoaching' },
];

const DEV_USERS: DevUser[] = [
	{ email: 'user-001@test.nl', firstName: 'Koen' },
	{ email: 'user-002@test.nl', firstName: 'Rik' },
	{ email: 'user-003@test.nl', firstName: 'Tim' },
];

// Roles with first names
const DEV_ROLES: DevUser[] = [
	{ email: 'site-admin@test.nl', firstName: 'Jan-Willem', description: 'Site Admin' },
	{ email: 'admin-one@test.nl', firstName: 'Sophie', description: 'Admin' },
	{ email: 'staff-one@test.nl', firstName: 'Lisa', description: 'Medewerker' },
];

// Role to email mapping (using first user per role from seed.sql) - for legacy support
const ROLE_EMAILS: Record<Exclude<DevLoginRole, 'dev'>, string> = {
	site_admin: 'site-admin@test.nl',
	admin: 'admin-one@test.nl',
	teacher: 'teacher-alice@test.nl',
	staff: 'staff-one@test.nl',
	student: 'student-001@test.nl',
	user: 'user-001@test.nl',
};

/**
 * Inner component to avoid hooks being called conditionally in the outer component.
 * All code here is only executed in non-production builds due to the parent check.
 */
function DevLoginButtonInner({
	className,
	showButton = true,
	autoLogin = false,
}: {
	className?: string;
	showButton?: boolean;
	autoLogin?: boolean;
}) {
	// Load last selected role from localStorage
	// Combined state: can be a role or a dev user email
	const [selectedValue, setSelectedValue] = useState<string>(() => {
		if (typeof window !== 'undefined') {
			const storedRole = localStorage.getItem(STORAGE_KEY);
			const storedDevUser = localStorage.getItem(STORAGE_KEY_DEV_USER);

			// Check if a dev user is stored
			if (storedDevUser) {
				const allDevEmails = [...DEV_ROLES, ...DEV_TEACHERS, ...DEV_STUDENTS, ...DEV_USERS].map((u) => u.email);
				if (allDevEmails.includes(storedDevUser)) {
					return storedDevUser;
				}
			}

			// Otherwise check for a role (legacy support)
			if (storedRole && (Object.keys(ROLE_EMAILS).includes(storedRole) || storedRole === 'dev')) {
				// Convert legacy role to email if it's a role we now show as a dev user
				if (storedRole === 'site_admin') return 'site-admin@test.nl';
				if (storedRole === 'admin') return 'admin-one@test.nl';
				if (storedRole === 'staff') return 'staff-one@test.nl';
				return storedRole;
			}
		}
		// Default to first item in the list (first role)
		return DEV_ROLES[0]?.email || 'site-admin@test.nl';
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Save selected value to localStorage when it changes
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const allDevEmails = [...DEV_ROLES, ...DEV_TEACHERS, ...DEV_STUDENTS, ...DEV_USERS].map((u) => u.email);
			if (allDevEmails.includes(selectedValue)) {
				// It's a dev user email
				localStorage.setItem(STORAGE_KEY_DEV_USER, selectedValue);
				localStorage.setItem(STORAGE_KEY, 'dev');
			} else {
				// It's a role (legacy support)
				localStorage.setItem(STORAGE_KEY, selectedValue);
				localStorage.removeItem(STORAGE_KEY_DEV_USER);
			}
		}
	}, [selectedValue]);

	const handleDevLogin = async (valueOverride?: string) => {
		// Runtime safety checks
		if (import.meta.env.MODE === 'production') {
			console.error('Dev login attempted in production - this should never happen');
			return;
		}

		setIsLoading(true);
		setError(null);

		const valueToUse = valueOverride || selectedValue;
		let email: string;

		// Check if it's a dev user email
		const allDevEmails = [...DEV_ROLES, ...DEV_TEACHERS, ...DEV_STUDENTS, ...DEV_USERS].map((u) => u.email);
		if (allDevEmails.includes(valueToUse)) {
			email = valueToUse;
		} else if (valueToUse in ROLE_EMAILS) {
			// Legacy role support
			email = ROLE_EMAILS[valueToUse as Exclude<DevLoginRole, 'dev'>];
		} else {
			setError('Selecteer eerst een rol, docent, leerling of user');
			setIsLoading(false);
			return;
		}

		const password = import.meta.env.VITE_DEV_LOGIN_PASSWORD;

		if (!password) {
			setError('VITE_DEV_LOGIN_PASSWORD niet geconfigureerd in environment');
			setIsLoading(false);
			return;
		}

		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			// Provide more helpful error messages
			if (error.message.includes('Invalid login credentials')) {
				setError(`Inloggen mislukt voor ${email}. Controleer VITE_DEV_LOGIN_PASSWORD.`);
			} else {
				setError(`${error.message} (email: ${email})`);
			}
			setIsLoading(false);
		} else if (data?.user) {
			// Login successful
			setIsLoading(false);
		}
		// Success: onAuthStateChange in AuthProvider will handle redirect
	};

	const MODE = import.meta.env.MODE;
	const isLocalDev = MODE === 'localdev';
	const isDisabled = isLoading;

	return (
		<div className={cn('flex flex-col w-full', className)}>
			<div
				className={cn(
					'flex flex-col w-full',
					showButton ? 'gap-1.5 p-2 rounded-md border bg-background' : '',
					showButton &&
						(isLocalDev
							? 'border-green-500/30 dark:border-green-400/30'
							: 'border-orange-500/30 dark:border-orange-400/30'),
				)}
			>
				<Select
					value={selectedValue}
					onValueChange={(value) => {
						setSelectedValue(value);
						if (autoLogin) {
							handleDevLogin(value);
						}
					}}
					disabled={isLoading}
				>
					<SelectTrigger className="h-8 w-full text-xs">
						<div className="flex items-center gap-1.5 w-full">
							{isLoading && <LuLoaderCircle className="h-3 w-3 animate-spin" />}
							<SelectValue />
						</div>
					</SelectTrigger>
					<SelectContent>
						{/* Roles with first names */}
						{DEV_ROLES.map((role) => (
							<SelectItem key={role.email} value={role.email}>
								{role.firstName} ({role.description})
							</SelectItem>
						))}

						{/* Separator */}
						<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
							Docenten
						</div>

						{/* Dev teachers */}
						{DEV_TEACHERS.map((teacher) => (
							<SelectItem key={teacher.email} value={teacher.email}>
								{teacher.firstName} {teacher.description && `(${teacher.description})`}
							</SelectItem>
						))}

						{/* Separator */}
						<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
							Leerlingen
						</div>

						{/* Dev students */}
						{DEV_STUDENTS.map((student) => (
							<SelectItem key={student.email} value={student.email}>
								{student.firstName} {student.description && `(${student.description})`}
							</SelectItem>
						))}

						{/* Separator */}
						<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
							Users (geen rol)
						</div>

						{/* Dev users */}
						{DEV_USERS.map((user) => (
							<SelectItem key={user.email} value={user.email}>
								{user.firstName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{showButton && (
					<button
						type="button"
						onClick={() => handleDevLogin()}
						disabled={isDisabled}
						className={cn(
							'inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
							'focus:outline-none focus:ring-2 focus:ring-ring',
							'disabled:opacity-50 disabled:cursor-not-allowed',
							isLocalDev
								? 'bg-green-500/20 text-green-600 hover:bg-green-500/30 dark:text-green-400'
								: 'bg-orange-500/20 text-orange-600 hover:bg-orange-500/30 dark:text-orange-400',
						)}
					>
						{isLoading ? (
							<LuLoaderCircle className="h-3 w-3 animate-spin" />
						) : (
							<LuZap className="h-3 w-3" />
						)}
						{isLoading ? 'Inloggen...' : 'Dev Login'}
					</button>
				)}
			</div>
			{error && <span className="text-xs text-red-500 mt-1">{error}</span>}
		</div>
	);
}
