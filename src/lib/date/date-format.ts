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

export function dateDaysFromDate(date: Date, days: number) {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
}

export function dateDaysFromNow(days: number) {
	return dateDaysFromDate(now(), days);
}

export function dateYearsFromDate(date: Date, years: number) {
	const d = new Date(date);
	d.setFullYear(d.getFullYear() + years);
	return d;
}

export function dateYearsFromNow(years: number) {
	return dateYearsFromDate(now(), years);
}

export function getDateForDayOfWeek(dayOfWeek: number, referenceDate: Date) {
	const date = new Date(referenceDate);
	const currentDay = date.getDay();
	const diff = dayOfWeek - currentDay;
	date.setDate(date.getDate() + diff);
	return date;
}
