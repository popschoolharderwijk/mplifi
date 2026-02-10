import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, type Event, type Formats, type View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { LuBan, LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu';
import { toast } from 'sonner';
import { StudentInfoCard } from '@/components/students/StudentInfoCard';
import { StudentInfoModal, type StudentInfoModalData } from '@/components/students/StudentInfoModal';
import { Button } from '@/components/ui/button';
import { ColorIcon } from '@/components/ui/color-icon';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { resolveIconFromList } from '@/components/ui/icon-picker';
import { MUSIC_ICONS } from '@/constants/icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AVAILABILITY_SETTINGS, calendarLocalizer, formatDate, formatTime } from '@/lib/dateHelpers';
import type { LessonAgreementWithStudent, LessonAppointmentDeviationWithAgreement } from '@/types/lesson-agreements';
import type { StudentEventInfo } from '@/types/students';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const DragAndDropCalendar = withDragAndDrop(Calendar);

/**
 * Dutch calendar formats for react-big-calendar
 * Uses 24-hour time format and Dutch date formatting
 */
const dutchFormats: Formats = {
	timeGutterFormat: (date: Date) => format(date, 'HH:mm', { locale: nl }),
	eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'HH:mm', { locale: nl })} - ${format(end, 'HH:mm', { locale: nl })}`,
	dayFormat: (date: Date) => format(date, 'EEEE d', { locale: nl }),
	dayHeaderFormat: (date: Date) => format(date, 'EEEE d MMMM', { locale: nl }),
	dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'd MMM', { locale: nl })} - ${format(end, 'd MMM', { locale: nl })} ${format(end, 'yyyy', { locale: nl })}`,
	monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: nl }),
	weekdayFormat: (date: Date) => format(date, 'EEE', { locale: nl }),
	agendaTimeFormat: (date: Date) => format(date, 'HH:mm', { locale: nl }),
	agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'HH:mm', { locale: nl })} - ${format(end, 'HH:mm', { locale: nl })}`,
	agendaDateFormat: (date: Date) => format(date, 'EEEE d MMMM', { locale: nl }),
	agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'd MMM', { locale: nl })} - ${format(end, 'd MMM', { locale: nl })} ${format(end, 'yyyy', { locale: nl })}`,
	selectRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'HH:mm', { locale: nl })} - ${format(end, 'HH:mm', { locale: nl })}`,
};

interface TeacherAgendaViewProps {
	teacherId: string;
	canEdit: boolean;
}

interface CalendarEvent extends Event {
	resource: {
		type: 'agreement' | 'deviation';
		agreementId: string;
		deviationId?: string;
		studentName: string;
		studentInfo?: StudentEventInfo; // Full student info for individual lessons
		studentInfoList?: StudentEventInfo[]; // List of students for group lessons
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
		isPending?: boolean; // True when event is being saved (optimistic UI)
	};
}

// Custom event component to show warning icon for deviations
interface CustomEventProps {
	event: CalendarEvent;
	title: React.ReactNode;
}

function CustomEvent({ event, title }: CustomEventProps) {
	const { isDeviation, isCancelled } = event.resource;

	return (
		<div className="h-full w-full overflow-hidden relative">
			{isCancelled && <LuBan className="absolute top-0.5 right-0.5 h-3 w-3 text-white drop-shadow-md z-10" />}
			{isDeviation && !isCancelled && (
				<LuTriangleAlert className="absolute top-0.5 right-0.5 h-3 w-3 text-white drop-shadow-md z-10" />
			)}
			<span className={`text-xs leading-tight ${isCancelled ? 'line-through' : ''}`}>{title}</span>
		</div>
	);
}

// Build tooltip text for native title attribute
function buildTooltipText(event: CalendarEvent): string {
	const {
		isDeviation,
		isCancelled,
		originalDate,
		originalStartTime,
		reason,
		lessonTypeName,
		studentName,
		isGroupLesson,
		studentCount,
	} = event.resource;

	const lines: string[] = [lessonTypeName];

	if (isGroupLesson) {
		lines.push(`${studentCount} deelnemers:`);
		// Split student names and add each on a new line
		const students = studentName.split(', ');
		for (const student of students) {
			lines.push(`  • ${student}`);
		}
	} else {
		lines.push(studentName);
	}

	if (isCancelled) {
		lines.push('');
		lines.push('❌ Les vervallen');
		if (reason) {
			lines.push(`Reden: ${reason}`);
		}
	} else if (isDeviation) {
		lines.push('');
		lines.push('⚠ Gewijzigde afspraak');
		if (originalDate && originalStartTime) {
			lines.push(`Origineel: ${formatDate(originalDate)} om ${formatTime(originalStartTime)}`);
		}
		if (reason) {
			lines.push(`Reden: ${reason}`);
		}
	}

	return lines.join('\n');
}

// Helper to calculate the date of a specific day of week in a given week
function getDateForDayOfWeek(dayOfWeek: number, referenceDate: Date): Date {
	const date = new Date(referenceDate);
	const currentDay = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
	const diff = dayOfWeek - currentDay;
	date.setDate(date.getDate() + diff);
	return date;
}

// Helper to generate recurring events from agreements
// Groups agreements by lesson type for group lessons
function generateRecurringEvents(
	agreements: LessonAgreementWithStudent[],
	rangeStart: Date,
	rangeEnd: Date,
	deviations: Map<string, LessonAppointmentDeviationWithAgreement>,
): CalendarEvent[] {
	const events: CalendarEvent[] = [];

	// Group agreements by (day_of_week, start_time, lesson_type_id) to handle group lessons
	const groupedAgreements = new Map<string, LessonAgreementWithStudent[]>();
	for (const agreement of agreements) {
		const key = `${agreement.day_of_week}-${agreement.start_time}-${agreement.lesson_type_id}`;
		const existing = groupedAgreements.get(key) || [];
		existing.push(agreement);
		groupedAgreements.set(key, existing);
	}

	// Process each group
	for (const [, group] of groupedAgreements) {
		const firstAgreement = group[0];
		const isGroupLesson = firstAgreement.lesson_types.is_group_lesson;
		const durationMinutes = firstAgreement.lesson_types.duration_minutes || 30;

		// For group lessons, combine all student names
		const studentNames = group.map((a) =>
			a.profiles?.first_name && a.profiles?.last_name
				? `${a.profiles.first_name} ${a.profiles.last_name}`
				: a.profiles?.first_name || a.profiles?.email || 'Onbekend',
		);

		// Find the first occurrence of this lesson day that falls within the range
		const firstLessonDate = new Date(rangeStart);
		const daysUntilLesson = (firstAgreement.day_of_week - firstLessonDate.getDay() + 7) % 7;
		firstLessonDate.setDate(firstLessonDate.getDate() + daysUntilLesson);

		// Use the earliest start_date and latest end_date from all agreements in the group
		const earliestStartDate = new Date(Math.min(...group.map((a) => new Date(a.start_date).getTime())));
		const latestEndDate = group.some((a) => !a.end_date)
			? null
			: new Date(
					Math.max(...group.filter((a) => a.end_date).map((a) => new Date(a.end_date as string).getTime())),
				);

		// Iterate through each occurrence
		const currentLessonDate = new Date(firstLessonDate);

		while (currentLessonDate <= rangeEnd) {
			// Check if this date is within the agreements' validity period
			if (currentLessonDate >= earliestStartDate && (!latestEndDate || currentLessonDate <= latestEndDate)) {
				const lessonDateStr = currentLessonDate.toISOString().split('T')[0];

				// For group lessons, check if any member has a deviation (for now, skip deviations for group lessons)
				// Individual lessons check for deviations
				if (!isGroupLesson && group.length === 1) {
					const deviation = deviations.get(`${firstAgreement.id}-${lessonDateStr}`);

					if (deviation) {
						const isCancelled = deviation.is_cancelled;

						// For cancelled lessons, show at original time; for moved lessons, show at actual time
						const [hours, minutes] = isCancelled
							? deviation.original_start_time.split(':')
							: deviation.actual_start_time.split(':');
						const eventDate = new Date(isCancelled ? deviation.original_date : deviation.actual_date);
						eventDate.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

						const deviationProfile = deviation.lesson_agreements.profiles;
						const deviationStudentName =
							deviationProfile?.first_name && deviationProfile?.last_name
								? `${deviationProfile.first_name} ${deviationProfile.last_name}`
								: deviationProfile?.first_name || deviationProfile?.email || 'Onbekend';

						// Build student info for deviation - need to cast because profiles has avatar_url now
						const deviationStudentInfo: StudentEventInfo | undefined = deviationProfile
							? {
									user_id: deviation.lesson_agreements.student_user_id,
									first_name: deviationProfile.first_name,
									last_name: deviationProfile.last_name,
									email: deviationProfile.email,
									avatar_url: (deviationProfile as { avatar_url?: string | null }).avatar_url ?? null,
								}
							: undefined;

						events.push({
							title: `${deviation.lesson_agreements.lesson_types.name} - ${deviationStudentName}`,
							start: eventDate,
							end: new Date(eventDate.getTime() + durationMinutes * 60 * 1000),
							resource: {
								type: 'deviation',
								agreementId: firstAgreement.id,
								deviationId: deviation.id,
								studentName: deviationStudentName,
								studentInfo: deviationStudentInfo,
								lessonTypeName: deviation.lesson_agreements.lesson_types.name,
								lessonTypeColor: deviation.lesson_agreements.lesson_types.color,
								lessonTypeIcon: deviation.lesson_agreements.lesson_types.icon,
								isDeviation: !isCancelled,
								isCancelled,
								isGroupLesson: false,
								originalDate: deviation.original_date,
								originalStartTime: deviation.original_start_time,
								reason: deviation.reason,
							},
						});
						currentLessonDate.setDate(currentLessonDate.getDate() + 7);
						continue;
					}
				}

				// Create the event
				const [hours, minutes] = firstAgreement.start_time.split(':');
				const eventDate = new Date(currentLessonDate);
				eventDate.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

				const title = isGroupLesson
					? `${firstAgreement.lesson_types.name} (${group.length} deelnemers)`
					: `${firstAgreement.lesson_types.name} - ${studentNames[0]}`;

				// Build student info for individual lessons or student list for group lessons
				const studentInfoList: StudentEventInfo[] = group
					.filter(
						(
							a,
						): a is LessonAgreementWithStudent & {
							profiles: NonNullable<LessonAgreementWithStudent['profiles']>;
						} => a.profiles !== null,
					)
					.map((a) => ({
						user_id: a.student_user_id,
						first_name: a.profiles.first_name,
						last_name: a.profiles.last_name,
						email: a.profiles.email,
						avatar_url: (a.profiles as { avatar_url?: string | null }).avatar_url ?? null,
					}));

				events.push({
					title,
					start: eventDate,
					end: new Date(eventDate.getTime() + durationMinutes * 60 * 1000),
					resource: {
						type: 'agreement',
						agreementId: firstAgreement.id,
						studentName: isGroupLesson ? studentNames.join(', ') : studentNames[0],
						studentInfo: !isGroupLesson && studentInfoList.length > 0 ? studentInfoList[0] : undefined,
						studentInfoList: isGroupLesson ? studentInfoList : undefined,
						lessonTypeName: firstAgreement.lesson_types.name,
						lessonTypeColor: firstAgreement.lesson_types.color,
						lessonTypeIcon: firstAgreement.lesson_types.icon,
						isDeviation: false,
						isCancelled: false,
						isGroupLesson,
						studentCount: isGroupLesson ? group.length : undefined,
					},
				});
			}

			// Move to next week
			currentLessonDate.setDate(currentLessonDate.getDate() + 7);
		}
	}

	return events;
}

export function TeacherAgendaView({ teacherId, canEdit }: TeacherAgendaViewProps) {
	const { user } = useAuth();
	const [agreements, setAgreements] = useState<LessonAgreementWithStudent[]>([]);
	const [deviations, setDeviations] = useState<LessonAppointmentDeviationWithAgreement[]>([]);
	const [loading, setLoading] = useState(true);
	const [currentView, setCurrentView] = useState<View>('week');
	const [currentDate, setCurrentDate] = useState(new Date());
	const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isCancelling, setIsCancelling] = useState(false);
	const [studentInfoModal, setStudentInfoModal] = useState<{
		open: boolean;
		student: StudentInfoModalData | null;
	}>({ open: false, student: null });
	// Pending event for optimistic UI during drag operations
	const [pendingEvent, setPendingEvent] = useState<CalendarEvent | null>(null);

	const loadData = useCallback(
		async (showLoading = true) => {
			if (!teacherId) return;

			if (showLoading) {
				setLoading(true);
			}

			// Load agreements
			const { data: agreementsData, error: agreementsError } = await supabase
				.from('lesson_agreements')
				.select(
					'id, day_of_week, start_time, start_date, end_date, is_active, student_user_id, lesson_type_id, lesson_types(id, name, icon, color, is_group_lesson, duration_minutes)',
				)
				.eq('teacher_id', teacherId)
				.eq('is_active', true);

			// Load profiles separately
			if (agreementsData) {
				const studentUserIds = [...new Set(agreementsData.map((a) => a.student_user_id))];
				const { data: profilesData } = await supabase
					.from('profiles')
					.select('user_id, first_name, last_name, email, avatar_url')
					.in('user_id', studentUserIds);

				// Merge profiles into agreements
				if (profilesData && agreementsData) {
					const profilesMap = new Map(profilesData.map((p) => [p.user_id, p]));
					for (const agreement of agreementsData) {
						(agreement as unknown as LessonAgreementWithStudent).profiles =
							profilesMap.get(agreement.student_user_id) || null;
					}
				}
			}

			if (agreementsError) {
				console.error('Error loading agreements:', agreementsError);
				toast.error('Fout bij laden lesovereenkomsten');
				setLoading(false);
				return;
			}

			// Load deviations
			const { data: deviationsData, error: deviationsError } = await supabase
				.from('lesson_appointment_deviations')
				.select(
					'id, lesson_agreement_id, original_date, original_start_time, actual_date, actual_start_time, reason, is_cancelled, lesson_agreements(id, day_of_week, start_time, start_date, end_date, is_active, student_user_id, lesson_type_id, lesson_types(id, name, icon, color))',
				)
				.eq('lesson_agreements.teacher_id', teacherId);

			// Load profiles for deviations
			if (deviationsData && deviationsData.length > 0) {
				const studentUserIds: string[] = [];
				for (const deviation of deviationsData) {
					const la = Array.isArray(deviation.lesson_agreements)
						? deviation.lesson_agreements[0]
						: deviation.lesson_agreements;
					if (la && typeof la === 'object' && 'student_user_id' in la && la.student_user_id) {
						studentUserIds.push(la.student_user_id as string);
					}
				}
				const uniqueStudentUserIds = [...new Set(studentUserIds)];
				if (uniqueStudentUserIds.length > 0) {
					const { data: profilesData } = await supabase
						.from('profiles')
						.select('user_id, first_name, last_name, email, avatar_url')
						.in('user_id', uniqueStudentUserIds);

					// Merge profiles into deviations
					if (profilesData) {
						const profilesMap = new Map(profilesData.map((p) => [p.user_id, p]));
						for (const deviation of deviationsData) {
							const la = Array.isArray(deviation.lesson_agreements)
								? deviation.lesson_agreements[0]
								: deviation.lesson_agreements;
							if (la && typeof la === 'object' && 'student_user_id' in la) {
								(
									la as unknown as {
										profiles: {
											first_name: string | null;
											last_name: string | null;
											email: string;
										} | null;
									}
								).profiles = profilesMap.get(la.student_user_id as string) || null;
							}
						}
					}
				}
			}

			if (deviationsError) {
				console.error('Error loading deviations:', deviationsError);
				toast.error('Fout bij laden afwijkingen');
				setLoading(false);
				return;
			}

			setAgreements((agreementsData as unknown as LessonAgreementWithStudent[]) ?? []);
			setDeviations((deviationsData as unknown as LessonAppointmentDeviationWithAgreement[]) ?? []);
			setLoading(false);
		},
		[teacherId],
	);

	useEffect(() => {
		loadData();
	}, [loadData]);

	// Create a map of deviations for quick lookup
	const deviationsMap = useMemo(() => {
		const map = new Map<string, LessonAppointmentDeviationWithAgreement>();
		for (const deviation of deviations) {
			const key = `${deviation.lesson_agreement_id}-${deviation.original_date}`;
			map.set(key, deviation);
		}
		return map;
	}, [deviations]);

	// Generate calendar events
	const events = useMemo(() => {
		const startDate = new Date(currentDate);
		startDate.setMonth(startDate.getMonth() - 1); // Show 1 month back
		const endDate = new Date(currentDate);
		endDate.setMonth(endDate.getMonth() + 2); // Show 2 months forward

		const baseEvents = generateRecurringEvents(agreements, startDate, endDate, deviationsMap);

		// If there's a pending event (optimistic update), replace the matching event
		if (pendingEvent) {
			// Find and remove the original event that's being moved
			const filteredEvents = baseEvents.filter((e) => {
				// Match by agreementId and original start time (before the move)
				const isSameAgreement = e.resource.agreementId === pendingEvent.resource.agreementId;
				// For deviations, match by deviationId; for regular events, match by the pending event's original position
				if (pendingEvent.resource.deviationId) {
					return !(isSameAgreement && e.resource.deviationId === pendingEvent.resource.deviationId);
				}
				// For regular events being moved, we need to match by the original date
				const pendingOriginalDate = pendingEvent.resource.originalDate;
				if (pendingOriginalDate && e.start) {
					const eventDateStr = new Date(e.start).toISOString().split('T')[0];
					return !(isSameAgreement && eventDateStr === pendingOriginalDate);
				}
				return true;
			});
			// Add the pending event with ghost styling
			return [...filteredEvents, pendingEvent];
		}

		return baseEvents;
	}, [agreements, deviationsMap, currentDate, pendingEvent]);

	const handleEventDrop = async ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
		if (!canEdit || !user) return;

		const agreement = agreements.find((a) => a.id === event.resource.agreementId);
		if (!agreement) return;

		// For deviation events, use the stored original date/time
		// For regular agreement events, calculate based on the week of the new position
		const isExistingDeviation = event.resource.isDeviation && event.resource.deviationId;

		let originalDateStr: string;
		let originalStartTime: string;

		if (isExistingDeviation && event.resource.originalDate && event.resource.originalStartTime) {
			// Use the stored original date/time from the deviation
			originalDateStr = event.resource.originalDate;
			originalStartTime = event.resource.originalStartTime;
		} else {
			// Calculate original_date for this week based on the agreement
			const originalDate = getDateForDayOfWeek(agreement.day_of_week, start);
			originalDateStr = originalDate.toISOString().split('T')[0];
			originalStartTime = agreement.start_time;
		}

		// Calculate new date/time
		const actualDateStr = start.toISOString().split('T')[0];
		const actualStartTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

		// Set pending event for optimistic UI (ghost event at new position)
		const pendingEventData: CalendarEvent = {
			...event,
			start,
			end,
			resource: {
				...event.resource,
				originalDate: originalDateStr,
				originalStartTime,
				isPending: true,
			},
		};
		setPendingEvent(pendingEventData);

		// Check if deviation already exists
		const existingDeviation = deviations.find(
			(d) => d.lesson_agreement_id === agreement.id && d.original_date === originalDateStr,
		);

		// Determine if this update will restore to original (for correct toast message)
		const isRestoringToOriginal = originalDateStr === actualDateStr && originalStartTime === actualStartTime;

		if (existingDeviation) {
			// Update existing deviation
			// Note: if actual matches original, the database trigger will auto-delete the deviation
			const { error } = await supabase
				.from('lesson_appointment_deviations')
				.update({
					actual_date: actualDateStr,
					actual_start_time: actualStartTime,
					last_updated_by_user_id: user.id,
				})
				.eq('id', existingDeviation.id);

			if (error) {
				console.error('Error updating deviation:', error);
				toast.error('Fout bij bijwerken afwijking');
				setPendingEvent(null);
				return;
			}

			if (isRestoringToOriginal) {
				toast.success('Les teruggezet naar originele planning');
			} else {
				toast.success('Afspraak bijgewerkt');
			}
		} else {
			// Create new deviation
			const { error } = await supabase.from('lesson_appointment_deviations').insert({
				lesson_agreement_id: agreement.id,
				original_date: originalDateStr,
				original_start_time: originalStartTime,
				actual_date: actualDateStr,
				actual_start_time: actualStartTime,
				created_by_user_id: user.id,
				last_updated_by_user_id: user.id,
			});

			if (error) {
				console.error('Error creating deviation:', error);
				toast.error('Fout bij aanmaken afwijking');
				setPendingEvent(null);
				return;
			}

			toast.success('Afspraak verplaatst');
		}

		await loadData(false);
		setPendingEvent(null);
	};

	// Handle clicking on an event to open the detail modal
	const handleEventClick = (event: CalendarEvent) => {
		if (!canEdit) return;
		setSelectedEvent(event);
		setIsModalOpen(true);
	};

	// Handle cancelling/uncancelling a lesson
	const handleCancelLesson = async () => {
		if (!selectedEvent || !user) return;

		setIsCancelling(true);

		const agreement = agreements.find((a) => a.id === selectedEvent.resource.agreementId);
		if (!agreement) {
			setIsCancelling(false);
			return;
		}

		const isCancelled = selectedEvent.resource.isCancelled;
		const isExistingDeviation = selectedEvent.resource.deviationId;

		// Calculate original date/time for this specific occurrence
		let originalDateStr: string;
		let originalStartTime: string;

		if (selectedEvent.resource.originalDate && selectedEvent.resource.originalStartTime) {
			originalDateStr = selectedEvent.resource.originalDate;
			originalStartTime = selectedEvent.resource.originalStartTime;
		} else {
			// For regular events, the start date is the original date
			originalDateStr = selectedEvent.start
				? new Date(selectedEvent.start).toISOString().split('T')[0]
				: new Date().toISOString().split('T')[0];
			originalStartTime = agreement.start_time;
		}

		if (isCancelled && isExistingDeviation) {
			// Restore the lesson: delete the cancellation deviation
			const { error } = await supabase
				.from('lesson_appointment_deviations')
				.delete()
				.eq('id', selectedEvent.resource.deviationId);

			if (error) {
				console.error('Error restoring lesson:', error);
				toast.error('Fout bij herstellen les');
				setIsCancelling(false);
				return;
			}

			toast.success('Les hersteld');
		} else if (isExistingDeviation) {
			// Update existing deviation to mark as cancelled
			const { error } = await supabase
				.from('lesson_appointment_deviations')
				.update({
					is_cancelled: true,
					actual_date: originalDateStr,
					actual_start_time: originalStartTime,
					last_updated_by_user_id: user.id,
				})
				.eq('id', selectedEvent.resource.deviationId);

			if (error) {
				console.error('Error cancelling lesson:', error);
				toast.error('Fout bij annuleren les');
				setIsCancelling(false);
				return;
			}

			toast.success('Les geannuleerd');
		} else {
			// Create new deviation with is_cancelled = true
			const { error } = await supabase.from('lesson_appointment_deviations').insert({
				lesson_agreement_id: agreement.id,
				original_date: originalDateStr,
				original_start_time: originalStartTime,
				actual_date: originalDateStr,
				actual_start_time: originalStartTime,
				is_cancelled: true,
				created_by_user_id: user.id,
				last_updated_by_user_id: user.id,
			});

			if (error) {
				console.error('Error cancelling lesson:', error);
				toast.error('Fout bij annuleren les');
				setIsCancelling(false);
				return;
			}

			toast.success('Les geannuleerd');
		}

		setIsCancelling(false);
		setIsModalOpen(false);
		setSelectedEvent(null);
		loadData(false);
	};

	const eventStyleGetter = (event: CalendarEvent) => {
		if (currentView === 'agenda') {
			return {
				style: {
					backgroundColor: 'transparent',
					border: 'none',
					color: 'inherit',
					opacity: 1,
				},
			};
		}

		const isDeviation = event.resource.isDeviation;
		const isCancelled = event.resource.isCancelled;
		const isGroupLesson = event.resource.isGroupLesson;
		const isPending = event.resource.isPending;

		// Color scheme:
		// - Green (emerald-500): regular individual lessons (same as availability)
		// - Blue (indigo-500): group lessons
		// - Yellow/Amber (amber-500): deviations from normal schedule
		// - Red (red-500): cancelled lessons (with reduced opacity)
		// - Ghost (reduced opacity + dashed border): pending/saving events
		let backgroundColor: string;
		let borderColor: string;

		if (isCancelled) {
			backgroundColor = '#ef4444'; // red-500
			borderColor = '#dc2626'; // red-600
		} else if (isDeviation || isPending) {
			// Pending events also show as amber (they will become deviations)
			backgroundColor = '#f59e0b'; // amber-500
			borderColor = '#d97706'; // amber-600
		} else if (isGroupLesson) {
			backgroundColor = '#6366f1'; // indigo-500
			borderColor = '#4f46e5'; // indigo-600
		} else {
			backgroundColor = '#10b981'; // emerald-500 (same as availability)
			borderColor = '#059669'; // emerald-600
		}

		// Determine opacity: pending events are semi-transparent (ghost effect)
		let opacity = 0.9;
		if (isCancelled) {
			opacity = 0.5;
		} else if (isPending) {
			opacity = 0.5;
		}

		return {
			style: {
				backgroundColor,
				borderColor,
				borderStyle: isPending ? 'dashed' : 'solid',
				borderWidth: '1px',
				borderLeftWidth: '4px',
				color: '#fff',
				borderRadius: '4px',
				opacity,
			},
		};
	};

	// Calculate scroll time: if current time is past END_HOUR, scroll to start (START_HOUR)
	// Otherwise scroll to current time
	const scrollToTime = useMemo(() => {
		const now = new Date();

		if (now.getHours() >= AVAILABILITY_SETTINGS.END_HOUR) {
			// After end time, scroll to start of day (for next day visibility)
			return new Date(0, 0, 0, AVAILABILITY_SETTINGS.START_HOUR, 0, 0);
		}

		// During working hours, scroll to current time
		return now;
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LuLoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold text-foreground">Agenda</h2>
					<p className="text-sm text-muted-foreground">
						{canEdit
							? 'Bekijk en beheer lessen. Sleep afspraken om ze te verplaatsen.'
							: 'Bekijk de geplande lessen voor deze docent'}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<select
						value={currentView}
						onChange={(e) => setCurrentView(e.target.value as View)}
						className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
					>
						<option value="month">Maand</option>
						<option value="week">Week</option>
						<option value="day">Dag</option>
						<option value="agenda">Agenda</option>
					</select>
					<Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
						Vandaag
					</Button>
				</div>
			</div>

			<div className="popschool-calendar rounded-lg border border-border bg-card overflow-hidden">
				<div className="h-[600px]">
					<DragAndDropCalendar
						localizer={calendarLocalizer}
						formats={dutchFormats}
						culture="nl-NL"
						events={events}
						startAccessor={(event) => (event as CalendarEvent).start}
						endAccessor={(event) => (event as CalendarEvent).end}
						view={currentView}
						onView={setCurrentView}
						date={currentDate}
						onNavigate={setCurrentDate}
						onSelectEvent={(event) => handleEventClick(event as CalendarEvent)}
						onEventDrop={canEdit ? handleEventDrop : undefined}
						onEventResize={canEdit ? handleEventDrop : undefined}
						draggableAccessor={() => canEdit}
						resizableAccessor={() => canEdit}
						eventPropGetter={eventStyleGetter}
						tooltipAccessor={(event) => buildTooltipText(event as CalendarEvent)}
						components={{
							// biome-ignore lint/suspicious/noExplicitAny: react-big-calendar event component typing is complex
							event: CustomEvent as unknown as React.ComponentType<any>,
						}}
						min={new Date(0, 0, 0, 9, 0, 0)}
						max={new Date(0, 0, 0, 21, 0, 0)}
						scrollToTime={scrollToTime}
						step={30}
						timeslots={1}
						messages={{
							next: 'Volgende',
							previous: 'Vorige',
							today: 'Vandaag',
							month: 'Maand',
							week: 'Week',
							day: 'Dag',
							agenda: 'Agenda',
							date: 'Datum',
							time: 'Tijd',
							event: 'Afspraak',
							noEventsInRange: 'Geen afspraken in dit bereik',
							showMore: (total) => `+${total} meer`,
						}}
					/>
				</div>
			</div>

			{/* Legend - only show when not in agenda view */}
			{currentView !== 'agenda' && (
				<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
					<div className="flex items-center gap-2">
						<div className="h-4 w-4 rounded border border-l-4 border-emerald-600 bg-emerald-500" />
						<span>Individuele les</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="h-4 w-4 rounded border border-l-4 border-indigo-600 bg-indigo-500" />
						<span>Groepsles</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="h-4 w-4 rounded border border-l-4 border-amber-600 bg-amber-500" />
						<span>⚠ Afwijkende afspraak</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="h-4 w-4 rounded border border-l-4 border-red-600 bg-red-500 opacity-50" />
						<span>❌ Vervallen les</span>
					</div>
				</div>
			)}

			{/* Lesson Detail Modal */}
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent>
					<DialogHeader>
						<div className="flex items-center gap-3">
							<ColorIcon
								icon={
									selectedEvent?.resource.lessonTypeIcon
										? resolveIconFromList(MUSIC_ICONS, selectedEvent.resource.lessonTypeIcon)
										: undefined
								}
								color={selectedEvent?.resource.lessonTypeColor ?? null}
								size="lg"
							/>
							<div>
								<DialogTitle>{selectedEvent?.resource.lessonTypeName}</DialogTitle>
								{selectedEvent?.resource.isGroupLesson && (
									<DialogDescription>
										Groepsles met {selectedEvent?.resource.studentCount} deelnemers
									</DialogDescription>
								)}
							</div>
						</div>
					</DialogHeader>

					<div className="space-y-4">
						{/* Student info card for individual lessons */}
						{selectedEvent?.resource.studentInfo && !selectedEvent.resource.isGroupLesson && (
							<StudentInfoCard
								student={{
									id: selectedEvent.resource.agreementId,
									user_id: selectedEvent.resource.studentInfo.user_id,
									profile: {
										email: selectedEvent.resource.studentInfo.email,
										first_name: selectedEvent.resource.studentInfo.first_name,
										last_name: selectedEvent.resource.studentInfo.last_name,
										avatar_url: selectedEvent.resource.studentInfo.avatar_url,
									},
								}}
								onClick={() => {
									const info = selectedEvent.resource.studentInfo;
									if (!info) return;
									setStudentInfoModal({
										open: true,
										student: {
											id: selectedEvent.resource.agreementId,
											user_id: info.user_id,
											profile: {
												email: info.email,
												first_name: info.first_name,
												last_name: info.last_name,
												avatar_url: info.avatar_url,
												phone_number: null, // Will be loaded by the modal
											},
										},
									});
								}}
							/>
						)}

						{/* Group lesson participants */}
						{selectedEvent?.resource.isGroupLesson && selectedEvent.resource.studentInfoList && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium">Deelnemers</h4>
								<div className="space-y-2 max-h-48 overflow-y-auto">
									{selectedEvent.resource.studentInfoList.map((student) => (
										<StudentInfoCard
											key={student.user_id}
											student={{
												id: selectedEvent.resource.agreementId,
												user_id: student.user_id,
												profile: {
													email: student.email,
													first_name: student.first_name,
													last_name: student.last_name,
													avatar_url: student.avatar_url,
												},
											}}
											onClick={() => {
												setStudentInfoModal({
													open: true,
													student: {
														id: selectedEvent.resource.agreementId,
														user_id: student.user_id,
														profile: {
															email: student.email,
															first_name: student.first_name,
															last_name: student.last_name,
															avatar_url: student.avatar_url,
															phone_number: null, // Will be loaded by the modal
														},
													},
												});
											}}
											className="py-2"
										/>
									))}
								</div>
							</div>
						)}

						{/* Fallback for group lessons without studentInfoList (shouldn't happen) */}
						{selectedEvent?.resource.isGroupLesson && !selectedEvent.resource.studentInfoList && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium">Deelnemers</h4>
								<ul className="space-y-1">
									{selectedEvent.resource.studentName.split(', ').map((name) => (
										<li key={name} className="text-sm text-muted-foreground">
											• {name}
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Lesson time info */}
						<div className="rounded-lg bg-muted p-4 space-y-2">
							<div className="flex justify-between">
								<span className="text-sm text-muted-foreground">Datum</span>
								<span className="font-medium">
									{selectedEvent?.start
										? formatDate(new Date(selectedEvent.start).toISOString().split('T')[0])
										: ''}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-sm text-muted-foreground">Tijd</span>
								<span className="font-medium">
									{selectedEvent?.start
										? `${String(new Date(selectedEvent.start).getHours()).padStart(2, '0')}:${String(new Date(selectedEvent.start).getMinutes()).padStart(2, '0')}`
										: ''}
									{' - '}
									{selectedEvent?.end
										? `${String(new Date(selectedEvent.end).getHours()).padStart(2, '0')}:${String(new Date(selectedEvent.end).getMinutes()).padStart(2, '0')}`
										: ''}
								</span>
							</div>
						</div>

						{/* Status info */}
						{selectedEvent?.resource.isCancelled && (
							<div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-red-600">
								<LuBan className="h-4 w-4" />
								<span className="text-sm font-medium">Deze les is geannuleerd</span>
							</div>
						)}

						{selectedEvent?.resource.isDeviation && !selectedEvent?.resource.isCancelled && (
							<div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-amber-600">
								<LuTriangleAlert className="h-4 w-4" />
								<div className="space-y-1">
									<span className="text-sm font-medium">Afwijkende afspraak</span>
									{selectedEvent.resource.originalDate &&
										selectedEvent.resource.originalStartTime && (
											<p className="text-xs">
												Origineel: {formatDate(selectedEvent.resource.originalDate)} om{' '}
												{formatTime(selectedEvent.resource.originalStartTime)}
											</p>
										)}
									{selectedEvent.resource.reason && (
										<p className="text-xs">Reden: {selectedEvent.resource.reason}</p>
									)}
								</div>
							</div>
						)}
					</div>

					{canEdit && !selectedEvent?.resource.isGroupLesson && (
						<DialogFooter>
							{selectedEvent?.resource.isCancelled ? (
								<Button onClick={handleCancelLesson} disabled={isCancelling}>
									{isCancelling ? (
										<>
											<LuLoaderCircle className="mr-2 h-4 w-4 animate-spin" />
											Bezig...
										</>
									) : (
										'Les herstellen'
									)}
								</Button>
							) : (
								<Button variant="destructive" onClick={handleCancelLesson} disabled={isCancelling}>
									{isCancelling ? (
										<>
											<LuLoaderCircle className="mr-2 h-4 w-4 animate-spin" />
											Bezig...
										</>
									) : (
										'Les annuleren'
									)}
								</Button>
							)}
						</DialogFooter>
					)}
				</DialogContent>
			</Dialog>

			{/* Student Info Modal */}
			<StudentInfoModal
				open={studentInfoModal.open}
				onOpenChange={(open) => setStudentInfoModal({ ...studentInfoModal, open })}
				student={studentInfoModal.student}
			/>
		</div>
	);
}
