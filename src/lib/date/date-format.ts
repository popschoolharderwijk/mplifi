import { format, parse, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';

const DATE_FORMAT_UI = 'dd-MM-yyyy' as const;
const DATE_FORMAT_DB = 'yyyy-MM-dd' as const;
export const DATE_INPUT_PLACEHOLDER = 'dd-mm-jjjj' as const;

export function now() {
	return new Date();
}

export function formatDbDateToUi(dateStr: string) {
	if (!dateStr?.trim()) return '-';
	const parsed = parse(dateStr, DATE_FORMAT_DB, now());
	if (Number.isNaN(parsed.getTime())) return '-';
	return format(parsed, DATE_FORMAT_UI, { locale: nl });
}

export function formatDateToDb(date: Date) {
	return format(date, DATE_FORMAT_DB);
}

export function formatDbDateLong(dateStr: string) {
	const parsed = parseISO(dateStr);
	if (Number.isNaN(parsed.getTime())) return '-';
	return format(parsed, 'EEEE d MMMM', { locale: nl });
}

export function formatDateLong(date: Date) {
	if (Number.isNaN(date.getTime())) return '-';
	return format(date, 'EEEE d MMMM', { locale: nl });
}

/** Short date + time for tables/lists (nl-NL style: dd-MM-yyyy HH:mm). */
export function formatDateTimeShort(date: Date): string {
	if (Number.isNaN(date.getTime())) return '-';
	return format(date, 'dd-MM-yyyy HH:mm', { locale: nl });
}

export function addDaysToDate(date: Date, days: number) {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
}

/** Add minutes to a date; returns new Date. */
export function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60 * 1000);
}

/** Add days to a DB-format date string (YYYY-MM-DD), returns DB format. */
export function addDaysToDateStr(dateStr: string, days: number): string {
	const d = parseISO(dateStr);
	return formatDateToDb(addDaysToDate(d, days));
}

export function addDaysFromNow(days: number) {
	return addDaysToDate(now(), days);
}

export function addYearsToDate(date: Date, years: number) {
	const d = new Date(date);
	d.setFullYear(d.getFullYear() + years);
	return d;
}

export function addYearsFromNow(years: number) {
	return addYearsToDate(now(), years);
}

export function getDateForDayOfWeek(dayOfWeek: number, referenceDate: Date) {
	const date = new Date(referenceDate);
	const currentDay = date.getDay();
	const diff = dayOfWeek - currentDay;
	date.setDate(date.getDate() + diff);
	return date;
}

/** Date in the same week as originalDateStr with the same weekday as referenceDate (YYYY-MM-DD). */
export function getActualDateInOriginalWeek(originalDateStr: string, referenceDate: Date): string {
	const originalDate = parseISO(originalDateStr + 'T12:00:00');
	const targetDayOfWeek = referenceDate.getDay();
	const actualDate = getDateForDayOfWeek(targetDayOfWeek, originalDate);
	return formatDateToDb(actualDate);
}
