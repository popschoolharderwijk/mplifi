interface LegendProps {
	show: boolean;
}

export function Legend({ show }: LegendProps) {
	if (!show) return null;

	return (
		<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
			<div className="flex items-center gap-2">
				<div className="h-4 w-4 rounded border border-l-4 border-emerald-600 bg-emerald-500" />
				<span>Individuele les</span>
			</div>
			<div className="flex items-center gap-2">
				<div className="h-4 w-4 rounded border border-l-4 border-indigo-600 bg-indigo-500" />
				<span>Groepsles</span>
			</div>
			<div className="flex items-center gap-2">
				<div className="h-4 w-4 rounded border border-l-4 border-amber-600 bg-amber-500" />
				<span>⚠ Afwijkende afspraak</span>
			</div>
			<div className="flex items-center gap-2">
				<div className="h-4 w-4 rounded border border-l-4 border-red-600 bg-red-500 opacity-50" />
				<span>❌ Vervallen les</span>
			</div>
		</div>
	);
}
