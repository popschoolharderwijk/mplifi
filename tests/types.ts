import type { Database } from '../src/integrations/supabase/types';

/**
 * Centralized Supabase type definitions for tests.
 * Import these types instead of defining them in each test file.
 */

// Row types
export type AgendaEventRow = Database['public']['Tables']['agenda_events']['Row'];
export type AgendaEventDeviationRow = Database['public']['Tables']['agenda_event_deviations']['Row'];
export type AgendaParticipantRow = Database['public']['Tables']['agenda_participants']['Row'];

// Insert types
export type AgendaEventInsert = Database['public']['Tables']['agenda_events']['Insert'];
export type AgendaEventDeviationInsert = Database['public']['Tables']['agenda_event_deviations']['Insert'];
export type AgendaParticipantInsert = Database['public']['Tables']['agenda_participants']['Insert'];
export type LessonAgreementInsert = Database['public']['Tables']['lesson_agreements']['Insert'];
export type LessonTypeInsert = Database['public']['Tables']['lesson_types']['Insert'];
export type LessonTypeOptionInsert = Database['public']['Tables']['lesson_type_options']['Insert'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type StudentInsert = Database['public']['Tables']['students']['Insert'];
export type TeacherInsert = Database['public']['Tables']['teachers']['Insert'];
export type TeacherAvailabilityInsert = Database['public']['Tables']['teacher_availability']['Insert'];
export type TeacherLessonTypeInsert = Database['public']['Tables']['teacher_lesson_types']['Insert'];
export type UserRoleInsert = Database['public']['Tables']['user_roles']['Insert'];

// RPC function types
export type DatabaseRpcFunction = keyof Database['public']['Functions'];
