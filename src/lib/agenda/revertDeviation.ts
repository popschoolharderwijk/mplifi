import { supabase } from '@/integrations/supabase/client';

export interface RevertDeviationParams {
	eventId: string;
	originalDate: string;
	userId: string;
}

export type RevertDeviationResult = { ok: true; message: string } | { ok: false; message: string };

export async function revertDeviation(params: RevertDeviationParams): Promise<RevertDeviationResult> {
	const { eventId, originalDate, userId } = params;

	const { data, error } = await supabase.rpc('ensure_week_shows_original_slot', {
		p_event_id: eventId,
		p_week_date: originalDate,
		p_user_id: userId,
		p_scope: 'only_this',
	});

	if (error) return { ok: false, message: 'Fout bij terugzetten' };

	const message =
		data === 'recurring_deleted'
			? 'Terugkerende wijziging verwijderd'
			: data === 'recurring_ended'
				? 'Terugkerende wijziging beëindigd'
				: 'Afspraak teruggezet naar origineel';

	return { ok: true, message };
}
