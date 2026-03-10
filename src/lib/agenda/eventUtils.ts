import type { User, UserOptional } from '@/types/users';

/** Build User from profile and user_id. */
export function buildParticipantInfo(profile: UserOptional | null | undefined, userId: string): User | undefined {
	if (!profile || !profile.email) return undefined;
	return {
		user_id: userId,
		first_name: profile.first_name ?? null,
		last_name: profile.last_name ?? null,
		email: profile.email,
		avatar_url: profile.avatar_url ?? null,
		phone_number: profile.phone_number ?? null,
	};
}
