import type { View } from 'react-big-calendar';
import { darkenColor, getContrastTextColor } from '@/lib/color/color-utils';
import type { CalendarEvent } from './types';

export const agendaMessages = {
	next: 'Volgende',
	previous: 'Vorige',
	today: 'Vandaag',
	month: 'Maand',
	week: 'Week',
	day: 'Dag',
	agenda: 'Agenda',
	date: 'Datum',
	time: 'Tijd',
	event: 'Afspraak',
	noEventsInRange: 'Geen afspraken in dit bereik',
	showMore: (total: number) => `+${total} meer`,
};

export function getEventStyle(event: CalendarEvent, currentView: View) {
	if (currentView === 'agenda') {
		return { style: { backgroundColor: 'transparent', border: 'none', color: 'inherit', opacity: 1 } };
	}
	const isAgenda = event.resource.type === 'agenda';
	const isCancelled = event.resource.isCancelled;
	const isGroupLesson = event.resource.isGroupLesson;
	const isPending = event.resource.isPending;
	const customColor = event.resource.color || event.resource.lessonTypeColor;

	let backgroundColor: string;
	let borderColor: string;

	if (customColor) {
		backgroundColor = customColor;
		borderColor = darkenColor(customColor, 0.25);
	} else if (isGroupLesson) {
		backgroundColor = '#6366f1';
		borderColor = '#4f46e5';
	} else if (isAgenda) {
		backgroundColor = '#3b82f6';
		borderColor = '#2563eb';
	} else {
		backgroundColor = '#10b981';
		borderColor = '#059669';
	}

	let opacity = 0.9;
	if (isCancelled) opacity = 0.45;
	else if (isPending) opacity = 0.5;
	const textColor = getContrastTextColor(backgroundColor);
	return {
		style: {
			backgroundColor,
			borderColor,
			borderLeftWidth: '4px',
			borderStyle: isPending ? 'dashed' : 'solid',
			color: textColor,
			borderRadius: '4px',
			opacity,
		},
	};
}
