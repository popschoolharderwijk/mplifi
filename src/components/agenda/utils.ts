import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { Formats } from 'react-big-calendar';
import { formatDateToDb, formatDbDateLong, getDateForDayOfWeek } from '@/lib/date/date-format';
import {
	addInterval as addIntervalHelper,
	addNIntervals,
	getFirstOccurrenceInRange as getFirstOccurrenceInRangeHelper,
	getOccurrenceIndex,
} from '@/lib/lessonHelpers';
import { formatTime } from '@/lib/time/time-format';
import type { AgendaEventDeviationRow, AgendaEventRow } from '@/types/agenda-events';
import type {
	LessonAgreementWithStudent,
	LessonAppointmentDeviationWithAgreement,
	LessonFrequency,
} from '@/types/lesson-agreements';
import type { User, UserOptional } from '@/types/users';
import type { CalendarEvent } from './types';

/** Extract display name from profile (first_name, last_name, optionally email). */
export function formatUserName(profile?: UserOptional | null): string {
	if (!profile) return 'Onbekend';
	if (profile.first_name && profile.last_name) return `${profile.first_name} ${profile.last_name}`;
	return profile.first_name ?? profile.last_name ?? profile.email ?? 'Onbekend';
}

/** Build User from profile and user_id. */
export function buildParticipantInfo(profile: UserOptional | null | undefined, userId: string): User | undefined {
	if (!profile || !profile.email) return undefined;
	return {
		user_id: userId,
		first_name: profile.first_name ?? null,
		last_name: profile.last_name ?? null,
		email: profile.email,
		avatar_url: profile.avatar_url ?? null,
		phone_number: profile.phone_number ?? null,
	};
}

/** Date in the same week as originalDateStr with the same weekday as referenceDate (YYYY-MM-DD). */
export function getActualDateInOriginalWeek(originalDateStr: string, referenceDate: Date): string {
	const originalDate = new Date(originalDateStr + 'T12:00:00');
	const targetDayOfWeek = referenceDate.getDay();
	const actualDate = getDateForDayOfWeek(targetDayOfWeek, originalDate);
	return formatDateToDb(actualDate);
}

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

function getFrequency(agreement: LessonAgreementWithStudent): LessonFrequency {
	return agreement.frequency;
}

/** First occurrence date in range for the given agreement and frequency (uses lessonHelpers). */
function getFirstOccurrenceInRange(
	agreement: LessonAgreementWithStudent,
	rangeStart: Date,
	frequency: LessonFrequency,
): Date {
	const periodStart = new Date(agreement.start_date);
	return getFirstOccurrenceInRangeHelper(agreement.day_of_week, rangeStart, periodStart, frequency);
}

/** Advance date by one interval (uses lessonHelpers). */
function addInterval(date: Date, frequency: LessonFrequency): void {
	addIntervalHelper(date, frequency);
}

function getGroupingKey(agreement: LessonAgreementWithStudent, frequency: LessonFrequency): string {
	const base = `${agreement.start_time}-${agreement.lesson_type_id}-${frequency}`;
	if (frequency === 'weekly') {
		return `${agreement.day_of_week}-${base}`;
	}
	if (frequency === 'daily') {
		return base;
	}
	return `${agreement.start_date}-${base}`;
}

/** Find recurring deviation for this event that applies to occurrenceDate. */
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
	recurringByEventId?: Map<string, LessonAppointmentDeviationWithAgreement[]>,
	eventIdByAgreementId?: Map<string, string>,
): CalendarEvent[] {
	const events: CalendarEvent[] = [];
	const getEventId = (agreementId: string) => eventIdByAgreementId?.get(agreementId);

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
		const durationMinutes = firstAgreement.duration_minutes;
		const eventId = getEventId(firstAgreement.id);

		const studentNames = group.map((a) => formatUserName(a.profiles));

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
						const [hours, minutes] = isCancelled
							? deviation.original_start_time.split(':')
							: deviation.actual_start_time.split(':');
						const eventDate = new Date(isCancelled ? deviation.original_date : deviation.actual_date);
						eventDate.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

						const actualDayOfWeek = new Date(deviation.actual_date).getDay();
						const actualTimeNormalized = deviation.actual_start_time.substring(0, 5);
						const agreementTimeNormalized = firstAgreement.start_time.substring(0, 5);
						const isEffectivelyOriginal =
							!isCancelled &&
							actualDayOfWeek === firstAgreement.day_of_week &&
							actualTimeNormalized === agreementTimeNormalized;

						const lesson = deviation.lesson_agreement ?? firstAgreement;
						const deviationUserOptional = lesson.profiles as UserOptional | null;
						const deviationStudentName = formatUserName(deviationUserOptional);
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

						events.push({
							title: `${lessonTypeName} - ${deviationStudentName}`,
							start: eventDate,
							end: new Date(eventDate.getTime() + durationMinutes * 60 * 1000),
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

					const recurringDeviation =
						recurringByEventId && eventId
							? getRecurringDeviationForDate(recurringByEventId, eventId, lessonDateStr)
							: undefined;
					if (recurringDeviation) {
						const isCancelled = recurringDeviation.is_cancelled;
						const [hours, minutes] = recurringDeviation.actual_start_time.split(':');
						const actualDayOfWeek = new Date(recurringDeviation.actual_date).getDay();
						const eventDate = getDateForDayOfWeek(actualDayOfWeek, currentLessonDate);
						eventDate.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

						const recLesson = recurringDeviation.lesson_agreement ?? firstAgreement;
						const recurringUserOptional = recLesson.profiles as UserOptional | null;
						const recurringStudentName = formatUserName(recurringUserOptional);
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

						events.push({
							title: `${recTypeName} - ${recurringStudentName}`,
							start: eventDate,
							end: new Date(eventDate.getTime() + durationMinutes * 60 * 1000),
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

				const users = group
					.map((a) => buildParticipantInfo(a.profiles as UserOptional | null, a.student_user_id))
					.filter((info): info is User => info !== undefined);

				events.push({
					title,
					start: eventDate,
					end: new Date(eventDate.getTime() + durationMinutes * 60 * 1000),
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

/** Recurring frequency string (from agenda_events) to LessonFrequency. */
function toLessonFrequency(freq: string | null): LessonFrequency {
	if (freq === 'daily' || freq === 'weekly' || freq === 'biweekly' || freq === 'monthly') return freq;
	return 'weekly';
}

/**
 * Generate calendar events from agenda_events (manual events). Uses lessonHelpers for recurrence.
 * Deviations are keyed by event_id; recurring deviations by event_id.
 * For lesson events (source_type === 'lesson_agreement'), schedule data is taken from the agreement.
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
				: new Date(start.getTime() + 60 * 60 * 1000);
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
				(d) => d.original_date <= dateStr && (d.recurring_end_date === null || d.recurring_end_date >= dateStr),
			);

			const effective = deviation ?? recurringDeviation;
			let start: Date;
			let end: Date;
			let isCancelled = false;

			const getDurationMs = (): number => {
				if (durationMinutes) {
					return durationMinutes * 60 * 1000;
				}
				if (ev.end_time && ev.start_time) {
					const [sh, sm] = ev.start_time.split(':').map(Number);
					const [eh, em] = ev.end_time.split(':').map(Number);
					return (eh * 60 + em - (sh * 60 + sm)) * 60 * 1000;
				}
				return 60 * 60 * 1000;
			};

			const calcEndFromStart = (startDate: Date): Date => new Date(startDate.getTime() + getDurationMs());

			const calcEndTimeSameDay = (startDate: Date, baseDate: Date): Date => {
				if (durationMinutes) {
					return new Date(startDate.getTime() + durationMinutes * 60 * 1000);
				}
				if (ev.end_time) {
					const [eh, em] = ev.end_time.split(':');
					const endDate = new Date(baseDate);
					endDate.setHours(Number.parseInt(eh, 10), Number.parseInt(em, 10), 0, 0);
					return endDate;
				}
				return new Date(startDate.getTime() + 60 * 60 * 1000);
			};

			if (effective?.is_cancelled) {
				isCancelled = true;
				const [h, m] = effective.original_start_time.split(':');
				start = new Date(current);
				start.setHours(Number.parseInt(h, 10), Number.parseInt(m, 10), 0, 0);
				end = calcEndTimeSameDay(start, current);
			} else if (effective) {
				const [h, m] = effective.actual_start_time.split(':');
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
				actualDate.setHours(Number.parseInt(h, 10), Number.parseInt(m, 10), 0, 0);
				start = actualDate;
				end = calcEndFromStart(start);
			} else {
				const [h, m] = baseStartTime.split(':');
				start = new Date(current);
				start.setHours(Number.parseInt(h, 10), Number.parseInt(m, 10), 0, 0);
				if (durationMinutes) {
					end = new Date(start.getTime() + durationMinutes * 60 * 1000);
				} else if (ev.end_time) {
					const [eh, em] = ev.end_time.split(':');
					end = new Date(current);
					end.setHours(Number.parseInt(eh, 10), Number.parseInt(em, 10), 0, 0);
				} else {
					end = new Date(start.getTime() + 60 * 60 * 1000);
				}
			}

			const resourceOriginalDate = effective?.recurring ? dateStr : effective?.original_date;
			const resourceOriginalStartTime = effective?.recurring ? baseStartTime : effective?.original_start_time;
			const displayTitle = effective?.title ?? ev.title;
			const displayColor = effective?.color ?? ev.color ?? null;

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
		sourceType,
		participantCount,
		participantNames,
		isLesson,
		teacherName,
		viewerIsTeacher,
	} = event.resource;

	const lines: string[] = [lessonTypeName];

	if (isLesson && !isGroupLesson) {
		const otherPartyName = viewerIsTeacher ? studentName : (teacherName ?? studentName);
		lines.push(otherPartyName);
	} else if (isGroupLesson) {
		lines.push(`${studentCount} deelnemers:`);
		const students = studentName.split(', ');
		for (const student of students) {
			lines.push(`  • ${student}`);
		}
	} else if ((participantCount ?? 0) > 1 && participantNames?.length) {
		lines.push(`${participantCount} deelnemers:`);
		for (const name of participantNames) {
			lines.push(`  • ${name}`);
		}
	} else {
		lines.push(studentName);
	}

	if (isCancelled) {
		lines.push('');
		const cancelledLabel = sourceType === 'lesson_agreement' ? '❌ Les vervallen' : '❌ Afspraak vervallen';
		lines.push(cancelledLabel);
		if (reason) {
			lines.push(`Reden: ${reason}`);
		}
	} else if (isDeviation) {
		lines.push('');
		lines.push('⚠ Gewijzigde afspraak');
		if (originalDate && originalStartTime) {
			lines.push(`Origineel: ${formatDbDateLong(originalDate)} om ${formatTime(originalStartTime)}`);
		}
		if (reason) {
			lines.push(`Reden: ${reason}`);
		}
	}

	return lines.join('\n');
}
