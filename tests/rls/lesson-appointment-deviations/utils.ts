/**
 * Shared helpers for lesson_appointment_deviations tests.
 */
import { getActualDateInOriginalWeek } from '../../../src/components/teachers/agenda/utils';
import { dateDaysFromNow, getDateForDayOfWeek, toLocalDateString } from '../../../src/lib/dateHelpers';
import { fixtures } from '../fixtures';
import { TestUsers } from '../test-users';
import type { LessonAppointmentDeviationInsert } from '../types';

export { dateDaysFromNow, getDateForDayOfWeek, getActualDateInOriginalWeek };

/** Calculate the agreement's original_date (day_of_week) for the week containing refDate. */
export function originalDateForWeek(dayOfWeek: number, refDate: Date): string {
	return toLocalDateString(getDateForDayOfWeek(dayOfWeek, refDate));
}

/** Build standard deviation data for a given reference offset. */
export function buildDeviationData(opts: {
	agreementId: string;
	dayOfWeek: number;
	startTime: string;
	refDays: number;
	offsetDays?: number;
	actualStartTime: string;
	recurring: boolean;
}): { insertRow: LessonAppointmentDeviationInsert; originalDate: string; actualDate: string } {
	const refDate = dateDaysFromNow(opts.refDays);
	const originalDate = originalDateForWeek(opts.dayOfWeek, refDate);
	const droppedDate = new Date(originalDate + 'T12:00:00');
	droppedDate.setDate(droppedDate.getDate() + (opts.offsetDays ?? 3));
	const actualDate = getActualDateInOriginalWeek(originalDate, droppedDate);
	const userId = fixtures.requireUserId(TestUsers.TEACHER_ALICE);

	return {
		originalDate,
		actualDate,
		insertRow: {
			lesson_agreement_id: opts.agreementId,
			original_date: originalDate,
			original_start_time: opts.startTime,
			actual_date: actualDate,
			actual_start_time: opts.actualStartTime,
			recurring: opts.recurring,
			created_by_user_id: userId,
			last_updated_by_user_id: userId,
		},
	};
}

/** Require agreement between STUDENT_009 and TEACHER_ALICE. */
export function getTestAgreement() {
	const agreementId = fixtures.requireAgreementId(TestUsers.STUDENT_009, TestUsers.TEACHER_ALICE);
	const agreement = fixtures.allLessonAgreements.find((a) => a.id === agreementId);
	if (!agreement) throw new Error('Agreement not found');
	return { agreementId, agreement };
}

/** Require agreement between STUDENT_026 and TEACHER_BOB. */
export function getTestAgreementBob() {
	const agreementId = fixtures.requireAgreementId(TestUsers.STUDENT_026, TestUsers.TEACHER_BOB);
	const agreement = fixtures.allLessonAgreements.find((a) => a.id === agreementId);
	if (!agreement) throw new Error('Agreement not found');
	return { agreementId, agreement };
}

/** Build deviation data with custom user. */
export function buildDeviationDataAsUser(
	opts: Parameters<typeof buildDeviationData>[0],
	userId: string,
): ReturnType<typeof buildDeviationData> {
	const result = buildDeviationData(opts);
	return {
		...result,
		insertRow: {
			...result.insertRow,
			created_by_user_id: userId,
			last_updated_by_user_id: userId,
		},
	};
}
