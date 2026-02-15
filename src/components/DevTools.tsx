import { LuBug } from 'react-icons/lu';
import { DevLoginButton } from '@/components/DevLoginButton';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EnvironmentBadge } from '@/components/ui/environment-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const isLocalDev = () => import.meta.env.MODE === 'localdev';

function DevToolsContent() {
	return (
		<>
			<div
				className={cn(
					'flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider w-full h-[28px]',
					isLocalDev()
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
					isLocalDev()
						? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/20'
						: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/20',
				)}
			>
				<EnvironmentBadge className="flex items-center gap-1 text-inherit" />
			</div>
			<DevLoginButton className="w-full" showButton={true} autoLogin={true} />
		</>
	);
}

/**
 * Development tools component.
 * Contains dev login and environment badge.
 * When collapsed=true shows a single icon that opens a dropdown (voor ingeklapt sidebar).
 * This component is completely removed from production builds via dead-code elimination.
 */
export function DevTools({ className, collapsed }: { className?: string; collapsed?: boolean }) {
	if (import.meta.env.MODE === 'production') {
		return collapsed ? (
			<div className="flex justify-center">
				<EnvironmentBadge className="text-[10px]" />
			</div>
		) : null;
	}

	if (collapsed) {
		return (
			<TooltipProvider delayDuration={0}>
				<DropdownMenu>
					<Tooltip>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-10 w-10 shrink-0 mx-auto text-muted-foreground hover:text-foreground"
									aria-label="Dev Tools"
								>
									<LuBug className="h-5 w-5" />
								</Button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<TooltipContent side="right">Dev Tools</TooltipContent>
					</Tooltip>
					<DropdownMenuContent side="right" align="end" className="w-[200px] p-2">
						<div className="flex flex-col gap-2">
							<DevToolsContent />
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			</TooltipProvider>
		);
	}

	return (
		<div className={cn('flex flex-col gap-2 w-[180px]', className)}>
			<DevToolsContent />
		</div>
	);
}
