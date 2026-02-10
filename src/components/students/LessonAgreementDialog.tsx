import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ColorIcon } from '@/components/ui/color-icon';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resolveIconFromList } from '@/components/ui/icon-picker';
import { MUSIC_ICONS } from '@/constants/icons';
import { DAY_NAMES } from '@/lib/dateHelpers';
import type { LessonAgreementWithTeacher } from '@/types/lesson-agreements';

export type { LessonAgreementWithTeacher as LessonAgreement };

interface LessonAgreementDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	agreement: LessonAgreementWithTeacher | null;
}

function formatTime(time: string): string {
	const [hours, minutes] = time.split(':');
	return `${hours}:${minutes}`;
}

function formatDate(date: string): string {
	return new Date(date).toLocaleDateString('nl-NL', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
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

function getTeacherInitials(teacher: LessonAgreementWithTeacher['teacher']): string {
	if (teacher.first_name && teacher.last_name) {
		return `${teacher.first_name[0]}${teacher.last_name[0]}`.toUpperCase();
	}
	if (teacher.first_name) {
		return teacher.first_name.slice(0, 2).toUpperCase();
	}
	return '??';
}

export function LessonAgreementDialog({ open, onOpenChange, agreement }: LessonAgreementDialogProps) {
	if (!agreement) {
		return null;
	}

	const Icon = agreement.lesson_type.icon ? resolveIconFromList(MUSIC_ICONS, agreement.lesson_type.icon) : undefined;
	const teacherName = getTeacherDisplayName(agreement.teacher);
	const teacherInitials = getTeacherInitials(agreement.teacher);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Lesovereenkomst Details</DialogTitle>
					<DialogDescription>Bekijk alle details van deze lesovereenkomst</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Lesson Type */}
					<div className="flex items-center gap-3">
						<ColorIcon icon={Icon} color={agreement.lesson_type.color} size="lg" />
						<div>
							<h3 className="font-semibold text-lg">{agreement.lesson_type.name}</h3>
							<Badge variant={agreement.is_active ? 'default' : 'secondary'} className="mt-1">
								{agreement.is_active ? 'Actief' : 'Inactief'}
							</Badge>
						</div>
					</div>

					{/* Teacher */}
					<div className="flex items-center gap-3">
						<Avatar className="h-12 w-12">
							<AvatarImage src={agreement.teacher.avatar_url ?? undefined} alt={teacherName} />
							<AvatarFallback className="bg-primary/10 text-primary">{teacherInitials}</AvatarFallback>
						</Avatar>
						<div>
							<p className="text-sm font-medium text-muted-foreground">Docent</p>
							<p className="font-semibold">{teacherName}</p>
						</div>
					</div>

					{/* Schedule Information */}
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<p className="text-sm font-medium text-muted-foreground">Dag</p>
							<p className="font-medium">
								{DAY_NAMES[agreement.day_of_week] ?? `Dag ${agreement.day_of_week}`}
							</p>
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">Tijd</p>
							<p className="font-medium">{formatTime(agreement.start_time)}</p>
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">Startdatum</p>
							<p className="font-medium">{formatDate(agreement.start_date)}</p>
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">Einddatum</p>
							<p className="font-medium">
								{agreement.end_date ? formatDate(agreement.end_date) : 'Geen einddatum'}
							</p>
						</div>
					</div>

					{/* Notes */}
					{agreement.notes && (
						<div>
							<p className="text-sm font-medium text-muted-foreground mb-2">Notities</p>
							<div className="rounded-md border bg-muted/50 p-3">
								<p className="text-sm whitespace-pre-wrap">{agreement.notes}</p>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
