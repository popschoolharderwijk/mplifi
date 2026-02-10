import { useEffect, useState } from 'react';
import { LuZap } from 'react-icons/lu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Development-only quick login button with role selection.
 * This component is completely removed from production builds via dead-code elimination.
 * Early return in production ensures all code below is tree-shaken.
 */
export function DevLoginButton({ className }: { className?: string }) {
	// Production check - enables Vite dead code elimination
	// This entire component will be tree-shaken out of production builds
	// All code below (including imports usage) is eliminated in production
	if (import.meta.env.MODE === 'production') {
		return null;
	}

	return <DevLoginButtonInner className={className} />;
}

// Constants defined outside but only used in non-production code
// Vite will tree-shake these in production builds due to the early return above
const STORAGE_KEY = 'dev-login-selected-role';

type DevLoginRole = 'site_admin' | 'admin' | 'teacher' | 'staff' | 'student' | 'user';

// Role to email mapping (using first user per role from seed.sql)
const ROLE_EMAILS: Record<DevLoginRole, string> = {
	site_admin: 'site-admin@test.nl',
	admin: 'admin-one@test.nl',
	teacher: 'teacher-alice@test.nl',
	staff: 'staff-one@test.nl',
	student: 'student-001@test.nl',
	user: 'user-001@test.nl',
};

// Role display names in Dutch
const ROLE_LABELS: Record<DevLoginRole, string> = {
	site_admin: 'Site Admin',
	admin: 'Admin',
	teacher: 'Docent',
	staff: 'Medewerker',
	student: 'Leerling',
	user: 'User (geen rol)',
};

/**
 * Inner component to avoid hooks being called conditionally in the outer component.
 * All code here is only executed in non-production builds due to the parent check.
 */
function DevLoginButtonInner({ className }: { className?: string }) {
	// Load last selected role from localStorage
	const [selectedRole, setSelectedRole] = useState<DevLoginRole>(() => {
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored && Object.keys(ROLE_EMAILS).includes(stored)) {
				return stored as DevLoginRole;
			}
		}
		return 'site_admin';
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Save selected role to localStorage when it changes
	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, selectedRole);
		}
	}, [selectedRole]);

	const handleDevLogin = async () => {
		// Runtime safety checks
		if (import.meta.env.MODE === 'production') {
			console.error('Dev login attempted in production - this should never happen');
			return;
		}

		setIsLoading(true);
		setError(null);

		const email = ROLE_EMAILS[selectedRole];
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
					'flex flex-col gap-1.5 rounded-md border p-2 w-full',
					'bg-background',
					isLocalDev
						? 'border-green-500/30 dark:border-green-400/30'
						: 'border-orange-500/30 dark:border-orange-400/30',
				)}
			>
				<Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as DevLoginRole)}>
					<SelectTrigger className="h-8 w-full text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(ROLE_LABELS).map(([role, label]) => (
							<SelectItem key={role} value={role}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<button
					type="button"
					onClick={handleDevLogin}
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
					<LuZap className="h-3 w-3" />
					{isLoading ? 'Inloggen...' : 'Dev Login'}
				</button>
			</div>
			{error && <span className="text-xs text-red-500 mt-1">{error}</span>}
		</div>
	);
}
