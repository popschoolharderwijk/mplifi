import { LuBug } from 'react-icons/lu';
import { DevLoginButton } from '@/components/DevLoginButton';
import { EnvironmentBadge } from '@/components/ui/environment-badge';
import { cn } from '@/lib/utils';

/**
 * Development tools component.
 * Contains dev login and environment badge.
 * This component is completely removed from production builds via dead-code elimination.
 */
export function DevTools({ className }: { className?: string }) {
	// Production check - enables Vite dead code elimination
	// This entire component will be tree-shaken out of production builds
	if (import.meta.env.MODE === 'production') {
		return null;
	}

	const MODE = import.meta.env.MODE;
	const isLocalDev = MODE === 'localdev';

	return (
		<div className={cn('flex flex-col gap-2 w-[180px]', className)}>
			{/* Development tools header */}
			<div
				className={cn(
					'flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider w-full h-[28px]',
					isLocalDev
						? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
						: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
				)}
			>
				<LuBug className="h-3 w-3" />
				<span>Dev Tools</span>
			</div>
			<div
				className={cn(
					'flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium w-full h-[28px] border',
					isLocalDev
						? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/20'
						: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/20',
				)}
			>
				<EnvironmentBadge className="flex items-center gap-1 text-inherit" />
			</div>
			<DevLoginButton className="w-full" />
		</div>
	);
}
