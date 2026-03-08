/**
 * Centralized type definitions for lesson agreements
 * These types extend the generated Supabase types with joined relations
 */

import type { Database } from '@/integrations/supabase/types';
import type { AgendaEventDeviationWithEvent } from '@/types/agenda-events';

// Base types from Supabase
type LessonAgreementRow = Database['public']['Tables']['lesson_agreements']['Row'];
export type LessonTypeRow = Database['public']['Tables']['lesson_types']['Row'];
export type LessonTypeOptionRow = Database['public']['Tables']['lesson_type_options']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

/** Lesson scheduling frequency from Supabase enum (use this instead of defining locally) */
export type LessonFrequency = Database['public']['Enums']['lesson_frequency'];

/** Common lesson type display fields (id, name, icon, color) */
export type LessonTypeDisplayFields = Pick<LessonTypeRow, 'id' | 'name' | 'icon' | 'color'>;

/** Form state for lesson type create/edit (nullable DB fields as string) */
export type LessonTypeFormState = Pick<LessonTypeRow, 'name' | 'icon' | 'color' | 'is_group_lesson' | 'is_active'> & {
	description: string;
	cost_center: string;
};

/** Form row for editing one lesson_type_option (id optional for new; numeric fields as string for inputs) */
export type LessonTypeOptionFormRow = {
	id?: string;
	duration_minutes: string;
	frequency: LessonFrequency;
	price_per_lesson: string;
};

/** Lesson type option row (duration/frequency/price) for selects; from Supabase lesson_type_options */
export type LessonTypeOptionSnapshot = Pick<
	LessonTypeOptionRow,
	'id' | 'duration_minutes' | 'frequency' | 'price_per_lesson'
>;

// ======== Wizard Step Types ========

/** Teacher info for wizard steps */
export interface WizardTeacherInfo {
	id: string;
	userId: string;
	firstName: string | null;
	lastName: string | null;
	email: string | null;
	avatarUrl: string | null;
}

/** Lesson type info for wizard steps */
export interface WizardLessonTypeInfo {
	id: string;
	name: string;
	icon: string | null;
	color: string | null;
	frequency: LessonFrequency;
	duration_minutes: number;
	price_per_lesson: number;
}

/** Simplified teacher for wizard confirmation step */
export interface WizardAgreementTeacher {
	first_name: string | null;
	last_name: string | null;
	email: string | null;
	avatar_url: string | null;
}

/** Simplified lesson type for wizard confirmation step (name from type; frequency/price from snapshot) */
export interface WizardAgreementLessonType {
	name: string | null;
	frequency?: LessonFrequency;
	duration_minutes?: number;
	price_per_lesson?: number;
}

/** Initial agreement data for editing in wizard (snapshot fields from agreement) */
export interface WizardInitialAgreement {
	id: string;
	student_user_id: string;
	teacher_id: string;
	lesson_type_id: string;
	duration_minutes: number;
	frequency: LessonFrequency;
	price_per_lesson: number;
	start_date: string;
	end_date: string | null;
	day_of_week: number;
	start_time: string;
	teacher?: WizardAgreementTeacher;
	lesson_type?: WizardAgreementLessonType;
}

// ======== End Wizard Step Types ========

/**
 * Lesson agreement from teacher's perspective (includes student profile)
 * Duration/frequency/price come from agreement snapshot, not lesson_types.
 */
export type LessonAgreementWithStudent = Pick<
	LessonAgreementRow,
	| 'id'
	| 'day_of_week'
	| 'start_time'
	| 'start_date'
	| 'end_date'
	| 'is_active'
	| 'student_user_id'
	| 'lesson_type_id'
	| 'duration_minutes'
	| 'frequency'
	| 'price_per_lesson'
> & {
	profiles: Pick<ProfileRow, 'first_name' | 'last_name' | 'email'> | null;
	lesson_types: LessonTypeDisplayFields & Pick<LessonTypeRow, 'is_group_lesson'>;
};

/**
 * Lesson agreement from student's perspective (includes teacher profile)
 * Duration/frequency/price come from agreement snapshot.
 */
export type LessonAgreementWithTeacher = Pick<
	LessonAgreementRow,
	| 'id'
	| 'day_of_week'
	| 'start_time'
	| 'start_date'
	| 'end_date'
	| 'is_active'
	| 'notes'
	| 'duration_minutes'
	| 'frequency'
	| 'price_per_lesson'
> & {
	teacher: Pick<ProfileRow, 'first_name' | 'last_name' | 'avatar_url'>;
	lesson_type: LessonTypeDisplayFields;
};

/**
 * Lesson agreement row for the Agreements data table.
 * lesson_type has name/icon/color from lesson_types; duration/frequency/price from agreement snapshot.
 */
export type AgreementTableRow = Pick<
	LessonAgreementRow,
	| 'id'
	| 'created_at'
	| 'day_of_week'
	| 'start_time'
	| 'start_date'
	| 'end_date'
	| 'is_active'
	| 'notes'
	| 'student_user_id'
	| 'teacher_id'
	| 'lesson_type_id'
	| 'duration_minutes'
	| 'frequency'
	| 'price_per_lesson'
> & {
	student: Pick<ProfileRow, 'first_name' | 'last_name' | 'avatar_url' | 'email'>;
	teacher: Pick<ProfileRow, 'first_name' | 'last_name' | 'avatar_url' | 'email'>;
	lesson_type: LessonTypeDisplayFields;
};

/**
 * Lesson appointment deviation with its agenda event (replaces old deviation + lesson_agreement).
 * Use agenda_event for start_time, start_date, recurring_frequency; day_of_week from start_date.
 * When source_type is lesson_agreement, lesson_agreement can be loaded via event.source_id for student/lesson type display.
 */
export type LessonAppointmentDeviationWithAgreement = AgendaEventDeviationWithEvent & {
	lesson_agreement?: LessonAgreementWithStudent;
};
