/**
 * Unit tests for agenda utils: date helpers, recurrence intervals, recurring deviations,
 * profile formatting, tooltip generation, and event styling.
 * No database required; tests pure logic.
 */
import { describe, expect, it } from 'bun:test';
import { agendaMessages, getEventStyle } from '../../src/components/agenda/agenda-calendar-config';
import type { CalendarEvent, CalendarEventResource } from '../../src/components/agenda/types';
import {
	buildParticipantInfo,
	buildTooltipText,
	formatUserName,
	generateRecurringEvents,
	getActualDateInOriginalWeek,
} from '../../src/components/agenda/utils';
import { formatDateToDb, getDateForDayOfWeek } from '../../src/lib/date/date-format';
import type {
	LessonAgreementWithStudent,
	LessonAppointmentDeviationWithAgreement,
} from '../../src/types/lesson-agreements';
import { expectNonNull } from '../utils';
import { AGENDA_UTILS_TEST } from './agenda-test-constants';

describe('agenda utils: getDateForDayOfWeek', () => {
	it('returns same day when reference is already that weekday', () => {
		const ref = new Date('2025-02-17T12:00:00'); // Monday
		const result = getDateForDayOfWeek(1, ref);
		expect(formatDateToDb(result)).toBe('2025-02-17');
	});

	it('returns next Monday when reference is Wednesday', () => {
		const ref = new Date('2025-02-19T12:00:00'); // Wed
		const result = getDateForDayOfWeek(1, ref); // Monday
		expect(formatDateToDb(result)).toBe('2025-02-17');
	});

	it('returns Thursday in same week when reference is Monday', () => {
		const ref = new Date('2025-02-17T12:00:00'); // Monday
		const result = getDateForDayOfWeek(4, ref); // Thursday
		expect(formatDateToDb(result)).toBe('2025-02-20');
	});
});

const defaultLessonTypes = {
	id: 'lt-1',
	name: 'Piano',
	icon: 'piano',
	color: '#10b981',
	is_group_lesson: false,
};

function mockAgreement(overrides: Partial<LessonAgreementWithStudent> = {}): LessonAgreementWithStudent {
	const { lesson_types: lt, ...rest } = overrides;
	return {
		id: 'agreement-1',
		day_of_week: 1,
		start_time: '14:00',
		start_date: '2025-02-01',
		end_date: null,
		is_active: true,
		student_user_id: 'user-1',
		lesson_type_id: 'lt-1',
		duration_minutes: 30,
		frequency: 'weekly',
		price_per_lesson: 30,
		profiles: { first_name: 'Jan', last_name: 'Jansen', email: 'jan@example.com' },
		lesson_types: { ...defaultLessonTypes, ...lt },
		...rest,
	};
}

const defaultEventId = 'event-1';

function mockDeviation(
	overrides: Partial<{
		id: string;
		event_id: string;
		original_date: string;
		original_start_time: string;
		actual_date: string;
		actual_start_time: string;
		is_cancelled: boolean;
		recurring: boolean;
		recurring_end_date: string | null;
	}> = {},
): LessonAppointmentDeviationWithAgreement {
	const agreementId = 'agreement-1';
	const eventId = overrides.event_id ?? defaultEventId;
	const agreement = mockAgreement({ id: agreementId });
	return {
		id: 'dev-1',
		event_id: eventId,
		original_date: '2025-02-17',
		original_start_time: '14:00',
		actual_date: '2025-02-20',
		actual_start_time: '15:00',
		is_cancelled: false,
		recurring: false,
		recurring_end_date: null,
		reason: null,
		created_at: '2025-01-01T00:00:00Z',
		created_by: 'user-1',
		updated_by: 'user-1',
		updated_at: '2025-01-01T00:00:00Z',
		...overrides,
		agenda_event: {
			id: eventId,
			source_id: agreementId,
			start_time: '14:00',
		} as LessonAppointmentDeviationWithAgreement['agenda_event'],
		lesson_agreement: agreement,
	} as LessonAppointmentDeviationWithAgreement;
}

const eventIdByAgreementId = new Map<string, string>([['agreement-1', defaultEventId]]);

describe('agenda utils: generateRecurringEvents', () => {
	it('generates weekly events (default frequency)', () => {
		const agreement = mockAgreement({
			start_date: '2025-02-01',
			end_date: '2025-02-28',
		});
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-02-28');
		const events = generateRecurringEvents(
			[agreement],
			rangeStart,
			rangeEnd,
			new Map(),
			undefined,
			eventIdByAgreementId,
		);
		const mondays = events.filter((e: CalendarEvent) => e.start && new Date(e.start).getDay() === 1);
		expect(mondays.length).toBe(4); // 4 Mondays in Feb 2025
	});

	it('generates biweekly events when frequency is biweekly', () => {
		const agreement = mockAgreement({
			start_date: '2025-02-03',
			end_date: '2025-03-31',
			frequency: 'biweekly',
		});
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-03-31');
		const events = generateRecurringEvents(
			[agreement],
			rangeStart,
			rangeEnd,
			new Map(),
			undefined,
			eventIdByAgreementId,
		);
		const eventDates = events.map((e: CalendarEvent) => (e.start ? formatDateToDb(e.start) : ''));
		expect(eventDates).toContain('2025-02-03');
		expect(eventDates).toContain('2025-02-17');
		expect(eventDates).toContain('2025-03-03');
		expect(eventDates).toContain('2025-03-17');
		expect(eventDates).toContain('2025-03-31');
	});

	it('generates daily events when frequency is daily', () => {
		const agreement = mockAgreement({
			start_date: '2025-02-10',
			end_date: '2025-02-14',
			frequency: 'daily',
		});
		const rangeStart = new Date('2025-02-10');
		const rangeEnd = new Date('2025-02-14');
		const events = generateRecurringEvents(
			[agreement],
			rangeStart,
			rangeEnd,
			new Map(),
			undefined,
			eventIdByAgreementId,
		);
		expect(events.length).toBe(AGENDA_UTILS_TEST.DAILY_EVENTS_FEB_10_14);
	});

	it('uses exact deviation when present for that date', () => {
		const agreement = mockAgreement({ id: 'ag-1' });
		const evId = 'ev-ag-1';
		const deviation = mockDeviation({
			event_id: evId,
			original_date: '2025-02-17',
			actual_date: '2025-02-20',
			actual_start_time: '16:00',
		});
		const deviationsMap = new Map<string, LessonAppointmentDeviationWithAgreement>();
		deviationsMap.set(`${evId}-2025-02-17`, deviation);
		const eventIdMap = new Map([['ag-1', evId]]);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-02-28');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, deviationsMap, undefined, eventIdMap);
		const devEvent = events.find(
			(e: CalendarEvent) => e.resource.type === 'deviation' && e.resource.originalDate === '2025-02-17',
		);
		expectNonNull(devEvent);
		expect(devEvent.resource.isDeviation).toBe(true);
		expectNonNull(devEvent.start);
		expect(new Date(devEvent.start).getHours()).toBe(16);
	});

	it('applies recurring deviation to future occurrences', () => {
		const agreement = mockAgreement({ id: 'ag-1', start_date: '2025-02-01', end_date: '2025-03-31' });
		const evId = 'ev-ag-1';
		const recurringDeviation = mockDeviation({
			id: 'dev-recurring',
			event_id: evId,
			original_date: '2025-02-17',
			actual_date: '2025-02-20',
			actual_start_time: '15:00',
			recurring: true,
		});
		const recurringByEventId = new Map<string, LessonAppointmentDeviationWithAgreement[]>();
		recurringByEventId.set(evId, [recurringDeviation]);
		const eventIdMap = new Map([['ag-1', evId]]);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-03-31');
		const events = generateRecurringEvents(
			[agreement],
			rangeStart,
			rangeEnd,
			new Map(),
			recurringByEventId,
			eventIdMap,
		);
		const recurringEvents = events.filter((e: CalendarEvent) => e.resource.isRecurring === true);
		expect(recurringEvents).toHaveLength(AGENDA_UTILS_TEST.RECURRING_DEVIATION_EVENTS_FEB_MAR_APR);
		expect(recurringEvents.every((e: CalendarEvent) => e.resource.deviationId === 'dev-recurring')).toBe(true);
	});

	it('recurring deviation with recurring_end_date does not apply after that date', () => {
		const agreement = mockAgreement({
			id: 'ag-1',
			start_date: '2025-02-01',
			end_date: '2025-03-31',
			day_of_week: 1,
			start_time: '14:00',
		});
		const evId = 'ev-ag-1';
		const recurringDeviation = mockDeviation({
			id: 'dev-recurring',
			event_id: evId,
			original_date: '2025-02-17',
			actual_date: '2025-02-20',
			actual_start_time: '15:00',
			recurring: true,
			recurring_end_date: '2025-03-02',
		});
		const recurringByEventId = new Map<string, LessonAppointmentDeviationWithAgreement[]>();
		recurringByEventId.set(evId, [recurringDeviation]);
		const eventIdMap = new Map([['ag-1', evId]]);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-03-31');
		const events = generateRecurringEvents(
			[agreement],
			rangeStart,
			rangeEnd,
			new Map(),
			recurringByEventId,
			eventIdMap,
		);
		const weekAfterEnd = events.find((e: CalendarEvent) => e.start && formatDateToDb(e.start) === '2025-03-10');
		expectNonNull(weekAfterEnd);
		expect(weekAfterEnd.resource.type).toBe('agreement');
		expect(weekAfterEnd.resource.isDeviation).toBe(false);
	});

	it('recurring deviation with recurring_end_date still applies up to and including that date', () => {
		const agreement = mockAgreement({
			id: 'ag-1',
			start_date: '2025-02-01',
			end_date: '2025-03-31',
			day_of_week: 1,
			start_time: '14:00',
		});
		const evId = 'ev-ag-1';
		const recurringDeviation = mockDeviation({
			id: 'dev-recurring',
			event_id: evId,
			original_date: '2025-02-17',
			actual_date: '2025-02-20',
			actual_start_time: '15:00',
			recurring: true,
			recurring_end_date: '2025-03-02',
		});
		const recurringByEventId = new Map<string, LessonAppointmentDeviationWithAgreement[]>();
		recurringByEventId.set(evId, [recurringDeviation]);
		const eventIdMap = new Map([['ag-1', evId]]);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-03-31');
		const events = generateRecurringEvents(
			[agreement],
			rangeStart,
			rangeEnd,
			new Map(),
			recurringByEventId,
			eventIdMap,
		);
		const deviationEvents = events.filter(
			(e: CalendarEvent) => e.resource.deviationId === 'dev-recurring' && e.resource.isRecurring === true,
		);
		expect(deviationEvents).toHaveLength(AGENDA_UTILS_TEST.DEVIATION_EVENTS_UNTIL_2025_03_02);
		const lastDeviationEvent = deviationEvents[deviationEvents.length - 1];
		const lastDateStr = lastDeviationEvent.start ? formatDateToDb(lastDeviationEvent.start) : '';
		expect(lastDateStr).toBe('2025-02-27');
		expect(lastDeviationEvent.resource.type).toBe('deviation');
	});

	it('deviation that restores to agreement slot is shown as agreement (green, not deviation)', () => {
		const agreement = mockAgreement({
			id: 'ag-1',
			day_of_week: 1,
			start_time: '14:00',
		});
		const evId = 'ev-ag-1';
		const deviation = mockDeviation({
			event_id: evId,
			original_date: '2025-02-17',
			original_start_time: '14:00:01',
			actual_date: '2025-02-17',
			actual_start_time: '14:00:00',
		});
		const deviationsMap = new Map<string, LessonAppointmentDeviationWithAgreement>();
		deviationsMap.set(`${evId}-2025-02-17`, deviation);
		const eventIdMap = new Map([['ag-1', evId]]);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-02-28');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, deviationsMap, undefined, eventIdMap);
		const event = events.find(
			(e: CalendarEvent) => e.start && e.resource.type !== undefined && formatDateToDb(e.start) === '2025-02-17',
		);
		expectNonNull(event);
		expect(event.resource.type).toBe('agreement');
		expect(event.resource.isDeviation).toBe(false);
	});

	it('generates monthly events when frequency is monthly', () => {
		const agreement = mockAgreement({
			start_date: '2025-01-06',
			end_date: '2025-04-30',
			frequency: 'monthly',
			day_of_week: 1,
		});
		const rangeStart = new Date('2025-01-01');
		const rangeEnd = new Date('2025-04-30');
		const events = generateRecurringEvents(
			[agreement],
			rangeStart,
			rangeEnd,
			new Map(),
			undefined,
			eventIdByAgreementId,
		);
		expect(events.length).toBe(AGENDA_UTILS_TEST.MONTHLY_EVENTS_JAN_6_APR_30);
	});

	it('cancelled deviation shows isCancelled flag', () => {
		const agreement = mockAgreement({ id: 'ag-1' });
		const evId = 'ev-ag-1';
		const deviation = mockDeviation({
			event_id: evId,
			original_date: '2025-02-17',
			is_cancelled: true,
		});
		const deviationsMap = new Map<string, LessonAppointmentDeviationWithAgreement>();
		deviationsMap.set(`${evId}-2025-02-17`, deviation);
		const eventIdMap = new Map([['ag-1', evId]]);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-02-28');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, deviationsMap, undefined, eventIdMap);
		const cancelledEvent = events.find((e: CalendarEvent) => e.start && formatDateToDb(e.start) === '2025-02-17');
		expectNonNull(cancelledEvent);
		expect(cancelledEvent.resource.isCancelled).toBe(true);
	});
});

describe('agenda utils: formatUserName', () => {
	it('returns full name when first and last name are present', () => {
		const profile = { first_name: 'Jan', last_name: 'Jansen', email: 'jan@example.com' };
		expect(formatUserName(profile)).toBe('Jan Jansen');
	});

	it('returns first name only when last name is missing', () => {
		const profile = { first_name: 'Jan', last_name: null, email: 'jan@example.com' };
		expect(formatUserName(profile)).toBe('Jan');
	});

	it('returns email when names are missing', () => {
		const profile = { first_name: null, last_name: null, email: 'jan@example.com' };
		expect(formatUserName(profile)).toBe('jan@example.com');
	});

	it('returns "Onbekend" when profile is null', () => {
		expect(formatUserName(null)).toBe('Onbekend');
	});

	it('returns "Onbekend" when profile is undefined', () => {
		expect(formatUserName(undefined)).toBe('Onbekend');
	});

	it('returns "Onbekend" when all fields are null', () => {
		const profile = { first_name: null, last_name: null, email: null };
		expect(formatUserName(profile)).toBe('Onbekend');
	});
});

describe('agenda utils: buildParticipantInfo', () => {
	it('returns User when profile has email', () => {
		const profile = {
			first_name: 'Jan',
			last_name: 'Jansen',
			email: 'jan@example.com',
			avatar_url: 'http://avatar.jpg',
		};
		const result = buildParticipantInfo(profile, 'user-123');
		expectNonNull(result);
		expect(result.user_id).toBe('user-123');
		expect(result.first_name).toBe('Jan');
		expect(result.last_name).toBe('Jansen');
		expect(result.email).toBe('jan@example.com');
		expect(result.avatar_url).toBe('http://avatar.jpg');
	});

	it('returns undefined when profile is null', () => {
		expect(buildParticipantInfo(null, 'user-123')).toBeUndefined();
	});

	it('returns undefined when profile has no email', () => {
		const profile = { first_name: 'Jan', last_name: 'Jansen', email: null };
		expect(buildParticipantInfo(profile, 'user-123')).toBeUndefined();
	});

	it('returns null avatar_url when not provided', () => {
		const profile = { first_name: 'Jan', last_name: 'Jansen', email: 'jan@example.com' };
		const result = buildParticipantInfo(profile, 'user-123');
		expectNonNull(result);
		expect(result.avatar_url).toBeNull();
	});
});

describe('agenda utils: getActualDateInOriginalWeek', () => {
	it('returns correct date for same weekday', () => {
		const result = getActualDateInOriginalWeek('2025-02-17', new Date('2025-02-24T12:00:00')); // Both Mondays
		expect(result).toBe('2025-02-17');
	});

	it('returns Thursday in original week when reference is Thursday', () => {
		const result = getActualDateInOriginalWeek('2025-02-17', new Date('2025-02-20T12:00:00')); // Thursday
		expect(result).toBe('2025-02-20');
	});
});

function mockCalendarEventResource(overrides: Partial<CalendarEventResource> = {}): CalendarEventResource {
	return {
		type: 'agreement',
		agreementId: 'ag-1',
		studentName: 'Jan Jansen',
		lessonTypeName: 'Piano',
		lessonTypeColor: '#10b981',
		lessonTypeIcon: 'piano',
		isDeviation: false,
		isCancelled: false,
		isGroupLesson: false,
		...overrides,
	};
}

function mockCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		title: 'Piano - Jan Jansen',
		start: new Date('2025-02-17T14:00:00'),
		end: new Date('2025-02-17T14:30:00'),
		resource: mockCalendarEventResource(overrides.resource),
		...overrides,
	};
}

describe('agenda utils: buildTooltipText', () => {
	it('shows lesson type and student name for normal lesson', () => {
		const event = mockCalendarEvent();
		const tooltip = buildTooltipText(event);
		expect(tooltip).toContain('Piano');
		expect(tooltip).toContain('Jan Jansen');
	});

	it('shows teacher name for student view (viewerIsTeacher=false)', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({
				isLesson: true,
				teacherName: 'Docent Piet',
				viewerIsTeacher: false,
			}),
		});
		const tooltip = buildTooltipText(event);
		expect(tooltip).toContain('Docent Piet');
	});

	it('shows student name for teacher view (viewerIsTeacher=true)', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({
				isLesson: true,
				teacherName: 'Docent Piet',
				viewerIsTeacher: true,
			}),
		});
		const tooltip = buildTooltipText(event);
		expect(tooltip).toContain('Jan Jansen');
		expect(tooltip).not.toContain('Docent Piet');
	});

	it('shows cancelled label for cancelled lesson', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({
				isCancelled: true,
				sourceType: 'lesson_agreement',
			}),
		});
		const tooltip = buildTooltipText(event);
		expect(tooltip).toContain('❌ Les vervallen');
	});

	it('shows cancelled label for cancelled manual event', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({
				isCancelled: true,
				sourceType: 'manual',
			}),
		});
		const tooltip = buildTooltipText(event);
		expect(tooltip).toContain('❌ Afspraak vervallen');
	});

	it('shows deviation warning for moved event', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({
				isDeviation: true,
				originalDate: '2025-02-17',
				originalStartTime: '14:00',
			}),
		});
		const tooltip = buildTooltipText(event);
		expect(tooltip).toContain('⚠ Gewijzigde afspraak');
		expect(tooltip).toContain('Origineel:');
	});

	it('shows reason when provided for deviation', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({
				isDeviation: true,
				originalDate: '2025-02-17',
				originalStartTime: '14:00',
				reason: 'Ziek',
			}),
		});
		const tooltip = buildTooltipText(event);
		expect(tooltip).toContain('Reden: Ziek');
	});

	it('shows group lesson participants', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({
				isGroupLesson: true,
				studentCount: 3,
				studentName: 'Jan, Piet, Klaas',
			}),
		});
		const tooltip = buildTooltipText(event);
		expect(tooltip).toContain('3 deelnemers:');
		expect(tooltip).toContain('• Jan');
		expect(tooltip).toContain('• Piet');
		expect(tooltip).toContain('• Klaas');
	});

	it('shows multiple participants for manual event', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({
				type: 'agenda',
				participantCount: 2,
				participantNames: ['Jan Jansen', 'Piet Pietersen'],
			}),
		});
		const tooltip = buildTooltipText(event);
		expect(tooltip).toContain('2 deelnemers:');
		expect(tooltip).toContain('• Jan Jansen');
		expect(tooltip).toContain('• Piet Pietersen');
	});
});

describe('agenda-calendar-config: agendaMessages', () => {
	it('contains all required Dutch messages', () => {
		expect(agendaMessages.next).toBe('Volgende');
		expect(agendaMessages.previous).toBe('Vorige');
		expect(agendaMessages.today).toBe('Vandaag');
		expect(agendaMessages.month).toBe('Maand');
		expect(agendaMessages.week).toBe('Week');
		expect(agendaMessages.day).toBe('Dag');
		expect(agendaMessages.agenda).toBe('Agenda');
		expect(agendaMessages.date).toBe('Datum');
		expect(agendaMessages.time).toBe('Tijd');
		expect(agendaMessages.event).toBe('Afspraak');
		expect(agendaMessages.noEventsInRange).toBe('Geen afspraken in dit bereik');
	});

	it('showMore returns correct format', () => {
		expect(agendaMessages.showMore(5)).toBe('+5 meer');
		expect(agendaMessages.showMore(10)).toBe('+10 meer');
	});
});

describe('agenda-calendar-config: getEventStyle', () => {
	it('returns transparent style for agenda view', () => {
		const event = mockCalendarEvent();
		const style = getEventStyle(event, 'agenda');
		expect(style.style.backgroundColor).toBe('transparent');
		expect(style.style.opacity).toBe(1);
	});

	it('returns custom color when provided', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({ color: '#ff0000' }),
		});
		const style = getEventStyle(event, 'week');
		expect(style.style.backgroundColor).toBe('#ff0000');
	});

	it('returns lessonTypeColor when no custom color', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({ color: null, lessonTypeColor: '#00ff00' }),
		});
		const style = getEventStyle(event, 'week');
		expect(style.style.backgroundColor).toBe('#00ff00');
	});

	it('returns group lesson color for group lessons', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({ isGroupLesson: true, color: null, lessonTypeColor: null }),
		});
		const style = getEventStyle(event, 'week');
		expect(style.style.backgroundColor).toBe('#6366f1');
	});

	it('returns agenda event color for manual events', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({ type: 'agenda', color: null, lessonTypeColor: null }),
		});
		const style = getEventStyle(event, 'week');
		expect(style.style.backgroundColor).toBe('#3b82f6');
	});

	it('returns agreement color for lesson agreements', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({ type: 'agreement', color: null, lessonTypeColor: null }),
		});
		const style = getEventStyle(event, 'week');
		expect(style.style.backgroundColor).toBe('#10b981');
	});

	it('returns reduced opacity for cancelled events', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({ isCancelled: true }),
		});
		const style = getEventStyle(event, 'week');
		expect(style.style.opacity).toBe(0.45);
	});

	it('returns reduced opacity for pending events', () => {
		const event = mockCalendarEvent({
			resource: mockCalendarEventResource({ isPending: true }),
		});
		const style = getEventStyle(event, 'week');
		expect(style.style.opacity).toBe(0.5);
		expect(style.style.borderStyle).toBe('dashed');
	});

	it('returns solid border for normal events', () => {
		const event = mockCalendarEvent();
		const style = getEventStyle(event, 'week');
		expect(style.style.borderStyle).toBe('solid');
	});
});
