import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { Formats } from 'react-big-calendar';
import { displayTime, formatDate } from '@/lib/dateHelpers';
import type {
	LessonAgreementWithStudent,
	LessonAppointmentDeviationWithAgreement,
	LessonFrequency,
} from '@/types/lesson-agreements';
import type { CalendarEvent } from './types';

export const dutchFormats: Formats = {
	timeGutterFormat: (date: Date) => format(date, 'HH:mm', { locale: nl }),
	eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'HH:mm', { locale: nl })} - ${format(end, 'HH:mm', { locale: nl })}`,
	dayFormat: (date: Date) => format(date, 'EEEE d', { locale: nl }),
	dayHeaderFormat: (date: Date) => format(date, 'EEEE d MMMM', { locale: nl }),
	dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'd MMM', { locale: nl })} - ${format(end, 'd MMM', { locale: nl })} ${format(end, 'yyyy', { locale: nl })}`,
	monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: nl }),
	weekdayFormat: (date: Date) => format(date, 'EEE', { locale: nl }),
	agendaTimeFormat: (date: Date) => format(date, 'HH:mm', { locale: nl }),
	agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'HH:mm', { locale: nl })} - ${format(end, 'HH:mm', { locale: nl })}`,
	agendaDateFormat: (date: Date) => format(date, 'EEEE d MMMM', { locale: nl }),
	agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'd MMM', { locale: nl })} - ${format(end, 'd MMM', { locale: nl })} ${format(end, 'yyyy', { locale: nl })}`,
	selectRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'HH:mm', { locale: nl })} - ${format(end, 'HH:mm', { locale: nl })}`,
};

export function getDateForDayOfWeek(dayOfWeek: number, referenceDate: Date): Date {
	const date = new Date(referenceDate);
	const currentDay = date.getDay();
	const diff = dayOfWeek - currentDay;
	date.setDate(date.getDate() + diff);
	return date;
}

/**
 * Returns a date string in the same week as originalDateStr but with the same weekday and time as droppedStart.
 * Same-week-only helper; actual_date is forced to the same week as originalDateStr.
 * @deprecated Prefer getDroppedDateString for drag-and-drop (actual_date >= CURRENT_DATE in DB).
 */
export function getActualDateInOriginalWeek(originalDateStr: string, droppedStart: Date): string {
	const originalDate = new Date(originalDateStr + 'T12:00:00');
	const targetDayOfWeek = droppedStart.getDay();
	const actualDate = getDateForDayOfWeek(targetDayOfWeek, originalDate);
	return actualDate.toISOString().split('T')[0];
}

/** Returns the calendar date of the drop as YYYY-MM-DD (local date). Use for actual_date when moving appointments (e.g. to next week). */
export function getDroppedDateString(droppedStart: Date): string {
	const y = droppedStart.getFullYear();
	const m = String(droppedStart.getMonth() + 1).padStart(2, '0');
	const d = String(droppedStart.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function getFrequency(agreement: LessonAgreementWithStudent): LessonFrequency {
	const freq = agreement.lesson_types?.frequency;
	return freq === 'daily' || freq === 'biweekly' || freq === 'monthly' ? freq : 'weekly';
}

/** First occurrence date in range for the given agreement and frequency. */
function getFirstOccurrenceInRange(
	agreement: LessonAgreementWithStudent,
	rangeStart: Date,
	frequency: LessonFrequency,
): Date {
	const startDate = new Date(agreement.start_date);
	if (frequency === 'daily') {
		const first = new Date(rangeStart);
		return startDate > first ? startDate : first;
	}
	if (frequency === 'weekly') {
		const first = getDateForDayOfWeek(agreement.day_of_week, rangeStart);
		if (first < startDate) {
			first.setDate(first.getDate() + 7);
		}
		return first;
	}
	if (frequency === 'biweekly') {
		const first = new Date(startDate);
		while (first < rangeStart) {
			first.setDate(first.getDate() + 14);
		}
		return first;
	}
	// monthly: same day-of-month as start_date
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

/** Advance currentLessonDate by one interval; mutates the date. */
function addInterval(date: Date, frequency: LessonFrequency): void {
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
	// monthly: add one month, keep day-of-month (cap at last day of month)
	const dayOfMonth = date.getDate();
	date.setMonth(date.getMonth() + 1);
	const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
	date.setDate(Math.min(dayOfMonth, lastDay));
}

function getGroupingKey(agreement: LessonAgreementWithStudent, frequency: LessonFrequency): string {
	const base = `${agreement.start_time}-${agreement.lesson_type_id}-${frequency}`;
	if (frequency === 'weekly') {
		return `${agreement.day_of_week}-${base}`;
	}
	if (frequency === 'daily') {
		return base;
	}
	// biweekly / monthly: include start_date so different phases don't merge
	return `${agreement.start_date}-${base}`;
}

/** Find recurring deviation for this agreement that applies to occurrenceDate (original_date <= occurrenceDate AND (no end_date OR end_date >= occurrenceDate)), if any. Prefer latest original_date. List must be sorted by original_date desc. */
function getRecurringDeviationForDate(
	recurringByAgreement: Map<string, LessonAppointmentDeviationWithAgreement[]>,
	agreementId: string,
	occurrenceDateStr: string,
): LessonAppointmentDeviationWithAgreement | undefined {
	const list = recurringByAgreement.get(agreementId);
	if (!list?.length) return undefined;
	// Find a recurring deviation where:
	// - original_date <= occurrenceDateStr (deviation started on or before this occurrence)
	// - AND (no recurring_end_date OR recurring_end_date >= occurrenceDateStr) (deviation hasn't ended yet)
	return list.find(
		(d) =>
			d.original_date <= occurrenceDateStr &&
			(d.recurring_end_date === null ||
				d.recurring_end_date === undefined ||
				d.recurring_end_date >= occurrenceDateStr),
	);
}

export function generateRecurringEvents(
	agreements: LessonAgreementWithStudent[],
	rangeStart: Date,
	rangeEnd: Date,
	deviations: Map<string, LessonAppointmentDeviationWithAgreement>,
	recurringByAgreement?: Map<string, LessonAppointmentDeviationWithAgreement[]>,
): CalendarEvent[] {
	const events: CalendarEvent[] = [];

	const groupedAgreements = new Map<string, LessonAgreementWithStudent[]>();
	for (const agreement of agreements) {
		const frequency = getFrequency(agreement);
		const key = getGroupingKey(agreement, frequency);
		const existing = groupedAgreements.get(key) || [];
		existing.push(agreement);
		groupedAgreements.set(key, existing);
	}

	for (const [, group] of groupedAgreements) {
		const firstAgreement = group[0];
		const frequency = getFrequency(firstAgreement);
		const isGroupLesson = firstAgreement.lesson_types.is_group_lesson;
		const durationMinutes = firstAgreement.lesson_types.duration_minutes || 30;

		const studentNames = group.map((a) =>
			a.profiles?.first_name && a.profiles?.last_name
				? `${a.profiles.first_name} ${a.profiles.last_name}`
				: a.profiles?.first_name || a.profiles?.email || 'Onbekend',
		);

		const earliestStartDate = new Date(Math.min(...group.map((a) => new Date(a.start_date).getTime())));
		const latestEndDate = group.some((a) => !a.end_date)
			? null
			: new Date(
					Math.max(...group.filter((a) => a.end_date).map((a) => new Date(a.end_date as string).getTime())),
				);

		const currentLessonDate = getFirstOccurrenceInRange(firstAgreement, rangeStart, frequency);

		while (currentLessonDate <= rangeEnd) {
			if (currentLessonDate >= earliestStartDate && (!latestEndDate || currentLessonDate <= latestEndDate)) {
				const lessonDateStr = currentLessonDate.toISOString().split('T')[0];

				if (!isGroupLesson && group.length === 1) {
					const deviation = deviations.get(`${firstAgreement.id}-${lessonDateStr}`);

					if (deviation) {
						const isCancelled = deviation.is_cancelled;
						const [hours, minutes] = isCancelled
							? deviation.original_start_time.split(':')
							: deviation.actual_start_time.split(':');
						const eventDate = new Date(isCancelled ? deviation.original_date : deviation.actual_date);
						eventDate.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

						// Check if this deviation effectively restores to the agreement's original schedule.
						// If actual_date is the same weekday as the agreement AND actual_start_time matches,
						// it's visually not a deviation (e.g., an override that returns to Monday when agreement is Monday).
						const actualDayOfWeek = new Date(deviation.actual_date).getDay();
						const actualTimeNormalized = deviation.actual_start_time.substring(0, 5); // HH:mm
						const agreementTimeNormalized = firstAgreement.start_time.substring(0, 5);
						const isEffectivelyOriginal =
							!isCancelled &&
							actualDayOfWeek === firstAgreement.day_of_week &&
							actualTimeNormalized === agreementTimeNormalized;

						const deviationProfile = deviation.lesson_agreements.profiles;
						const deviationStudentName =
							deviationProfile?.first_name && deviationProfile?.last_name
								? `${deviationProfile.first_name} ${deviationProfile.last_name}`
								: deviationProfile?.first_name || deviationProfile?.email || 'Onbekend';

						const deviationStudentInfo = deviationProfile
							? {
									user_id: deviation.lesson_agreements.student_user_id,
									first_name: deviationProfile.first_name,
									last_name: deviationProfile.last_name,
									email: deviationProfile.email,
									avatar_url: (deviationProfile as { avatar_url?: string | null }).avatar_url ?? null,
								}
							: undefined;

						events.push({
							title: `${deviation.lesson_agreements.lesson_types.name} - ${deviationStudentName}`,
							start: eventDate,
							end: new Date(eventDate.getTime() + durationMinutes * 60 * 1000),
							resource: {
								type: isEffectivelyOriginal ? 'agreement' : 'deviation',
								agreementId: firstAgreement.id,
								deviationId: deviation.id,
								studentName: deviationStudentName,
								studentInfo: deviationStudentInfo,
								lessonTypeName: deviation.lesson_agreements.lesson_types.name,
								lessonTypeColor: deviation.lesson_agreements.lesson_types.color,
								lessonTypeIcon: deviation.lesson_agreements.lesson_types.icon,
								isDeviation: !isCancelled && !isEffectivelyOriginal,
								isCancelled,
								isGroupLesson: false,
								originalDate: deviation.original_date,
								originalStartTime: deviation.original_start_time,
								reason: deviation.reason,
								isRecurring: !!deviation.recurring,
							},
						});
						addInterval(currentLessonDate, frequency);
						continue;
					}

					// No exact deviation: check recurring deviation for this occurrence
					const recurringDeviation = recurringByAgreement
						? getRecurringDeviationForDate(recurringByAgreement, firstAgreement.id, lessonDateStr)
						: undefined;
					if (recurringDeviation) {
						const isCancelled = recurringDeviation.is_cancelled;
						const [hours, minutes] = recurringDeviation.actual_start_time.split(':');
						const actualDayOfWeek = new Date(recurringDeviation.actual_date).getDay();
						const eventDate = getDateForDayOfWeek(actualDayOfWeek, currentLessonDate);
						eventDate.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

						const deviationProfile = recurringDeviation.lesson_agreements.profiles;
						const deviationStudentName =
							deviationProfile?.first_name && deviationProfile?.last_name
								? `${deviationProfile.first_name} ${deviationProfile.last_name}`
								: deviationProfile?.first_name || deviationProfile?.email || 'Onbekend';

						const deviationStudentInfo = deviationProfile
							? {
									user_id: recurringDeviation.lesson_agreements.student_user_id,
									first_name: deviationProfile.first_name,
									last_name: deviationProfile.last_name,
									email: deviationProfile.email,
									avatar_url: (deviationProfile as { avatar_url?: string | null }).avatar_url ?? null,
								}
							: undefined;

						events.push({
							title: `${recurringDeviation.lesson_agreements.lesson_types.name} - ${deviationStudentName}`,
							start: eventDate,
							end: new Date(eventDate.getTime() + durationMinutes * 60 * 1000),
							resource: {
								type: 'deviation',
								agreementId: firstAgreement.id,
								deviationId: recurringDeviation.id,
								studentName: deviationStudentName,
								studentInfo: deviationStudentInfo,
								lessonTypeName: recurringDeviation.lesson_agreements.lesson_types.name,
								lessonTypeColor: recurringDeviation.lesson_agreements.lesson_types.color,
								lessonTypeIcon: recurringDeviation.lesson_agreements.lesson_types.icon,
								isDeviation: !isCancelled,
								isCancelled,
								isGroupLesson: false,
								originalDate: recurringDeviation.original_date,
								originalStartTime: recurringDeviation.original_start_time,
								reason: recurringDeviation.reason,
								isRecurring: true,
							},
						});
						addInterval(currentLessonDate, frequency);
						continue;
					}
				}

				const [hours, minutes] = firstAgreement.start_time.split(':');
				const eventDate = new Date(currentLessonDate);
				eventDate.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

				const title = isGroupLesson
					? `${firstAgreement.lesson_types.name} (${group.length} deelnemers)`
					: `${firstAgreement.lesson_types.name} - ${studentNames[0]}`;

				const studentInfoList = group
					.filter(
						(
							a,
						): a is LessonAgreementWithStudent & {
							profiles: NonNullable<LessonAgreementWithStudent['profiles']>;
						} => a.profiles !== null,
					)
					.map((a) => ({
						user_id: a.student_user_id,
						first_name: a.profiles.first_name,
						last_name: a.profiles.last_name,
						email: a.profiles.email,
						avatar_url: (a.profiles as { avatar_url?: string | null }).avatar_url ?? null,
					}));

				events.push({
					title,
					start: eventDate,
					end: new Date(eventDate.getTime() + durationMinutes * 60 * 1000),
					resource: {
						type: 'agreement',
						agreementId: firstAgreement.id,
						studentName: isGroupLesson ? studentNames.join(', ') : studentNames[0],
						studentInfo: !isGroupLesson && studentInfoList.length > 0 ? studentInfoList[0] : undefined,
						studentInfoList: isGroupLesson ? studentInfoList : undefined,
						lessonTypeName: firstAgreement.lesson_types.name,
						lessonTypeColor: firstAgreement.lesson_types.color,
						lessonTypeIcon: firstAgreement.lesson_types.icon,
						isDeviation: false,
						isCancelled: false,
						isGroupLesson,
						studentCount: isGroupLesson ? group.length : undefined,
					},
				});
			}

			addInterval(currentLessonDate, frequency);
		}
	}

	return events;
}

export function buildTooltipText(event: CalendarEvent): string {
	const {
		isDeviation,
		isCancelled,
		originalDate,
		originalStartTime,
		reason,
		lessonTypeName,
		studentName,
		isGroupLesson,
		studentCount,
	} = event.resource;

	const lines: string[] = [lessonTypeName];

	if (isGroupLesson) {
		lines.push(`${studentCount} deelnemers:`);
		const students = studentName.split(', ');
		for (const student of students) {
			lines.push(`  • ${student}`);
		}
	} else {
		lines.push(studentName);
	}

	if (isCancelled) {
		lines.push('');
		lines.push('❌ Les vervallen');
		if (reason) {
			lines.push(`Reden: ${reason}`);
		}
	} else if (isDeviation) {
		lines.push('');
		lines.push('⚠ Gewijzigde afspraak');
		if (originalDate && originalStartTime) {
			lines.push(`Origineel: ${formatDate(originalDate)} om ${displayTime(originalStartTime)}`);
		}
		if (reason) {
			lines.push(`Reden: ${reason}`);
		}
	}

	return lines.join('\n');
}
