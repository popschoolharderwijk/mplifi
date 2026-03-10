import type { CalendarEvent } from '@/components/agenda/types';
import { buildParticipantInfo } from '@/lib/agenda/eventUtils';
import { pushToMapArray } from '@/lib/collections';
import { addMinutes, formatDateToDb, getDateForDayOfWeek } from '@/lib/date/date-format';
import { getDisplayName } from '@/lib/display-name';
import {
	addInterval as addIntervalHelper,
	addNIntervals,
	getFirstOccurrenceInRange as getFirstOccurrenceInRangeHelper,
	getOccurrenceIndex,
} from '@/lib/lessonHelpers';
import { applyTimeToDate, hasTimeChange } from '@/lib/time/time-format';
import type { AgendaEventDeviationRow, AgendaEventRow } from '@/types/agenda-events';
import type {
	LessonAgreementWithStudent,
	LessonAppointmentDeviationWithAgreement,
	LessonFrequency,
} from '@/types/lesson-agreements';
import type { User, UserOptional } from '@/types/users';

function getFrequency(agreement: LessonAgreementWithStudent): LessonFrequency {
	return agreement.frequency;
}

function getFirstOccurrenceInRange(
	agreement: LessonAgreementWithStudent,
	rangeStart: Date,
	frequency: LessonFrequency,
): Date {
	const periodStart = new Date(agreement.start_date);
	return getFirstOccurrenceInRangeHelper(agreement.day_of_week, rangeStart, periodStart, frequency);
}

function addInterval(date: Date, frequency: LessonFrequency): void {
	addIntervalHelper(date, frequency);
}

function getGroupingKey(agreement: LessonAgreementWithStudent, frequency: LessonFrequency): string {
	const base = `${agreement.start_time}-${agreement.lesson_type_id}-${frequency}`;
	if (frequency === 'weekly') return `${agreement.day_of_week}-${base}`;
	if (frequency === 'daily') return base;
	return `${agreement.start_date}-${base}`;
}

function getRecurringDeviationForDate(
	recurringByEventId: Map<string, LessonAppointmentDeviationWithAgreement[]>,
	eventId: string,
	occurrenceDateStr: string,
): LessonAppointmentDeviationWithAgreement | undefined {
	const list = recurringByEventId.get(eventId);
	if (!list?.length) return undefined;
	return list.find(
		(d) =>
			d.original_date <= occurrenceDateStr &&
			(!d.recurring_end_date || d.recurring_end_date >= occurrenceDateStr),
	);
}

export function generateRecurringEvents(
	agreements: LessonAgreementWithStudent[],
	rangeStart: Date,
	rangeEnd: Date,
	deviations: Map<string, LessonAppointmentDeviationWithAgreement>,
	recurringByEventId?: Map<string, LessonAppointmentDeviationWithAgreement[]>,
	eventIdByAgreementId?: Map<string, string>,
): CalendarEvent[] {
	const events: CalendarEvent[] = [];
	const getEventId = (agreementId: string) => eventIdByAgreementId?.get(agreementId);

	const groupedAgreements = new Map<string, LessonAgreementWithStudent[]>();
	for (const agreement of agreements) {
		const frequency = getFrequency(agreement);
		const key = getGroupingKey(agreement, frequency);
		pushToMapArray(groupedAgreements, key, agreement);
	}

	for (const [, group] of groupedAgreements) {
		const firstAgreement = group[0];
		const frequency = getFrequency(firstAgreement);
		const isGroupLesson = firstAgreement.lesson_types.is_group_lesson;
		const durationMinutes = firstAgreement.duration_minutes;
		const eventId = getEventId(firstAgreement.id);

		const studentNames = group.map((a) => getDisplayName(a.profiles));

		const earliestStartDate = new Date(Math.min(...group.map((a) => new Date(a.start_date).getTime())));
		const latestEndDate = group.some((a) => !a.end_date)
			? null
			: new Date(
					Math.max(...group.filter((a) => a.end_date).map((a) => new Date(a.end_date as string).getTime())),
				);

		const currentLessonDate = getFirstOccurrenceInRange(firstAgreement, rangeStart, frequency);

		while (currentLessonDate <= rangeEnd) {
			if (currentLessonDate >= earliestStartDate && (!latestEndDate || currentLessonDate <= latestEndDate)) {
				const lessonDateStr = formatDateToDb(currentLessonDate);

				if (!isGroupLesson && group.length === 1 && eventId) {
					const deviation = deviations.get(`${eventId}-${lessonDateStr}`);

					if (deviation) {
						const isCancelled = deviation.is_cancelled;
						const timeStr = isCancelled ? deviation.original_start_time : deviation.actual_start_time;
						const baseDate = isCancelled ? deviation.original_date : deviation.actual_date;
						const eventDate = applyTimeToDate(new Date(baseDate), timeStr);

						const actualDayOfWeek = new Date(deviation.actual_date).getDay();
						const actualTimeNormalized = deviation.actual_start_time.substring(0, 5);
						const agreementTimeNormalized = firstAgreement.start_time.substring(0, 5);
						const isEffectivelyOriginal =
							!isCancelled &&
							actualDayOfWeek === firstAgreement.day_of_week &&
							actualTimeNormalized === agreementTimeNormalized;

						const lesson = deviation.lesson_agreement ?? firstAgreement;
						const deviationUserOptional = lesson.profiles as UserOptional | null;
						const deviationStudentName = getDisplayName(deviationUserOptional);
						const deviationUserInfo = buildParticipantInfo(
							deviationUserOptional,
							'student_user_id' in lesson ? lesson.student_user_id : firstAgreement.student_user_id,
						);
						const lessonTypeName =
							'lesson_types' in lesson
								? lesson.lesson_types.name
								: (deviation.agenda_event?.title ?? firstAgreement.lesson_types.name);
						const lessonTypeColor = 'lesson_types' in lesson ? lesson.lesson_types.color : null;
						const lessonTypeIcon = 'lesson_types' in lesson ? lesson.lesson_types.icon : null;
						const hasTimeOrDateChange =
							!isCancelled &&
							(deviation.actual_date !== deviation.original_date ||
								hasTimeChange(deviation.actual_start_time, deviation.original_start_time));

						events.push({
							title: `${lessonTypeName} - ${deviationStudentName}`,
							start: eventDate,
							end: addMinutes(eventDate, durationMinutes),
							resource: {
								type: isEffectivelyOriginal ? 'agreement' : 'deviation',
								agreementId: firstAgreement.id,
								eventId,
								deviationId: deviation.id,
								studentName: deviationStudentName,
								user: deviationUserInfo,
								lessonTypeName,
								lessonTypeColor,
								lessonTypeIcon,
								isDeviation: !isCancelled && !isEffectivelyOriginal,
								hasTimeOrDateChange,
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

					const recurringDeviation = getRecurringDeviationForDate(
						recurringByEventId ?? new Map(),
						eventId,
						lessonDateStr,
					);
					if (recurringDeviation) {
						const isCancelled = recurringDeviation.is_cancelled;
						const actualDayOfWeek = new Date(recurringDeviation.actual_date).getDay();
						const eventDate = applyTimeToDate(
							getDateForDayOfWeek(actualDayOfWeek, currentLessonDate),
							recurringDeviation.actual_start_time,
						);

						const recLesson = recurringDeviation.lesson_agreement ?? firstAgreement;
						const recurringUserOptional = recLesson.profiles as UserOptional | null;
						const recurringStudentName = getDisplayName(recurringUserOptional);
						const recurringUserInfo = buildParticipantInfo(
							recurringUserOptional,
							'student_user_id' in recLesson ? recLesson.student_user_id : firstAgreement.student_user_id,
						);
						const recTypeName =
							'lesson_types' in recLesson
								? recLesson.lesson_types.name
								: (recurringDeviation.agenda_event?.title ?? firstAgreement.lesson_types.name);
						const recTypeColor = 'lesson_types' in recLesson ? recLesson.lesson_types.color : null;
						const recTypeIcon = 'lesson_types' in recLesson ? recLesson.lesson_types.icon : null;
						const recHasTimeOrDateChange =
							!isCancelled &&
							(recurringDeviation.actual_date !== recurringDeviation.original_date ||
								hasTimeChange(
									recurringDeviation.actual_start_time,
									recurringDeviation.original_start_time,
								));

						events.push({
							title: `${recTypeName} - ${recurringStudentName}`,
							start: eventDate,
							end: addMinutes(eventDate, durationMinutes),
							resource: {
								type: 'deviation',
								agreementId: firstAgreement.id,
								eventId,
								deviationId: recurringDeviation.id,
								studentName: recurringStudentName,
								user: recurringUserInfo,
								lessonTypeName: recTypeName,
								lessonTypeColor: recTypeColor,
								lessonTypeIcon: recTypeIcon,
								isDeviation: !isCancelled,
								hasTimeOrDateChange: recHasTimeOrDateChange,
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

				const eventDate = applyTimeToDate(new Date(currentLessonDate), firstAgreement.start_time);

				const title = isGroupLesson
					? `${firstAgreement.lesson_types.name} (${group.length} deelnemers)`
					: `${firstAgreement.lesson_types.name} - ${studentNames[0]}`;

				const users = group
					.map((a) => buildParticipantInfo(a.profiles as UserOptional | null, a.student_user_id))
					.filter((info): info is User => info !== undefined);

				events.push({
					title,
					start: eventDate,
					end: addMinutes(eventDate, durationMinutes),
					resource: {
						type: 'agreement',
						agreementId: firstAgreement.id,
						eventId: eventId ?? undefined,
						studentName: isGroupLesson ? studentNames.join(', ') : studentNames[0],
						user: !isGroupLesson && users.length > 0 ? users[0] : undefined,
						users: isGroupLesson ? users : undefined,
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

function toLessonFrequency(freq: string | null): LessonFrequency {
	if (freq === 'daily' || freq === 'weekly' || freq === 'biweekly' || freq === 'monthly') return freq;
	return 'weekly';
}

/**
 * Generate calendar events from agenda_events (manual events). Uses lessonHelpers for recurrence.
 */
export function generateAgendaEvents(
	agendaEvents: AgendaEventRow[],
	rangeStart: Date,
	rangeEnd: Date,
	deviationsByEventId: Map<string, Map<string, AgendaEventDeviationRow>>,
	recurringByEventId?: Map<string, AgendaEventDeviationRow[]>,
	agreementsMap?: Map<string, LessonAgreementWithStudent>,
): CalendarEvent[] {
	const events: CalendarEvent[] = [];

	for (const ev of agendaEvents) {
		const eventDeviations = deviationsByEventId.get(ev.id);
		const recurringList = recurringByEventId?.get(ev.id) ?? [];

		const isLessonEvent = ev.source_type === 'lesson_agreement' && !!ev.source_id;
		const agreement = isLessonEvent && agreementsMap ? agreementsMap.get(ev.source_id as string) : null;

		if (!ev.recurring || !ev.recurring_frequency) {
			const start = new Date(`${ev.start_date}T${ev.start_time}`);
			const end = ev.end_time
				? new Date(`${ev.end_date ?? ev.start_date}T${ev.end_time}`)
				: addMinutes(start, 60);
			if (start >= rangeStart && start <= rangeEnd) {
				events.push({
					title: ev.title,
					start,
					end,
					resource: {
						type: 'agenda',
						agreementId: ev.source_id ?? ev.id,
						eventId: ev.id,
						studentName: ev.title,
						lessonTypeName: ev.title,
						lessonTypeColor: ev.color ?? null,
						lessonTypeIcon: null,
						isDeviation: false,
						isCancelled: false,
						isGroupLesson: false,
						sourceType: ev.source_type as 'manual' | 'lesson_agreement',
						color: ev.color ?? null,
						isLesson: isLessonEvent,
					},
				});
			}
			continue;
		}

		const frequency = agreement ? agreement.frequency : toLessonFrequency(ev.recurring_frequency);
		const dayOfWeek = agreement ? agreement.day_of_week : new Date(ev.start_date + 'T12:00:00').getDay();
		const periodStart = agreement ? new Date(agreement.start_date) : new Date(ev.start_date);
		const periodEnd = agreement
			? agreement.end_date
				? new Date(agreement.end_date)
				: null
			: ev.recurring_end_date
				? new Date(ev.recurring_end_date)
				: null;
		const baseStartTime = agreement ? agreement.start_time : ev.start_time;
		const durationMinutes = agreement ? agreement.duration_minutes : null;

		const getDurationMs = (): number => {
			if (durationMinutes != null) return durationMinutes * 60 * 1000;
			if (ev.end_time && ev.start_time) {
				const startDate = new Date(`2000-01-01T${ev.start_time}`);
				const endDate = new Date(`2000-01-01T${ev.end_time}`);
				return endDate.getTime() - startDate.getTime();
			}
			return 60 * 60 * 1000;
		};

		const current = getFirstOccurrenceInRangeHelper(dayOfWeek, rangeStart, periodStart, frequency);
		while (current <= rangeEnd) {
			if (current < periodStart) {
				addIntervalHelper(current, frequency);
				continue;
			}
			if (periodEnd && current > periodEnd) break;

			const dateStr = formatDateToDb(current);
			const deviation = eventDeviations?.get(dateStr);
			const recurringDeviation = recurringList.find(
				(d) => d.original_date <= dateStr && (!d.recurring_end_date || d.recurring_end_date >= dateStr),
			);

			const effective = deviation ?? recurringDeviation;
			let start: Date;
			let end: Date;
			let isCancelled = false;

			if (effective?.is_cancelled) {
				isCancelled = true;
				start = applyTimeToDate(new Date(current), effective.original_start_time);
				end =
					durationMinutes != null
						? addMinutes(start, durationMinutes)
						: ev.end_time
							? applyTimeToDate(start, ev.end_time)
							: addMinutes(start, 60);
			} else if (effective) {
				const [h, m] = effective.actual_start_time.split(':').map(Number);
				let actualDate: Date;
				if (effective.recurring) {
					const originalDate = new Date(effective.original_date + 'T12:00:00');
					const occurrenceIndex = getOccurrenceIndex(originalDate, current, frequency);
					actualDate = addNIntervals(
						new Date(effective.actual_date + 'T12:00:00'),
						occurrenceIndex,
						frequency,
					);
				} else {
					actualDate = new Date(effective.actual_date + 'T12:00:00');
				}
				actualDate.setHours(h, m ?? 0, 0, 0);
				start = actualDate;
				end = addMinutes(start, getDurationMs() / (60 * 1000));
			} else {
				start = applyTimeToDate(new Date(current), baseStartTime);
				end =
					durationMinutes != null
						? addMinutes(start, durationMinutes)
						: ev.end_time
							? applyTimeToDate(new Date(current), ev.end_time)
							: addMinutes(start, 60);
			}

			const resourceOriginalDate = effective?.recurring ? dateStr : effective?.original_date;
			const resourceOriginalStartTime = effective?.recurring ? baseStartTime : effective?.original_start_time;
			const displayTitle = effective?.title ?? ev.title;
			const displayColor = effective?.color ?? ev.color ?? null;
			const hasTimeOrDateChange =
				!!effective &&
				!effective.is_cancelled &&
				(effective.actual_date !== effective.original_date ||
					hasTimeChange(effective.actual_start_time, effective.original_start_time));

			events.push({
				title: displayTitle,
				start,
				end,
				resource: {
					type: 'agenda',
					agreementId: ev.source_id ?? ev.id,
					eventId: ev.id,
					deviationId: effective?.id,
					studentName: displayTitle,
					lessonTypeName: displayTitle,
					lessonTypeColor: displayColor,
					lessonTypeIcon: null,
					isDeviation: !!effective && !effective.is_cancelled,
					hasTimeOrDateChange,
					isCancelled,
					isGroupLesson: false,
					originalDate: resourceOriginalDate ?? effective?.original_date,
					originalStartTime: resourceOriginalStartTime ?? effective?.original_start_time,
					reason: effective?.reason ?? null,
					isRecurring: ev.recurring || (effective?.recurring ?? false),
					sourceType: ev.source_type as 'manual' | 'lesson_agreement',
					color: displayColor,
					isLesson: isLessonEvent,
				},
			});

			addIntervalHelper(current, frequency);
		}
	}

	return events;
}
