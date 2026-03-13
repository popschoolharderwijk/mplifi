import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getDisplayName } from '@/lib/display-name';
import { cn } from '@/lib/utils';
import type { UserOptional } from '@/types/users';

interface UserDisplayProps {
	/** User profile data */
	profile: UserOptional;
	/** Show email below name */
	showEmail?: boolean;
	/** Text to show after the name (e.g., "(you)") */
	nameSuffix?: React.ReactNode;
	/** Additional className */
	className?: string;
}

export function getUserInitials(profile: UserOptional): string {
	if (profile.first_name && profile.last_name) {
		return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
	}
	if (profile.first_name) {
		return profile.first_name.slice(0, 2).toUpperCase();
	}
	return (profile.email ?? '??').slice(0, 2).toUpperCase();
}

/**
 * Displays a user with avatar and name in a consistent format.
 * Use this component everywhere a user needs to be displayed.
 */
export function UserDisplay({ profile, showEmail = false, nameSuffix, className }: UserDisplayProps) {
	const displayName = getDisplayName(profile);
	const initials = getUserInitials(profile);

	return (
		<div className={cn('flex items-center gap-3', className)}>
			<Avatar className="h-8 w-8 flex-shrink-0">
				<AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} />
				<AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1 text-left">
				<p className="font-medium truncate text-sm">
					{displayName}
					{nameSuffix}
				</p>
				{showEmail && profile.email && (
					<p className="text-xs text-muted-foreground truncate">{profile.email}</p>
				)}
			</div>
		</div>
	);
}
