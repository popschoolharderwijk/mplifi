import type { CalendarEvent } from '@/components/agenda/types';

export function needsRecurrenceChoice(event: CalendarEvent): boolean {
	if (event.resource.isDeviation && event.resource.deviationId && event.resource.isRecurring === false) return false;
	if (event.resource.sourceType === 'manual' && !event.resource.isRecurring) return false;
	return true;
}
