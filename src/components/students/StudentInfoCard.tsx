import { forwardRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Student } from '@/types/students';
import type { User } from '@/types/users';

export type { Student };

interface StudentInfoCardProps {
	/** User or Student (both have display fields) */
	student: User;
	onClick?: () => void;
	className?: string;
}

function getDisplayName(student: User): string {
	if (student.first_name && student.last_name) {
		return `${student.first_name} ${student.last_name}`;
	}
	if (student.first_name) {
		return student.first_name;
	}
	return student.email;
}

function getInitials(student: User): string {
	if (student.first_name && student.last_name) {
		return `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();
	}
	if (student.first_name) {
		return student.first_name.slice(0, 2).toUpperCase();
	}
	return student.email.slice(0, 2).toUpperCase();
}

/**
 * Compact card component displaying a student's avatar, name and email.
 * Can be clicked to open a detailed modal (via onClick prop).
 */
export const StudentInfoCard = forwardRef<HTMLDivElement, StudentInfoCardProps>(
	({ student, onClick, className }, ref) => {
		const displayName = getDisplayName(student);
		const initials = getInitials(student);

		const cardContent = (
			<>
				<Avatar className="h-10 w-10 flex-shrink-0">
					<AvatarImage src={student.avatar_url ?? undefined} alt={displayName} />
					<AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
						{initials}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1 overflow-hidden">
					<p className="font-medium truncate text-sm">{displayName}</p>
					<p className="text-xs text-muted-foreground truncate">{student.email}</p>
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
