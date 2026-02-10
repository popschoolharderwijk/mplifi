import { forwardRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { StudentInfoCardData } from '@/types/students';

export type { StudentInfoCardData };

interface StudentInfoCardProps {
	student: StudentInfoCardData;
	onClick?: () => void;
	className?: string;
}

function getDisplayName(profile: StudentInfoCardData['profile']): string {
	if (profile.first_name && profile.last_name) {
		return `${profile.first_name} ${profile.last_name}`;
	}
	if (profile.first_name) {
		return profile.first_name;
	}
	return profile.email;
}

function getInitials(profile: StudentInfoCardData['profile']): string {
	if (profile.first_name && profile.last_name) {
		return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
	}
	if (profile.first_name) {
		return profile.first_name.slice(0, 2).toUpperCase();
	}
	return profile.email.slice(0, 2).toUpperCase();
}

/**
 * A compact card component displaying a student's avatar, name and email.
 * Can be clicked to open a detailed modal (via onClick prop).
 */
export const StudentInfoCard = forwardRef<HTMLDivElement, StudentInfoCardProps>(
	({ student, onClick, className }, ref) => {
		const displayName = getDisplayName(student.profile);
		const initials = getInitials(student.profile);

		const cardContent = (
			<>
				<Avatar className="h-10 w-10 flex-shrink-0">
					<AvatarImage src={student.profile.avatar_url ?? undefined} alt={displayName} />
					<AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
						{initials}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1 overflow-hidden">
					<p className="font-medium truncate text-sm">{displayName}</p>
					<p className="text-xs text-muted-foreground truncate">{student.profile.email}</p>
				</div>
			</>
		);

		const baseClasses = 'flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm transition-colors';

		if (onClick) {
			return (
				<button
					type="button"
					onClick={onClick}
					className={cn(
						baseClasses,
						'cursor-pointer hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-left w-full',
						className,
					)}
				>
					{cardContent}
				</button>
			);
		}

		return (
			<div ref={ref} className={cn(baseClasses, className)}>
				{cardContent}
			</div>
		);
	},
);

StudentInfoCard.displayName = 'StudentInfoCard';
