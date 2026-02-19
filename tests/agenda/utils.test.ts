/**
 * Unit tests for agenda utils: date helpers, recurrence intervals, and recurring deviations.
 * No database required; tests pure logic.
 */
import { describe, expect, it } from 'bun:test';
import { generateRecurringEvents, getActualDateInOriginalWeek } from '../../src/components/teachers/agenda/utils';
import { getDateForDayOfWeek } from '../../src/lib/date/date-format';
import type {
	LessonAgreementWithStudent,
	LessonAppointmentDeviationWithAgreement,
} from '../../src/types/lesson-agreements';

describe('agenda utils: getDateForDayOfWeek', () => {
	it('returns same day when reference is already that weekday', () => {
		const ref = new Date('2025-02-17T12:00:00'); // Monday
		const result = getDateForDayOfWeek(1, ref);
		expect(result.toISOString().split('T')[0]).toBe('2025-02-17');
	});

	it('returns next Monday when reference is Wednesday', () => {
		const ref = new Date('2025-02-19T12:00:00'); // Wed
		const result = getDateForDayOfWeek(1, ref); // Monday
		expect(result.toISOString().split('T')[0]).toBe('2025-02-17');
	});

	it('returns Thursday in same week when reference is Monday', () => {
		const ref = new Date('2025-02-17T12:00:00'); // Monday
		const result = getDateForDayOfWeek(4, ref); // Thursday
		expect(result.toISOString().split('T')[0]).toBe('2025-02-20');
	});
});

describe('agenda utils: getActualDateInOriginalWeek', () => {
	it('returns same weekday as dropped date within original week', () => {
		const originalDateStr = '2025-02-17'; // Monday
		const droppedStart = new Date('2025-03-06T14:00:00'); // Thursday in another week
		const result = getActualDateInOriginalWeek(originalDateStr, droppedStart);
		expect(result).toBe('2025-02-20'); // Thursday in week of 2025-02-17
	});

	it('returns original date when dropped is same weekday in same week', () => {
		const originalDateStr = '2025-02-17';
		const droppedStart = new Date('2025-02-17T10:00:00');
		const result = getActualDateInOriginalWeek(originalDateStr, droppedStart);
		expect(result).toBe('2025-02-17');
	});

	it('keeps actual_date within 7 days of original (constraint)', () => {
		const originalDateStr = '2025-02-17';
		const droppedStart = new Date('2025-04-01T09:00:00'); // far later
		const result = getActualDateInOriginalWeek(originalDateStr, droppedStart);
		const resultDate = new Date(result + 'T12:00:00');
		const originalDate = new Date(originalDateStr + 'T12:00:00');
		const diffDays = Math.round((resultDate.getTime() - originalDate.getTime()) / (24 * 60 * 60 * 1000));
		expect(Math.abs(diffDays)).toBeLessThanOrEqual(7);
	});
});

const defaultLessonTypes = {
	id: 'lt-1',
	name: 'Piano',
	icon: 'piano',
	color: '#10b981',
	is_group_lesson: false,
	duration_minutes: 30,
	frequency: 'weekly' as const,
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
		profiles: { first_name: 'Jan', last_name: 'Jansen', email: 'jan@example.com' },
		lesson_types: { ...defaultLessonTypes, ...lt },
		...rest,
	};
}

function mockDeviation(
	overrides: Partial<{
		id: string;
		lesson_agreement_id: string;
		original_date: string;
		original_start_time: string;
		actual_date: string;
		actual_start_time: string;
		is_cancelled: boolean;
		recurring: boolean;
		recurring_end_date: string | null;
	}> = {},
): LessonAppointmentDeviationWithAgreement {
	const agreementId = overrides.lesson_agreement_id ?? 'agreement-1';
	const agreement = mockAgreement({ id: agreementId });
	return {
		id: 'dev-1',
		lesson_agreement_id: agreementId,
		original_date: '2025-02-17',
		original_start_time: '14:00',
		actual_date: '2025-02-20',
		actual_start_time: '15:00',
		is_cancelled: false,
		recurring: false,
		recurring_end_date: null,
		reason: null,
		...overrides,
		lesson_agreements: agreement,
	};
}

describe('agenda utils: generateRecurringEvents', () => {
	it('generates weekly events (default frequency)', () => {
		const agreement = mockAgreement({
			start_date: '2025-02-01',
			end_date: '2025-02-28',
		});
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-02-28');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, new Map());
		const mondays = events.filter((e) => e.start && new Date(e.start).getDay() === 1);
		expect(mondays.length).toBe(4); // 4 Mondays in Feb 2025
	});

	it('generates biweekly events when frequency is biweekly', () => {
		const agreement = mockAgreement({
			start_date: '2025-02-03',
			end_date: '2025-03-31',
			lesson_types: { ...defaultLessonTypes, frequency: 'biweekly' },
		});
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-03-31');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, new Map());
		const eventDates = events.map((e) => (e.start ? new Date(e.start).toISOString().split('T')[0] : ''));
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
			lesson_types: { ...defaultLessonTypes, frequency: 'daily' },
		});
		const rangeStart = new Date('2025-02-10');
		const rangeEnd = new Date('2025-02-14');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, new Map());
		expect(events.length).toBe(5);
	});

	it('uses exact deviation when present for that date', () => {
		const agreement = mockAgreement({ id: 'ag-1' });
		const deviation = mockDeviation({
			lesson_agreement_id: 'ag-1',
			original_date: '2025-02-17',
			actual_date: '2025-02-20',
			actual_start_time: '16:00',
		});
		const deviationsMap = new Map<string, LessonAppointmentDeviationWithAgreement>();
		deviationsMap.set('ag-1-2025-02-17', deviation);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-02-28');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, deviationsMap);
		const devEvent = events.find(
			(e) => e.resource.type === 'deviation' && e.resource.originalDate === '2025-02-17',
		);
		expect(devEvent).toBeDefined();
		expect(devEvent?.resource.isDeviation).toBe(true);
		expect(devEvent?.start).toBeDefined();
		if (devEvent?.start) expect(new Date(devEvent.start).getHours()).toBe(16);
	});

	it('applies recurring deviation to future occurrences', () => {
		const agreement = mockAgreement({ id: 'ag-1', start_date: '2025-02-01', end_date: '2025-03-31' });
		const recurringDeviation = mockDeviation({
			id: 'dev-recurring',
			lesson_agreement_id: 'ag-1',
			original_date: '2025-02-17',
			actual_date: '2025-02-20',
			actual_start_time: '15:00',
			recurring: true,
		});
		const recurringByAgreement = new Map<string, LessonAppointmentDeviationWithAgreement[]>();
		recurringByAgreement.set('ag-1', [recurringDeviation]);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-03-31');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, new Map(), recurringByAgreement);
		const recurringEvents = events.filter((e) => e.resource.isRecurring === true);
		expect(recurringEvents.length).toBeGreaterThan(0);
		expect(recurringEvents.every((e) => e.resource.deviationId === 'dev-recurring')).toBe(true);
	});

	it('recurring deviation with recurring_end_date does not apply after that date', () => {
		const agreement = mockAgreement({
			id: 'ag-1',
			start_date: '2025-02-01',
			end_date: '2025-03-31',
			day_of_week: 1,
			start_time: '14:00',
		});
		const recurringDeviation = mockDeviation({
			id: 'dev-recurring',
			lesson_agreement_id: 'ag-1',
			original_date: '2025-02-17',
			actual_date: '2025-02-20',
			actual_start_time: '15:00',
			recurring: true,
			recurring_end_date: '2025-03-02',
		});
		const recurringByAgreement = new Map<string, LessonAppointmentDeviationWithAgreement[]>();
		recurringByAgreement.set('ag-1', [recurringDeviation]);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-03-31');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, new Map(), recurringByAgreement);
		const weekAfterEnd = events.find(
			(e) => e.start && new Date(e.start).toISOString().split('T')[0] === '2025-03-10',
		);
		expect(weekAfterEnd).toBeDefined();
		expect(weekAfterEnd?.resource.type).toBe('agreement');
		expect(weekAfterEnd?.resource.isDeviation).toBe(false);
	});

	it('recurring deviation with recurring_end_date still applies up to and including that date', () => {
		const agreement = mockAgreement({
			id: 'ag-1',
			start_date: '2025-02-01',
			end_date: '2025-03-31',
			day_of_week: 1,
			start_time: '14:00',
		});
		const recurringDeviation = mockDeviation({
			id: 'dev-recurring',
			lesson_agreement_id: 'ag-1',
			original_date: '2025-02-17',
			actual_date: '2025-02-20',
			actual_start_time: '15:00',
			recurring: true,
			recurring_end_date: '2025-03-02',
		});
		const recurringByAgreement = new Map<string, LessonAppointmentDeviationWithAgreement[]>();
		recurringByAgreement.set('ag-1', [recurringDeviation]);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-03-31');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, new Map(), recurringByAgreement);
		const deviationEvents = events.filter(
			(e) => e.resource.deviationId === 'dev-recurring' && e.resource.isRecurring === true,
		);
		expect(deviationEvents.length).toBeGreaterThan(0);
		const lastDeviationEvent = deviationEvents[deviationEvents.length - 1];
		const lastDateStr = lastDeviationEvent.start
			? new Date(lastDeviationEvent.start).toISOString().split('T')[0]
			: '';
		expect(lastDateStr >= '2025-02-17' && lastDateStr <= '2025-03-02').toBe(true);
		expect(lastDeviationEvent.resource.type).toBe('deviation');
	});

	it('deviation that restores to agreement slot is shown as agreement (green, not deviation)', () => {
		const agreement = mockAgreement({
			id: 'ag-1',
			day_of_week: 1,
			start_time: '14:00',
		});
		const deviation = mockDeviation({
			lesson_agreement_id: 'ag-1',
			original_date: '2025-02-17',
			original_start_time: '14:00:01',
			actual_date: '2025-02-17',
			actual_start_time: '14:00:00',
		});
		const deviationsMap = new Map<string, LessonAppointmentDeviationWithAgreement>();
		deviationsMap.set('ag-1-2025-02-17', deviation);
		const rangeStart = new Date('2025-02-01');
		const rangeEnd = new Date('2025-02-28');
		const events = generateRecurringEvents([agreement], rangeStart, rangeEnd, deviationsMap);
		const event = events.find(
			(e) =>
				e.resource.type !== undefined && new Date(e.start as Date).toISOString().split('T')[0] === '2025-02-17',
		);
		expect(event).toBeDefined();
		expect(event?.resource.type).toBe('agreement');
		expect(event?.resource.isDeviation).toBe(false);
	});
});
