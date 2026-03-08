import { LuRotateCcw } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import type { DeviationInfo } from '@/types/agenda-events';

interface DeviationInfoBannerProps {
	deviationInfo: DeviationInfo;
	onRevert: () => void;
	disabled?: boolean;
	reverting?: boolean;
}

export function DeviationInfoBanner({ deviationInfo, onRevert, disabled, reverting }: DeviationInfoBannerProps) {
	const isCancelled = deviationInfo.isCancelled;

	return (
		<div
			className={`flex items-center justify-between gap-3 rounded-lg p-3 text-sm ${
				isCancelled
					? 'bg-red-500/10 text-red-600 dark:text-red-400'
					: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
			}`}
		>
			<div>
				<p className="font-medium">{isCancelled ? 'Afspraak vervallen' : 'Afwijkende afspraak'}</p>
				<p className="text-xs mt-1">
					Origineel: {deviationInfo.originalDate} om {deviationInfo.originalStartTime.substring(0, 5)}
				</p>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={
					isCancelled
						? 'text-red-600 hover:text-red-700 hover:bg-red-500/20 dark:text-red-400 dark:hover:text-red-300'
						: 'text-amber-600 hover:text-amber-700 hover:bg-amber-500/20 dark:text-amber-400 dark:hover:text-amber-300'
				}
				onClick={onRevert}
				disabled={disabled || reverting}
			>
				<LuRotateCcw className="h-4 w-4 mr-1" />
				{reverting ? 'Terugzetten...' : 'Terugzetten'}
			</Button>
		</div>
	);
}
