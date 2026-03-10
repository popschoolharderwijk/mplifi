import type { CalendarEvent } from '@/components/agenda/types';

export interface OptimisticMove {
	originalEvent: CalendarEvent;
	newStart: Date;
	newEnd: Date;
}

/**
 * Applies optimistic move to calendar events: moves the dropped occurrence and marks
 * the new slot as pending so the UI shows the change before server confirmation.
 */
export function buildCalendarEvents(events: CalendarEvent[], optimisticMove: OptimisticMove | null): CalendarEvent[] {
	if (!optimisticMove) return events;

	const { originalEvent, newStart, newEnd } = optimisticMove;
	const originalStartTime = originalEvent.start?.getTime();
	const newStartTime = newStart.getTime();

	return events.map((ev) => {
		if (ev.resource.eventId !== originalEvent.resource.eventId) return ev;
		const evStartTime = ev.start?.getTime();
		if (evStartTime === originalStartTime) {
			return { ...ev, start: newStart, end: newEnd, resource: { ...ev.resource, isPending: true } };
		}
		if (evStartTime === newStartTime) {
			return { ...ev, resource: { ...ev.resource, isPending: true } };
		}
		return ev;
	});
}
