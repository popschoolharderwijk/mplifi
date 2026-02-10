import { LuDatabase } from 'react-icons/lu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const MODE = import.meta.env.MODE;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const ENV_CONFIG: Record<string, { label: string; color: string }> = {
	localdev: { label: 'LOCAL DEV', color: 'bg-green-500/20 text-green-600 dark:text-green-400' },
	development: { label: 'REMOTE DEV', color: 'bg-orange-500/20 text-orange-600 dark:text-orange-400' },
	production: { label: 'PRODUCTION', color: 'bg-red-500/20 text-red-600 dark:text-red-400' },
};

export function EnvironmentBadge({ className }: { className?: string }) {
	// FIXME: Remove from production
	//if (MODE === 'production') return null;

	const config = ENV_CONFIG[MODE] || { label: MODE.toUpperCase(), color: 'bg-gray-500/20 text-gray-600' };

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						className={cn(
							'flex items-center gap-1 rounded-md px-0 py-0 text-xs font-medium cursor-help',
							config.color,
							className,
						)}
					>
						<LuDatabase className="h-3 w-3" />
						{config.label}
					</span>
				</TooltipTrigger>
				<TooltipContent>
					<div className="text-xs">
						<div className="font-medium">Omgeving: {config.label}</div>
						<div className="text-muted-foreground font-mono text-[10px] mt-1">{SUPABASE_URL}</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
