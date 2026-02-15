import type { Event } from 'react-big-calendar';
import type { StudentEventInfo } from '@/types/students';

export interface TeacherAgendaViewProps {
	teacherId: string;
	canEdit: boolean;
}

export interface CalendarEventResource {
	type: 'agreement' | 'deviation';
	agreementId: string;
	deviationId?: string;
	studentName: string;
	studentInfo?: StudentEventInfo;
	studentInfoList?: StudentEventInfo[];
	lessonTypeName: string;
	lessonTypeColor: string | null;
	lessonTypeIcon: string | null;
	isDeviation: boolean;
	isCancelled: boolean;
	isGroupLesson: boolean;
	studentCount?: number;
	originalDate?: string;
	originalStartTime?: string;
	reason?: string | null;
	isPending?: boolean;
	isRecurring?: boolean;
}

export interface CalendarEvent extends Event {
	resource: CalendarEventResource;
}
