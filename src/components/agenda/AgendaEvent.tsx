import { LuBan, LuMusic, LuRepeat, LuTriangleAlert, LuUsers } from 'react-icons/lu';
import { isLightColor } from '@/lib/color/color-utils';
import { formatTimeFromDate } from '@/lib/time/time-format';
import { useCalendarView } from './CalendarViewContext';
import type { CalendarEvent } from './types';

interface AgendaEventProps {
	event: CalendarEvent;
	title: React.ReactNode;
}

export function AgendaEvent({ event, title }: AgendaEventProps) {
	const view = useCalendarView();
	const {
		hasTimeOrDateChange,
		isCancelled,
		isRecurring,
		participantCount,
		color,
		lessonTypeColor,
		isLesson,
		sourceType,
	} = event.resource;
	const hasMultipleParticipants = (participantCount ?? 0) > 1;
	const isLessonEvent = isLesson || sourceType === 'lesson_agreement';

	const displayTitle = view === 'month' && event.start ? `${formatTimeFromDate(event.start)} ${title}` : title;

	const effectiveColor = color || lessonTypeColor || '#3b82f6';
	const iconColorClass = isLightColor(effectiveColor) ? 'text-gray-900' : 'text-white';

	const durationMinutes =
		event.start && event.end ? Math.round((event.end.getTime() - event.start.getTime()) / 60000) : 30;
	const lineClampClass =
		durationMinutes <= 30
			? 'line-clamp-1'
			: durationMinutes <= 45
				? 'line-clamp-2'
				: durationMinutes <= 60
					? 'line-clamp-3'
					: 'line-clamp-4';

	return (
		<div className="h-full w-full overflow-hidden">
			{isRecurring && (
				<LuRepeat
					className={`absolute bottom-0.5 right-0.5 h-3 w-3 ${iconColorClass} drop-shadow-md z-10 shrink-0`}
					title="Terugkerende afspraak"
					aria-hidden
				/>
			)}
			{isCancelled && (
				<LuBan
					className={`absolute h-3 w-3 ${iconColorClass} drop-shadow-md z-10 shrink-0 top-0.5 right-0.5`}
				/>
			)}
			{hasTimeOrDateChange && !isCancelled && (
				<LuTriangleAlert
					className={`absolute h-3 w-3 ${iconColorClass} drop-shadow-md z-10 shrink-0 top-0.5 right-0.5`}
					title="Gewijzigde afspraak"
				/>
			)}
			<span className="flex items-start gap-1 text-xs leading-tight overflow-hidden pr-4 min-h-0">
				{isLessonEvent && (
					<LuMusic
						className={`h-3 w-3 shrink-0 mt-0.5 ${iconColorClass} drop-shadow-md`}
						title="Les"
						aria-hidden
					/>
				)}
				{!isLessonEvent && hasMultipleParticipants && (
					<LuUsers
						className={`h-3 w-3 shrink-0 mt-0.5 ${iconColorClass} drop-shadow-md`}
						title="Meerdere deelnemers"
						aria-hidden
					/>
				)}
				<span className={`min-w-0 flex-1 ${lineClampClass} break-words`}>{displayTitle}</span>
			</span>
		</div>
	);
}
