import type { Database, Tables, TablesInsert } from '../src/integrations/supabase/types';

/**
 * Centralized Supabase type definitions for tests.
 * Import these types instead of defining them in each test file.
 */

// Row types
export type AgendaEventRow = Tables<'agenda_events'>;
export type AgendaEventDeviationRow = Tables<'agenda_event_deviations'>;
export type AgendaParticipantRow = Tables<'agenda_participants'>;

// Insert types
export type AgendaEventInsert = TablesInsert<'agenda_events'>;
export type AgendaEventDeviationInsert = TablesInsert<'agenda_event_deviations'>;
export type AgendaParticipantInsert = TablesInsert<'agenda_participants'>;
export type LessonAgreementInsert = TablesInsert<'lesson_agreements'>;
export type LessonTypeInsert = TablesInsert<'lesson_types'>;
export type LessonTypeOptionInsert = TablesInsert<'lesson_type_options'>;
export type ProfileInsert = TablesInsert<'profiles'>;
export type StudentInsert = TablesInsert<'students'>;
export type TeacherInsert = TablesInsert<'teachers'>;
export type TeacherAvailabilityInsert = TablesInsert<'teacher_availability'>;
export type TeacherLessonTypeInsert = TablesInsert<'teacher_lesson_types'>;
export type UserRoleInsert = TablesInsert<'user_roles'>;

// RPC function types (no helper available)
export type DatabaseRpcFunction = keyof Database['public']['Functions'];
