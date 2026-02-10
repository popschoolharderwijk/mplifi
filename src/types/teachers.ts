/**
 * Centralized type definitions for teachers
 * These types extend the generated Supabase types with joined relations
 */

import type { Tables } from '@/integrations/supabase/types';

// Base types from Supabase
type TeacherRow = Tables<'teachers'>;
type ProfileRow = Tables<'profiles'>;
type LessonTypeRow = Tables<'lesson_types'>;

/**
 * Profile fields commonly used in teacher views
 */
export type TeacherProfileFields = Pick<
	ProfileRow,
	'first_name' | 'last_name' | 'email' | 'avatar_url' | 'phone_number'
>;

/**
 * Teacher with joined profile data (from profiles table via user_id)
 */
export type TeacherWithProfile = TeacherRow & {
	profile: TeacherProfileFields;
};

/**
 * Teacher with profile and lesson types (for list views)
 */
export type TeacherWithProfileAndLessonTypes = TeacherRow & {
	profile: TeacherProfileFields;
	lesson_types: Pick<LessonTypeRow, 'id' | 'name' | 'icon' | 'color'>[];
};

/**
 * Paginated response for teacher list endpoints
 */
export interface PaginatedTeachersResponse {
	data: TeacherWithProfileAndLessonTypes[];
	total_count: number;
	limit: number;
	offset: number;
}
