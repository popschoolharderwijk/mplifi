/**
 * Centralized type definitions for agenda events, participants, and deviations.
 * Based on Supabase generated types.
 */

import type { Database } from '@/integrations/supabase/types';

export type AgendaEventRow = Database['public']['Tables']['agenda_events']['Row'];
export type AgendaEventInsert = Database['public']['Tables']['agenda_events']['Insert'];
export type AgendaEventUpdate = Database['public']['Tables']['agenda_events']['Update'];

export type AgendaParticipantRow = Database['public']['Tables']['agenda_participants']['Row'];
export type AgendaParticipantInsert = Database['public']['Tables']['agenda_participants']['Insert'];

export type AgendaEventDeviationRow = Database['public']['Tables']['agenda_event_deviations']['Row'];
export type AgendaEventDeviationInsert = Database['public']['Tables']['agenda_event_deviations']['Insert'];
export type AgendaEventDeviationUpdate = Database['public']['Tables']['agenda_event_deviations']['Update'];

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
}

/** Scope for delete/cancel operations on recurring events */
export type DeleteScope = 'single' | 'thisAndFuture' | 'all';
