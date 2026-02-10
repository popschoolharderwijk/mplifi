import { useState } from 'react';
import { ColorIcon } from '@/components/ui/color-icon';
import { resolveIconFromList } from '@/components/ui/icon-picker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MUSIC_ICONS } from '@/constants/icons';
import { DAY_NAMES_DISPLAY, getDayName } from '@/lib/dateHelpers';
import { cn } from '@/lib/utils';
import type { LessonAgreementWithTeacher } from '@/types/lesson-agreements';
import type { LessonAgreement } from './LessonAgreementDialog';
import { LessonAgreementDialog } from './LessonAgreementDialog';

// Re-export the type for convenience
export type { LessonAgreement };

interface LessonAgreementItemProps {
	agreement: LessonAgreement;
	className?: string;
	readOnly?: boolean;
}

function getTeacherDisplayName(teacher: LessonAgreementWithTeacher['teacher']): string {
	if (teacher.first_name && teacher.last_name) {
		return `${teacher.first_name} ${teacher.last_name}`;
	}
	if (teacher.first_name) {
		return teacher.first_name;
	}
	return 'Onbekend';
}

function formatTime(time: string): string {
	const [hours, minutes] = time.split(':');
	return `${hours}:${minutes}`;
}

function getTooltipText(agreement: LessonAgreementWithTeacher, teacherName: string): string {
	const dayName = getDayName(agreement.day_of_week);
	const time = formatTime(agreement.start_time);
	return `${agreement.lesson_type.name}\n${teacherName}\n${dayName} om ${time}`;
}

export function LessonAgreementItem({ agreement, className, readOnly = false }: LessonAgreementItemProps) {
	const [dialogOpen, setDialogOpen] = useState(false);

	const Icon = agreement.lesson_type.icon ? resolveIconFromList(MUSIC_ICONS, agreement.lesson_type.icon) : undefined;
	const teacherName = getTeacherDisplayName(agreement.teacher);

	const handleOpenChange = (open: boolean) => {
		setDialogOpen(open);
	};

	const tooltipText = getTooltipText(agreement, teacherName);

	const innerContent = (
		<>
			{/* Lesson Type Icon */}
			<div className="shrink-0">
				<ColorIcon icon={Icon} color={agreement.lesson_type.color} size="md" />
			</div>

			{/* Teacher Name with Day indicators below */}
			<div className="flex flex-col gap-1 flex-1 min-w-0">
				<span className="font-medium truncate text-sm">{teacherName}</span>
				{/* Day indicators: 7 squares for each day of the week (Monday first) */}
				<div className="flex gap-1">
					{DAY_NAMES_DISPLAY.map((dayName, displayIndex) => {
						// Convert display index (0=Monday) to database day_of_week (0=Sunday)
						// displayIndex 0 (Monday) = day_of_week 1
						// displayIndex 6 (Sunday) = day_of_week 0
						const dayOfWeek = displayIndex === 6 ? 0 : displayIndex + 1;
						const hasLesson = agreement.day_of_week === dayOfWeek;
						const isWeekend = displayIndex >= 5; // Saturday (5) and Sunday (6)
						return (
							<div
								key={dayName}
								className={cn(
									'h-2.5 w-2.5 rounded-sm border',
									hasLesson
										? 'bg-primary border-primary/80'
										: isWeekend
											? 'bg-muted/60 border-muted-foreground/60'
											: 'bg-muted/70 border-muted-foreground/50',
								)}
								title={dayName}
							/>
						);
					})}
				</div>
			</div>
		</>
	);

	if (readOnly) {
		return (
			<div
				className={cn(
					'inline-flex items-center gap-3 rounded-lg border p-3 text-left w-40 bg-muted/50 cursor-default',
					className,
				)}
			>
				{innerContent}
			</div>
		);
	}

	return (
		<>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							data-agreement-id={agreement.id}
							onClick={(e) => {
								e.stopPropagation();
								setDialogOpen(true);
							}}
							onMouseDown={(e) => {
								// Prevent row click when clicking on button
								e.stopPropagation();
							}}
							className={cn(
								'inline-flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-40',
								className,
							)}
						>
							{innerContent}
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<p className="whitespace-pre-line">{tooltipText}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<LessonAgreementDialog open={dialogOpen} onOpenChange={handleOpenChange} agreement={agreement} />
		</>
	);
}
