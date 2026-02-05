import { useState } from 'react';
import { LuZap } from 'react-icons/lu';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Development-only quick login button.
 * This component is completely removed from production builds via dead-code elimination.
 * Requires VITE_DEV_LOGIN_EMAIL environment variable.
 * If VITE_DEV_LOGIN_PASSWORD is not set, the button is shown but disabled.
 */
export function DevLoginButton({ className }: { className?: string }) {
	// Production check - enables Vite dead code elimination
	// This entire component will be tree-shaken out of production builds
	if (import.meta.env.MODE === 'production') {
		return null;
	}

	const email = import.meta.env.VITE_DEV_LOGIN_EMAIL;
	const password = import.meta.env.VITE_DEV_LOGIN_PASSWORD;

	// Don't render if email is not configured
	if (!email) {
		return null;
	}

	return <DevLoginButtonInner email={email} password={password || ''} className={className} />;
}

/**
 * Inner component to avoid hooks being called conditionally in the outer component.
 */
function DevLoginButtonInner({ email, password, className }: { email: string; password: string; className?: string }) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const hasPassword = !!password;

	const handleDevLogin = async () => {
		// Runtime safety checks
		if (import.meta.env.MODE === 'production') {
			console.error('Dev login attempted in production - this should never happen');
			return;
		}

		if (!hasPassword) {
			return;
		}

		setIsLoading(true);
		setError(null);

		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			setError(error.message);
			setIsLoading(false);
		}
		// Success: onAuthStateChange in AuthProvider will handle redirect
	};

	const MODE = import.meta.env.MODE;
	const isLocalDev = MODE === 'localdev';
	const isDisabled = isLoading || !hasPassword;

	return (
		<div className={cn('flex flex-col items-start gap-1', className)}>
			<button
				type="button"
				onClick={handleDevLogin}
				disabled={isDisabled}
				title={!hasPassword ? 'VITE_DEV_LOGIN_PASSWORD niet geconfigureerd' : undefined}
				className={cn(
					'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
					'focus:outline-none focus:ring-2 focus:ring-ring',
					'disabled:opacity-50 disabled:cursor-not-allowed',
					isLocalDev
						? 'bg-green-500/20 text-green-600 hover:bg-green-500/30 dark:text-green-400'
						: 'bg-orange-500/20 text-orange-600 hover:bg-orange-500/30 dark:text-orange-400',
				)}
			>
				<LuZap className="h-4 w-4" />
				{isLoading ? 'Inloggen...' : 'Dev Login'}
			</button>
			{error && <span className="text-xs text-red-500">{error}</span>}
			{!hasPassword && <span className="text-xs text-muted-foreground">Geen wachtwoord</span>}
		</div>
	);
}
