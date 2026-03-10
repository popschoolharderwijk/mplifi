/**
 * Centralized type definitions for agenda events, participants, and deviations.
 * Based on Supabase generated types.
 */

import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type AgendaEventRow = Tables<'agenda_events'>;
export type AgendaEventInsert = TablesInsert<'agenda_events'>;
export type AgendaEventUpdate = TablesUpdate<'agenda_events'>;

export type AgendaParticipantRow = Tables<'agenda_participants'>;
export type AgendaParticipantInsert = TablesInsert<'agenda_participants'>;

export type AgendaEventDeviationRow = Tables<'agenda_event_deviations'>;
export type AgendaEventDeviationInsert = TablesInsert<'agenda_event_deviations'>;
export type AgendaEventDeviationUpdate = TablesUpdate<'agenda_event_deviations'>;

/** Source type for agenda_events */
export type AgendaEventSourceType = 'manual' | 'lesson_agreement';

/** Agenda event with participants joined (for display) */
export interface AgendaEventWithParticipants extends AgendaEventRow {
	participants?: AgendaParticipantRow[];
}

/** Deviation with its agenda event (for calendar logic) */
export interface AgendaEventDeviationWithEvent extends AgendaEventDeviationRow {
	agenda_event: AgendaEventRow;
}

/** Info about a deviation (for recurring events that have been moved or cancelled). */
export interface DeviationInfo {
	deviationId: string;
	originalDate: string;
	originalStartTime: string;
	isCancelled?: boolean;
	/** True when actual date/time differs from original (show "Gewijzigde afspraak" only then). */
	hasTimeOrDateChange?: boolean;
}

/** Scope for delete/cancel operations on recurring events */
export type DeleteScope = 'single' | 'thisAndFuture' | 'all';
