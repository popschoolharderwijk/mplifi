import { differenceInDays, parseISO } from 'date-fns';
import type { RecurrenceScope } from '@/components/agenda/RecurrenceChoiceDialog';
import type { CalendarEvent } from '@/components/agenda/types';
import { supabase } from '@/integrations/supabase/client';
import { PostgresErrorCodes } from '@/integrations/supabase/errorcodes';
import { addDaysToDateStr, formatDateToDb } from '@/lib/date/date-format';
import { normalizeTime, normalizeTimeFromDate } from '@/lib/time/time-format';
import type { AgendaEventDeviationRow, AgendaEventRow } from '@/types/agenda-events';

/** Minimal agreement shape needed for move logic (start_time). */
export interface AgendaAgreementLike {
	start_time: string;
}

export interface MoveAgendaEventParams {
	event: CalendarEvent;
	start: Date;
	end: Date;
	scope: RecurrenceScope;
	user: { id: string };
	agendaEvents: AgendaEventRow[];
	deviations: AgendaEventDeviationRow[];
	agreementsMap: Map<string, AgendaAgreementLike>;
}

export type MoveAgendaEventResult = { ok: true; message: string } | { ok: false; message: string };

export async function moveAgendaEvent(params: MoveAgendaEventParams): Promise<MoveAgendaEventResult> {
	const { event, start, end, scope, user, agendaEvents, deviations, agreementsMap } = params;
	const eventId = event.resource.eventId;
	if (!eventId) return { ok: false, message: 'Geen afspraak' };

	const agendaEvent = agendaEvents.find((e) => e.id === eventId);
	if (!agendaEvent) return { ok: false, message: 'Afspraak niet gevonden' };

	const actualDateStr = formatDateToDb(start);
	const actualStartTime = normalizeTimeFromDate(start);
	const actualEndDate = formatDateToDb(end);
	const actualEndTime = normalizeTimeFromDate(end);
	const isRecurring = agendaEvent.recurring;

	if (!isRecurring) {
		const { error } = await supabase
			.from('agenda_events')
			.update({
				start_date: actualDateStr,
				start_time: actualStartTime,
				end_date: actualEndDate,
				end_time: actualEndTime,
				updated_by: user.id,
			})
			.eq('id', eventId);

		if (error) return { ok: false, message: 'Afspraak verplaatsen mislukt' };
		return { ok: true, message: 'Afspraak verplaatst' };
	}

	const recurring = scope === 'thisAndFuture';
	const isLessonEvent = agendaEvent.source_type === 'lesson_agreement' && agendaEvent.source_id;
	const agreement = isLessonEvent ? agreementsMap.get(agendaEvent.source_id as string) : null;
	const baseStartTime = agreement ? agreement.start_time : agendaEvent.start_time;

	let originalDateStr: string;
	let originalStartTime: string;
	if (event.resource.isDeviation && event.resource.originalDate && event.resource.originalStartTime) {
		originalDateStr = event.resource.originalDate;
		originalStartTime = event.resource.originalStartTime;
	} else {
		originalDateStr = event.start ? formatDateToDb(event.start) : actualDateStr;
		originalStartTime = normalizeTime(baseStartTime);
	}

	const deviationById = event.resource.deviationId
		? deviations.find((d) => d.id === event.resource.deviationId)
		: null;
	const existingDeviation =
		deviationById?.original_date === originalDateStr
			? deviationById
			: deviations.find((d) => d.event_id === eventId && d.original_date === originalDateStr);

	const droppedOnSameSlot = existingDeviation
		? actualDateStr === existingDeviation.actual_date &&
			normalizeTime(actualStartTime) === normalizeTime(existingDeviation.actual_start_time)
		: event.start &&
			actualDateStr === formatDateToDb(event.start) &&
			normalizeTime(actualStartTime) === normalizeTimeFromDate(event.start);

	if (droppedOnSameSlot) return { ok: true, message: '' };

	const isRestoringToOriginal =
		originalDateStr === actualDateStr && normalizeTime(originalStartTime) === normalizeTime(actualStartTime);

	if (scope === 'all') {
		if (isRestoringToOriginal) {
			const eventDeviations = deviations.filter((d) => d.event_id === eventId);
			if (eventDeviations.length > 0) {
				const { error } = await supabase.from('agenda_event_deviations').delete().eq('event_id', eventId);
				if (error) return { ok: false, message: 'Fout bij terugzetten reeks' };
				return { ok: true, message: 'Alle afspraken teruggezet naar originele planning' };
			}
			return { ok: true, message: '' };
		}
		const offsetDays = differenceInDays(parseISO(originalDateStr), parseISO(agendaEvent.start_date));
		const newStartDate = addDaysToDateStr(actualDateStr, -offsetDays);
		const newEndDate = addDaysToDateStr(actualEndDate, -offsetDays);
		const { error: updateError } = await supabase
			.from('agenda_events')
			.update({
				start_date: newStartDate,
				start_time: actualStartTime,
				end_date: newEndDate,
				end_time: actualEndTime,
				updated_by: user.id,
			})
			.eq('id', eventId);
		if (updateError) return { ok: false, message: 'Fout bij verplaatsen reeks' };
		const { error: deleteError } = await supabase.from('agenda_event_deviations').delete().eq('event_id', eventId);
		if (deleteError) return { ok: false, message: 'Fout bij bijwerken afwijkingen' };
		return { ok: true, message: 'Alle afspraken verplaatst' };
	}

	if (isRestoringToOriginal) {
		if (existingDeviation) {
			const scopeParam = recurring ? 'this_and_future' : 'only_this';
			const { data: result, error } = await supabase.rpc('ensure_week_shows_original_slot', {
				p_event_id: eventId,
				p_week_date: originalDateStr,
				p_user_id: user.id,
				p_scope: scopeParam,
			});
			if (error) return { ok: false, message: 'Fout bij terugzetten' };
			const message =
				result === 'recurring_deleted'
					? 'Terugkerende wijziging verwijderd'
					: result === 'recurring_ended'
						? 'Terugkerende wijziging beëindigd vanaf deze week'
						: 'Afspraak teruggezet naar originele planning';
			return { ok: true, message };
		}
		return { ok: true, message: '' };
	}

	if (
		!existingDeviation &&
		originalDateStr === actualDateStr &&
		normalizeTime(originalStartTime) === normalizeTime(actualStartTime)
	) {
		return { ok: true, message: '' };
	}

	if (existingDeviation) {
		const { error } = await supabase
			.from('agenda_event_deviations')
			.update({
				actual_date: actualDateStr,
				actual_start_time: actualStartTime,
				recurring,
				updated_by: user.id,
			})
			.eq('id', existingDeviation.id);
		if (error) {
			const isDateCheck =
				error.code === PostgresErrorCodes.CHECK_VIOLATION ||
				(error.message ?? '').toLowerCase().includes('deviation_date_check');
			return {
				ok: false,
				message: isDateCheck
					? 'Afspraak kan niet in het verleden worden geplaatst.'
					: 'Fout bij bijwerken afwijking',
			};
		}
		return { ok: true, message: 'Afspraak bijgewerkt' };
	}

	if (recurring && deviationById && deviationById.original_date !== originalDateStr) {
		const endDate = addDaysToDateStr(originalDateStr, -1);
		const { error: updateErr } = await supabase
			.from('agenda_event_deviations')
			.update({ recurring_end_date: endDate, updated_by: user.id })
			.eq('id', deviationById.id);
		if (updateErr) return { ok: false, message: `Fout bij bijwerken afwijking: ${updateErr.message}` };
	}

	const payload = {
		event_id: eventId,
		original_date: originalDateStr,
		original_start_time: normalizeTime(originalStartTime || agendaEvent.start_time),
		actual_date: actualDateStr,
		actual_start_time: actualStartTime,
		recurring,
		created_by: user.id,
		updated_by: user.id,
	};
	const { error } = await supabase
		.from('agenda_event_deviations')
		.upsert(payload, { onConflict: 'event_id,original_date' });
	if (error) {
		const isDateCheck =
			error.code === PostgresErrorCodes.CHECK_VIOLATION ||
			(error.message ?? '').toLowerCase().includes('deviation_date_check');
		const isUnique =
			error.code === PostgresErrorCodes.UNIQUE_VIOLATION ||
			(error.message ?? '').toLowerCase().includes('unique');
		return {
			ok: false,
			message: isDateCheck
				? 'Afspraak kan niet in het verleden worden geplaatst.'
				: isUnique
					? 'Deze afwijking bestaat al.'
					: `Fout bij aanmaken afwijking: ${error.message}`,
		};
	}
	return { ok: true, message: 'Afspraak verplaatst' };
}
