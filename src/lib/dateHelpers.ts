import { format, getDay, parse, startOfWeek } from 'date-fns';
import { nl } from 'date-fns/locale';
import { dateFnsLocalizer } from 'react-big-calendar';

/**
 * Day names in database order (0 = Sunday, 1 = Monday, etc.)
 */
export const DAY_NAMES = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'] as const;

/**
 * Day names ordered starting with Monday (for display purposes)
 * This is useful for UI components that want to show Monday first
 */
export const DAY_NAMES_DISPLAY = [
	'Maandag',
	'Dinsdag',
	'Woensdag',
	'Donderdag',
	'Vrijdag',
	'Zaterdag',
	'Zondag',
] as const;

/**
 * Get day name by day of week (0 = Sunday, 1 = Monday, etc.)
 * @param dayOfWeek - Day of week in database format (0-6, where 0 = Sunday)
 * @returns Day name or "Onbekend" if invalid
 */
export function getDayName(dayOfWeek: number): string {
	if (dayOfWeek >= 0 && dayOfWeek < DAY_NAMES.length) {
		return DAY_NAMES[dayOfWeek];
	}
	return 'Onbekend';
}

/**
 * React Big Calendar localizer configured for Dutch locale
 * Used for calendar components to display dates and times in Dutch format
 * Week starts on Monday
 */
export const calendarLocalizer = dateFnsLocalizer({
	format,
	parse,
	startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1, locale: nl }),
	getDay,
	locales: {
		'nl-NL': nl,
	},
});

/**
 * Availability settings for teacher availability grid
 */
export const AVAILABILITY_SETTINGS = {
	START_HOUR: 9,
	END_HOUR: 21,
	SLOT_DURATION_MINUTES: 30,
} as const;

/**
 * Convert an hour number to a time string in HH:00 format
 */
export function hourToTimeString(hour: number): string {
	return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Default time strings for availability forms
 */
export const DEFAULT_START_TIME = hourToTimeString(AVAILABILITY_SETTINGS.START_HOUR);
export const DEFAULT_END_TIME = hourToTimeString(AVAILABILITY_SETTINGS.END_HOUR);

/**
 * Generate time slots for availability grid based on settings
 * @returns Array of time strings in HH:MM format
 */
export function generateAvailabilityTimeSlots(): string[] {
	const slots: string[] = [];
	const totalMinutes = (AVAILABILITY_SETTINGS.END_HOUR - AVAILABILITY_SETTINGS.START_HOUR) * 60;
	const slotCount = Math.floor(totalMinutes / AVAILABILITY_SETTINGS.SLOT_DURATION_MINUTES);

	for (let i = 0; i <= slotCount; i++) {
		const totalMinutesFromStart = i * AVAILABILITY_SETTINGS.SLOT_DURATION_MINUTES;
		const hour = AVAILABILITY_SETTINGS.START_HOUR + Math.floor(totalMinutesFromStart / 60);
		const minute = totalMinutesFromStart % 60;
		slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
	}

	return slots;
}

/**
 * Map display day index (0 = Monday) to database day index (0 = Sunday)
 * @param displayIndex - Day index where 0 = Monday
 * @returns Database day index where 0 = Sunday, 1 = Monday, etc.
 */
export function displayDayToDbDay(displayIndex: number): number {
	// Display: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
	// Database: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
	return displayIndex === 6 ? 0 : displayIndex + 1;
}

/**
 * Map database day index (0 = Sunday) to display day index (0 = Monday)
 */
export function dbDayToDisplayDay(dbIndex: number): number {
	return dbIndex === 0 ? 6 : dbIndex - 1;
}

/**
 * Format a date string to Dutch format (e.g., "maandag 10 februari")
 * @param dateStr - Date string in ISO format (YYYY-MM-DD or full ISO)
 * @returns Formatted date string in Dutch
 */
export function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return format(date, 'EEEE d MMMM', { locale: nl });
}

/** Regex: HH:mm or HH:mm:ss (hour 0-23, minutes/seconds 00-59) */
const TIME_STRING_REGEX = /^\d{1,2}:\d{2}(:\d{2})?$/;

/**
 * Format a time-only string for display: HH:mm or HH:mm:ss → HH:mm.
 * Use for values from the DB (e.g. teacher_availability.start_time).
 * @param timeStr - Time string (HH:mm or HH:mm:ss, e.g. from PostgreSQL TIME)
 * @returns Time string in HH:mm format, or empty string if format invalid
 */
export function formatTimeString(timeStr: string): string {
	if (!timeStr || typeof timeStr !== 'string') return '';
	const trimmed = timeStr.trim();
	return TIME_STRING_REGEX.test(trimmed) ? trimmed.substring(0, 5) : '';
}

/**
 * Format a Date's time part for display: always HH:mm.
 * Use when you have a Date object (e.g. from a date picker or new Date()).
 * @param date - Date instance
 * @returns Time string in HH:mm format
 */
export function formatTimeFromDate(date: Date): string {
	return format(date, 'HH:mm');
}
