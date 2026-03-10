/**
 * Centralized type definitions for students.
 * These types extend the generated Supabase types with joined relations.
 */

import type { Tables } from '@/integrations/supabase/types';
import type { LessonAgreementWithTeacher } from '@/types/lesson-agreements';
import type { User } from '@/types/users';

type StudentRow = Tables<'students'>;

/** Student: student row fields + user/profile fields (flat). */
export type Student = StudentRow & User;

/** Student with agreements (for list views). */
export type StudentWithAgreements = Student & {
	active_agreements_count: number;
	agreements: LessonAgreementWithTeacher[];
};

/** Raw agreement shape from get_students_paginated RPC (duration/frequency/price in lesson_type). */
type StudentAgreementRaw = {
	id: string;
	day_of_week: number;
	start_time: string;
	start_date: string;
	end_date: string | null;
	is_active: boolean;
	notes: string | null;
	teacher: { first_name: string | null; last_name: string | null; avatar_url: string | null };
	lesson_type: {
		id: string;
		name: string;
		icon: string | null;
		color: string | null;
		duration_minutes: number;
		frequency: LessonAgreementWithTeacher['frequency'];
		price_per_lesson: number;
	};
};

/** Raw shape from get_students_paginated RPC (nested profile). */
export type StudentWithAgreementsRaw = StudentRow & {
	profile: User;
	active_agreements_count: number;
	agreements: StudentAgreementRaw[];
};

/** Flatten nested profile into Student. */
export function flattenStudent(t: StudentRow & { profile: User }): Student {
	const { profile, ...rest } = t;
	return { ...rest, ...profile };
}

/** Transform raw agreement to LessonAgreementWithTeacher (lift duration/frequency/price from lesson_type). */
function transformAgreement(a: StudentAgreementRaw): LessonAgreementWithTeacher {
	const { lesson_type, ...rest } = a;
	return {
		...rest,
		duration_minutes: lesson_type.duration_minutes,
		frequency: lesson_type.frequency,
		price_per_lesson: lesson_type.price_per_lesson,
		lesson_type: {
			id: lesson_type.id,
			name: lesson_type.name,
			icon: lesson_type.icon,
			color: lesson_type.color,
		},
	};
}

/** Flatten raw paginated response to StudentWithAgreements. */
export function flattenStudentWithAgreements(t: StudentWithAgreementsRaw): StudentWithAgreements {
	const { profile, agreements, ...rest } = t;
	return {
		...rest,
		...profile,
		agreements: agreements.map(transformAgreement),
	};
}

/** Raw paginated response from get_students_paginated RPC. */
export interface PaginatedStudentsResponseRaw {
	data: StudentWithAgreementsRaw[];
	total_count: number;
	limit: number;
	offset: number;
}
