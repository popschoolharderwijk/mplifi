/**
 * Centralized type definitions for teachers.
 * These types extend the generated Supabase types with joined relations.
 */

import type { Tables } from '@/integrations/supabase/types';
import type { LessonTypeDisplayFields } from '@/types/lesson-agreements';
import type { User } from '@/types/users';

type TeacherRow = Tables<'teachers'>;

/** Teacher: teacher row fields + user/profile fields (flat). */
export type Teacher = TeacherRow & User;

/** Teacher with lesson types (for list views). */
export type TeacherWithLessonTypes = Teacher & {
	lesson_types: LessonTypeDisplayFields[];
};

/** Raw shape from get_teachers_paginated RPC (nested profile). */
export type TeacherWithLessonTypesRaw = TeacherRow & {
	profile: User;
	lesson_types: LessonTypeDisplayFields[];
};

/** Flatten nested profile into Teacher. */
export function flattenTeacher(t: TeacherRow & { profile: User }): Teacher {
	const { profile, ...rest } = t;
	return { ...rest, ...profile };
}

/** Flatten raw paginated response to TeacherWithLessonTypes. */
export function flattenTeacherWithLessonTypes(t: TeacherWithLessonTypesRaw): TeacherWithLessonTypes {
	const { profile, lesson_types, ...rest } = t;
	return { ...rest, ...profile, lesson_types };
}

/** Paginated response for teacher list endpoints (flat, after flattening). */
export interface PaginatedTeachersResponse {
	data: TeacherWithLessonTypes[];
	total_count: number;
	limit: number;
	offset: number;
}

/** Raw paginated response from get_teachers_paginated RPC. */
export interface PaginatedTeachersResponseRaw {
	data: TeacherWithLessonTypesRaw[];
	total_count: number;
	limit: number;
	offset: number;
}
