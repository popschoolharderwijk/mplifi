/**
 * User types derived from Supabase profiles table.
 * Use for display and selection (e.g. user select, created user callback).
 */

import type { Tables } from '@/integrations/supabase/types';

type ProfileRow = Tables<'profiles'>;

/** User – flat type for all display (phone_number can be null). */
export type User = Pick<ProfileRow, 'user_id' | 'first_name' | 'last_name' | 'email' | 'avatar_url' | 'phone_number'>;

/** Optional User for LEFT JOINs (formatUserName, buildParticipantInfo). */
export type UserOptional = { [K in keyof User]?: User[K] | null };
