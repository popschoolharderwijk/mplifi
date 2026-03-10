import { supabase } from '@/integrations/supabase/client';
import { addDaysToDateStr } from '@/lib/date/date-format';
import type { DeleteScope } from '@/types/agenda-events';

export interface DeleteAgendaEventParams {
	eventId: string;
	scope: DeleteScope;
	occurrenceDate?: string;
	userId: string;
}

export type DeleteAgendaEventResult = { ok: true; message: string } | { ok: false; message: string };

export async function deleteAgendaEvent(params: DeleteAgendaEventParams): Promise<DeleteAgendaEventResult> {
	const { eventId, scope, occurrenceDate, userId } = params;

	if (scope === 'all') {
		const { error } = await supabase.from('agenda_events').delete().eq('id', eventId);
		if (error) return { ok: false, message: 'Afspraak verwijderen mislukt' };
		return { ok: true, message: 'Alle afspraken verwijderd' };
	}

	if (scope === 'single' && occurrenceDate) {
		const { data: eventData, error: fetchErr } = await supabase
			.from('agenda_events')
			.select('start_time')
			.eq('id', eventId)
			.single();
		if (fetchErr || !eventData) return { ok: false, message: 'Afspraak niet gevonden' };
		const { error } = await supabase.from('agenda_event_deviations').upsert(
			{
				event_id: eventId,
				original_date: occurrenceDate,
				original_start_time: eventData.start_time,
				actual_date: occurrenceDate,
				actual_start_time: eventData.start_time,
				is_cancelled: true,
				created_by: userId,
				updated_by: userId,
			},
			{ onConflict: 'event_id,original_date' },
		);
		if (error) return { ok: false, message: 'Afspraak annuleren mislukt' };
		return { ok: true, message: 'Afspraak geannuleerd' };
	}

	if (scope === 'thisAndFuture' && occurrenceDate) {
		const newEndDate = addDaysToDateStr(occurrenceDate, -1);
		const { error } = await supabase
			.from('agenda_events')
			.update({ recurring_end_date: newEndDate, updated_by: userId })
			.eq('id', eventId);
		if (error) return { ok: false, message: 'Afspraken verwijderen mislukt' };
		return { ok: true, message: 'Deze en toekomstige afspraken verwijderd' };
	}

	return { ok: false, message: 'Ongeldige verwijderactie' };
}
