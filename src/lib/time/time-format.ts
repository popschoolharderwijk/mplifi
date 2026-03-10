import { format } from 'date-fns';
import { timeToMinutes } from './time-range';

export function hourToTimeString(hour: number): string {
	return `${String(hour).padStart(2, '0')}:00`;
}

export function formatTime(timeStr: string): string {
	if (timeToMinutes(timeStr) === null) return '';
	return timeStr.substring(0, 5);
}

export function normalizeTime(timeStr: string): string {
	if (timeToMinutes(timeStr) === null) return '';
	return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
}

/** Apply a time string (HH:mm or HH:mm:ss) to a date; returns new Date. */
export function applyTimeToDate(date: Date, time: string): Date {
	const parts = time.split(':').map(Number);
	const d = new Date(date);
	d.setHours(parts[0], parts[1] ?? 0, parts[2] ?? 0, 0);
	return d;
}

/** True when actual and original time strings differ (after normalizing). */
export function hasTimeChange(actual: string, original: string): boolean {
	return normalizeTime(actual) !== normalizeTime(original);
}

export function formatTimeFromDate(date: Date): string {
	return format(date, 'HH:mm');
}

export function normalizeTimeFromDate(date: Date): string {
	return format(date, 'HH:mm:ss');
}

const DURATION_HOURS_FORMATTER = new Intl.NumberFormat('nl-NL', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/** Format duration in minutes as decimal hours, 2 decimal places, Dutch (e.g. 690 → "11,50"). */
export function formatDurationMinutes(minutes: number): string {
	const hours = minutes / 60;
	return DURATION_HOURS_FORMATTER.format(hours);
}
