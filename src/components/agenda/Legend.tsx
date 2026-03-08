import { LuBan, LuMusic, LuRepeat, LuTriangleAlert } from 'react-icons/lu';

interface LegendProps {
	show: boolean;
}

export function Legend({ show }: LegendProps) {
	if (!show) return null;

	return (
		<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
			<div className="flex items-center gap-2">
				<LuMusic className="h-4 w-4 shrink-0" />
				<span>Les</span>
			</div>
			<div className="flex items-center gap-2">
				<LuRepeat className="h-4 w-4 shrink-0" />
				<span>Terugkerende afspraak</span>
			</div>
			<div className="flex items-center gap-2">
				<LuTriangleAlert className="h-4 w-4 shrink-0" />
				<span>Afwijkende afspraak</span>
			</div>
			<div className="flex items-center gap-2">
				<LuBan className="h-4 w-4 shrink-0" />
				<span>Vervallen afspraak</span>
			</div>
		</div>
	);
}
