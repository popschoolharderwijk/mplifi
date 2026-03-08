/**
 * Lesson-specific helpers
 * Utility functions for recurring lesson scheduling
 */

import type { LessonFrequency } from '@/types/lesson-agreements';
import { formatDateToDb, getDateForDayOfWeek } from './date/date-format';

/**
 * Advance a date by one interval according to frequency (mutates the date).
 */
export function addInterval(date: Date, frequency: LessonFrequency): void {
	if (frequency === 'daily') {
		date.setDate(date.getDate() + 1);
		return;
	}
	if (frequency === 'weekly') {
		date.setDate(date.getDate() + 7);
		return;
	}
	if (frequency === 'biweekly') {
		date.setDate(date.getDate() + 14);
		return;
	}
	const dayOfMonth = date.getDate();
	date.setMonth(date.getMonth() + 1);
	const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
	date.setDate(Math.min(dayOfMonth, lastDay));
}

/**
 * First occurrence date in range for the given day_of_week and frequency.
 */
export function getFirstOccurrenceInRange(
	dayOfWeek: number,
	rangeStart: Date,
	periodStart: Date,
	frequency: LessonFrequency,
): Date {
	const startDate = new Date(periodStart);
	if (frequency === 'daily') {
		const first = new Date(rangeStart);
		return startDate > first ? startDate : first;
	}
	if (frequency === 'weekly') {
		const first = getDateForDayOfWeek(dayOfWeek, rangeStart);
		if (first < startDate) {
			first.setDate(first.getDate() + 7);
		}
		return first;
	}
	if (frequency === 'biweekly') {
		const first = getDateForDayOfWeek(dayOfWeek, startDate);
		while (first < rangeStart) {
			first.setDate(first.getDate() + 14);
		}
		return first;
	}
	// monthly
	const dayOfMonth = startDate.getDate();
	const first = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
	const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
	first.setDate(Math.min(dayOfMonth, lastDay));
	if (first < rangeStart) {
		first.setMonth(first.getMonth() + 1);
		const lastDayNext = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
		first.setDate(Math.min(dayOfMonth, lastDayNext));
	}
	if (first < startDate) {
		first.setFullYear(startDate.getFullYear());
		first.setMonth(startDate.getMonth());
		first.setDate(Math.min(dayOfMonth, new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()));
	}
	return first;
}

/**
 * Add n intervals to a date (returns new Date, does not mutate).
 */
export function addNIntervals(date: Date, n: number, frequency: LessonFrequency): Date {
	const result = new Date(date);
	for (let i = 0; i < n; i++) {
		addInterval(result, frequency);
	}
	return result;
}

/**
 * Number of periods between fromDate and toDate for the given frequency.
 */
export function getOccurrenceIndex(fromDate: Date, toDate: Date, frequency: LessonFrequency): number {
	const fromMs = fromDate.getTime();
	const toMs = toDate.getTime();
	if (toMs < fromMs) return 0;
	if (frequency === 'daily') {
		return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
	}
	if (frequency === 'weekly') {
		return Math.round((toMs - fromMs) / (7 * 24 * 60 * 60 * 1000));
	}
	if (frequency === 'biweekly') {
		return Math.round((toMs - fromMs) / (14 * 24 * 60 * 60 * 1000));
	}
	// monthly: approximate
	const fromYear = fromDate.getFullYear();
	const fromMonth = fromDate.getMonth();
	const toYear = toDate.getFullYear();
	const toMonth = toDate.getMonth();
	return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/**
 * All occurrence dates for a given day_of_week in [periodStart, periodEnd] with given frequency.
 * @returns Array of YYYY-MM-DD date strings.
 */
export function getOccurrenceDatesInRange(
	dayOfWeek: number,
	periodStart: Date,
	periodEnd: Date,
	frequency: LessonFrequency,
): string[] {
	const out: string[] = [];
	const current = getFirstOccurrenceInRange(dayOfWeek, periodStart, periodStart, frequency);
	while (current <= periodEnd) {
		if (current >= periodStart) {
			out.push(formatDateToDb(current));
		}
		addInterval(current, frequency);
	}
	return out;
}
