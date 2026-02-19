import { getOccurrenceDatesInRange } from '@/lib/lessonHelpers';
import { splitTimeRangeIntoSlots, timeRangesOverlap, timeToMinutes } from '@/lib/time/time-range';
import type { LessonFrequency } from '@/types/lesson-agreements';

/** Teacher availability slot from teacher_availability table */
export interface AvailabilitySlot {
	day_of_week: number;
	start_time: string;
	end_time: string;
}

/** Minimal agreement shape used to compute slot occupancy in a period */
export interface ExistingAgreementForSlot {
	day_of_week: number;
	start_time: string;
	start_date: string;
	end_date: string | null;
	frequency: LessonFrequency;
	duration_minutes: number;
}

export type SlotStatus = 'free' | 'occupied' | 'partial';

export interface SlotWithStatus {
	day_of_week: number;
	start_time: string;
	end_time: string;
	status: SlotStatus;
	totalOccurrences: number;
	occupiedOccurrences: number;
}

/** Whether an agreement has an occurrence on this date (given its frequency and day) */
function agreementHasOccurrenceOnDate(agreement: ExistingAgreementForSlot, dateStr: string): boolean {
	const date = new Date(dateStr + 'T12:00:00');
	const agreementStart = new Date(agreement.start_date + 'T12:00:00');
	const agreementEnd = agreement.end_date ? new Date(agreement.end_date + 'T12:00:00') : new Date(9999, 11, 31);
	if (date < agreementStart || date > agreementEnd) return false;
	if (agreement.day_of_week !== date.getDay()) return false;

	if (agreement.frequency === 'daily') return true;
	if (agreement.frequency === 'weekly') return true;
	if (agreement.frequency === 'biweekly') {
		const msPerTwoWeeks = 14 * 24 * 60 * 60 * 1000;
		const diff = date.getTime() - agreementStart.getTime();
		return Math.round(diff / msPerTwoWeeks) % 1 === 0;
	}
	// monthly: same day of month
	return date.getDate() === agreementStart.getDate();
}

/**
 * Compute status (free / occupied / partial) for each availability slot of a teacher
 * in the given period, based on existing lesson agreements.
 *
 * Important: existingAgreements must be ALL agreements for this teacher in the period
 * (all lesson types). Otherwise a teacher who gives e.g. guitar and drums could
 * appear "free" for guitar in a slot where they already have drums.
 * - free: no agreements in this slot in the period
 * - partial: some occurrences occupied (slot remains selectable; teacher resolves conflicts)
 * - occupied: every occurrence in the period is occupied (slot not selectable)
 */
export function getSlotStatuses(
	periodStart: Date,
	periodEnd: Date,
	availabilitySlots: AvailabilitySlot[],
	existingAgreements: ExistingAgreementForSlot[],
	durationMinutes: number,
	frequency: LessonFrequency,
): SlotWithStatus[] {
	const result: SlotWithStatus[] = [];

	for (const avail of availabilitySlots) {
		const subSlots = splitTimeRangeIntoSlots(avail.start_time, avail.end_time, durationMinutes);
		for (const sub of subSlots) {
			const occurrenceDates = getOccurrenceDatesInRange(avail.day_of_week, periodStart, periodEnd, frequency);
			const totalOccurrences = occurrenceDates.length;
			if (totalOccurrences === 0) continue;

			let occupiedCount = 0;
			const startMin = timeToMinutes(sub.start_time);
			const endMin = startMin + durationMinutes;

			for (const dateStr of occurrenceDates) {
				let occupied = false;
				for (const agreement of existingAgreements) {
					if (!agreementHasOccurrenceOnDate(agreement, dateStr)) continue;
					const agreeStart = timeToMinutes(agreement.start_time);
					const agreeEnd = agreeStart + agreement.duration_minutes;
					if (timeRangesOverlap(startMin, endMin, agreeStart, agreeEnd)) {
						occupied = true;
						break;
					}
				}
				if (occupied) occupiedCount++;
			}

			const status: SlotStatus =
				occupiedCount === 0 ? 'free' : occupiedCount === totalOccurrences ? 'occupied' : 'partial';

			result.push({
				day_of_week: avail.day_of_week,
				start_time: sub.start_time,
				end_time: sub.end_time,
				status,
				totalOccurrences,
				occupiedOccurrences: occupiedCount,
			});
		}
	}

	return result;
}
