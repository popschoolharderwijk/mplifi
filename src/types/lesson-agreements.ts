/**
 * Centralized type definitions for lesson agreements
 * These types extend the generated Supabase types with joined relations
 */

import type { Database } from '@/integrations/supabase/types';

// Base types from Supabase
type LessonAgreementRow = Database['public']['Tables']['lesson_agreements']['Row'];
type LessonTypeRow = Database['public']['Tables']['lesson_types']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type LessonAppointmentDeviationRow = Database['public']['Tables']['lesson_appointment_deviations']['Row'];

/** Lesson scheduling frequency from Supabase enum (use this instead of defining locally) */
export type LessonFrequency = Database['public']['Enums']['lesson_frequency'];

/**
 * Lesson agreement from teacher's perspective (includes student profile)
 */
export type LessonAgreementWithStudent = Pick<
	LessonAgreementRow,
	'id' | 'day_of_week' | 'start_time' | 'start_date' | 'end_date' | 'is_active' | 'student_user_id' | 'lesson_type_id'
> & {
	profiles: Pick<ProfileRow, 'first_name' | 'last_name' | 'email'> | null;
	lesson_types: Pick<
		LessonTypeRow,
		'id' | 'name' | 'icon' | 'color' | 'is_group_lesson' | 'duration_minutes' | 'frequency'
	>;
};

/**
 * Lesson agreement from student's perspective (includes teacher profile)
 */
export type LessonAgreementWithTeacher = Pick<
	LessonAgreementRow,
	'id' | 'day_of_week' | 'start_time' | 'start_date' | 'end_date' | 'is_active' | 'notes'
> & {
	teacher: Pick<ProfileRow, 'first_name' | 'last_name' | 'avatar_url'>;
	lesson_type: Pick<LessonTypeRow, 'id' | 'name' | 'icon' | 'color'>;
};

/**
 * Lesson appointment deviation with its related lesson agreement
 */
export type LessonAppointmentDeviationWithAgreement = Omit<
	LessonAppointmentDeviationRow,
	'created_at' | 'updated_at' | 'created_by_user_id' | 'last_updated_by_user_id'
> & {
	lesson_agreements: LessonAgreementWithStudent;
};
