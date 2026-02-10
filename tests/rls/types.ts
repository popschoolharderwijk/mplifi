import type { Database } from '../../src/integrations/supabase/types';

/**
 * Centralized Supabase type definitions for RLS tests.
 * Import these types instead of defining them in each test file.
 */

// Insert types
export type LessonAgreementInsert = Database['public']['Tables']['lesson_agreements']['Insert'];
export type LessonTypeInsert = Database['public']['Tables']['lesson_types']['Insert'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type StudentInsert = Database['public']['Tables']['students']['Insert'];
export type TeacherInsert = Database['public']['Tables']['teachers']['Insert'];
export type TeacherAvailabilityInsert = Database['public']['Tables']['teacher_availability']['Insert'];
export type TeacherLessonTypeInsert = Database['public']['Tables']['teacher_lesson_types']['Insert'];
export type UserRoleInsert = Database['public']['Tables']['user_roles']['Insert'];
export type LessonAppointmentDeviationInsert = Database['public']['Tables']['lesson_appointment_deviations']['Insert'];
