import type { UserOptional } from '@/types/users';

/** Display name from profile (first + last name, or single name, or email, or 'Onbekend'). */
export function getDisplayName(profile?: UserOptional | null): string {
	if (!profile) return 'Onbekend';
	if (profile.first_name && profile.last_name) {
		return `${profile.first_name} ${profile.last_name}`;
	}
	return profile.first_name ?? profile.last_name ?? profile.email ?? 'Onbekend';
}
