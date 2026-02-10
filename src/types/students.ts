/**
 * Centralized type definitions for students
 * These types extend the generated Supabase types with joined relations
 */

import type { Tables } from '@/integrations/supabase/types';

// Base types from Supabase
type StudentRow = Tables<'students'>;
type ProfileRow = Tables<'profiles'>;

/**
 * Profile fields used for displaying student info in cards
 * (subset without phone_number for compact display)
 */
export type StudentCardProfileFields = Pick<ProfileRow, 'email' | 'first_name' | 'last_name' | 'avatar_url'>;

/**
 * Student info used in calendar events (teacher agenda)
 * Contains user_id and basic profile fields for display
 */
export interface StudentEventInfo {
	user_id: string;
	first_name: string | null;
	last_name: string | null;
	email: string;
	avatar_url: string | null;
}

/**
 * Profile fields used for displaying student info in modals
 * (includes phone_number for detailed view)
 */
export type StudentModalProfileFields = Pick<
	ProfileRow,
	'email' | 'first_name' | 'last_name' | 'avatar_url' | 'phone_number'
>;

/**
 * Data structure for StudentInfoCard component
 * Contains minimal data needed to display a compact student card
 */
export interface StudentInfoCardData {
	id: string;
	user_id: string;
	profile: StudentCardProfileFields;
}

/**
 * Data structure passed to StudentInfoModal to identify the student
 * Contains initial data that may be displayed while full data loads
 */
export interface StudentInfoModalData {
	id: string;
	user_id: string;
	profile: StudentModalProfileFields;
}

/**
 * Full student data loaded by the StudentInfoModal
 * Combines student record with profile data for detailed view
 */
export type FullStudentData = StudentRow & {
	profile: StudentModalProfileFields;
};

/**
 * Student with joined profile data (commonly used in list views)
 */
export type StudentWithProfile = StudentRow & {
	profile: StudentModalProfileFields;
};
