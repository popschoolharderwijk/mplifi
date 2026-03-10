import type { Event } from 'react-big-calendar';
import type { User } from '@/types/users';

export interface CalendarEventResource {
	type: 'agreement' | 'deviation' | 'agenda';
	agreementId: string;
	/** Agenda event id (for lesson appointments and manual events); used for RPCs and deviations */
	eventId?: string;
	deviationId?: string;
	studentName: string;
	user?: User;
	users?: User[];
	lessonTypeName: string;
	lessonTypeColor: string | null;
	lessonTypeIcon: string | null;
	isDeviation: boolean;
	/** True when deviation changed date/time (not only title/description/color/participants). Used for "Gewijzigde afspraak" icon and banner. */
	hasTimeOrDateChange?: boolean;
	isCancelled: boolean;
	isGroupLesson: boolean;
	studentCount?: number;
	originalDate?: string;
	originalStartTime?: string;
	reason?: string | null;
	isPending?: boolean;
	isRecurring?: boolean;
	/** Participant user ids (for agenda events) */
	participants?: string[];
	participantCount?: number;
	/** Participant display names for tooltip (when multiple participants) */
	participantNames?: string[];
	/** When type is agenda: manual events can be edited/deleted; lesson_agreement cannot */
	sourceType?: 'manual' | 'lesson_agreement';
	/** Custom color for the event (hex) */
	color?: string | null;
	/** True when this event is linked to a lesson_agreement */
	isLesson?: boolean;
	/** Teacher name for lesson events (used in tooltip for student view) */
	teacherName?: string;
	/** True when the viewer is the teacher of this lesson */
	viewerIsTeacher?: boolean;
}

export interface CalendarEvent extends Event {
	resource: CalendarEventResource;
}
