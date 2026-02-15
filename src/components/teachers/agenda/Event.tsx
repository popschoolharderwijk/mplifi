import { LuBan, LuRepeat, LuTriangleAlert } from 'react-icons/lu';
import { displayTimeFromDate } from '@/lib/dateHelpers';
import { useCalendarView } from './CalendarViewContext';
import type { CalendarEvent } from './types';

interface AgendaEventProps {
	event: CalendarEvent;
	title: React.ReactNode;
}

export function AgendaEvent({ event, title }: AgendaEventProps) {
	const view = useCalendarView();
	const { isDeviation, isCancelled, isRecurring } = event.resource;

	const displayTitle = view === 'month' && event.start ? `${displayTimeFromDate(event.start)} ${title}` : title;

	return (
		<div className="h-full w-full overflow-hidden">
			{/* Recurring icon top-right inside bounds so selection ring matches event size */}
			{isRecurring && (
				<LuRepeat
					className="absolute bottom-0.5 right-0.5 h-3 w-3 text-white drop-shadow-md z-10 shrink-0"
					title="Afwijkende reeks"
					aria-hidden
				/>
			)}
			{isCancelled && (
				<LuBan className={`absolute h-3 w-3 text-white drop-shadow-md z-10 shrink-0 top-0.5 right-0.5`} />
			)}
			{isDeviation && !isCancelled && (
				<LuTriangleAlert
					className={`absolute h-3 w-3 text-white drop-shadow-md z-10 shrink-0 top-0.5 right-0.5`}
				/>
			)}
			<span
				className={`block text-xs leading-tight overflow-hidden text-ellipsis pr-4 ${isCancelled ? 'line-through' : ''}`}
			>
				{displayTitle}
			</span>
		</div>
	);
}
