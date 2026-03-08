import type { ToolbarProps, View } from 'react-big-calendar';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

const NAVIGATE = { PREVIOUS: 'PREV', NEXT: 'NEXT', TODAY: 'TODAY' } as const;

const VIEW_LABELS: Partial<Record<View, string>> = {
	month: 'Maand',
	week: 'Week',
	day: 'Dag',
	agenda: 'Agenda',
};

function viewsToArray(views: ToolbarProps['views']): View[] {
	if (Array.isArray(views)) return views;
	return (Object.keys(views) as View[]).filter((k) => views[k as keyof typeof views]);
}

/** Custom toolbar: same layout and classes as default, but view selector is a dropdown. */
export function CalendarToolbar({ label, view, views, onNavigate, onView, localizer }: ToolbarProps) {
	const messages = localizer.messages ?? {};
	const viewOptions = viewsToArray(views).filter((v) => v in VIEW_LABELS);

	return (
		<div className="rbc-toolbar">
			<span className="rbc-btn-group rbc-nav-group">
				<button type="button" onClick={() => onNavigate(NAVIGATE.TODAY)}>
					{messages.today ?? 'Vandaag'}
				</button>
				<button
					type="button"
					className="rbc-nav-prev"
					onClick={() => onNavigate(NAVIGATE.PREVIOUS)}
					aria-label={String(messages.previous ?? 'Vorige')}
				>
					<LuChevronLeft className="h-5 w-5" />
				</button>
				<button
					type="button"
					className="rbc-nav-next"
					onClick={() => onNavigate(NAVIGATE.NEXT)}
					aria-label={String(messages.next ?? 'Volgende')}
				>
					<LuChevronRight className="h-5 w-5" />
				</button>
				<span className="rbc-toolbar-label">{label}</span>
			</span>
			<span className="rbc-btn-group">
				{viewOptions.length > 1 ? (
					<select
						value={view}
						onChange={(e) => onView(e.target.value as View)}
						className="h-8 min-w-[5rem] cursor-pointer rounded border border-input bg-background pl-2 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						aria-label="Weergave"
					>
						{viewOptions.map((v) => (
							<option key={v} value={v}>
								{VIEW_LABELS[v] ?? messages[v] ?? v}
							</option>
						))}
					</select>
				) : null}
			</span>
		</div>
	);
}
