import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, type Event, type Formats, type View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { LuLoaderCircle } from 'react-icons/lu';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AVAILABILITY_SETTINGS, calendarLocalizer } from '@/lib/dateHelpers';
import type { LessonAgreementWithStudent, LessonAppointmentDeviationWithAgreement } from '@/types/lesson-agreements';
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
		`${format(start, 'd MMM', { locale: nl })} - ${format(end, 'd MMM yyyy', { locale: nl })}`,
	monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: nl }),
	weekdayFormat: (date: Date) => format(date, 'EEE', { locale: nl }),
	agendaTimeFormat: (date: Date) => format(date, 'HH:mm', { locale: nl }),
	agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
		`${format(start, 'HH:mm', { locale: nl })} - ${format(end, 'HH:mm', { locale: nl })}`,
	agendaDateFormat: (date: Date) => format(date, 'EEEE d MMMM', { locale: nl }),
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
		lessonTypeName: string;
		lessonTypeColor: string | null;
		isDeviation: boolean;
		isGroupLesson: boolean;
		studentCount?: number;
	};
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
						const [hours, minutes] = deviation.actual_start_time.split(':');
						const eventDate = new Date(deviation.actual_date);
						eventDate.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

						const deviationStudentName =
							deviation.lesson_agreements.profiles?.first_name &&
							deviation.lesson_agreements.profiles?.last_name
								? `${deviation.lesson_agreements.profiles.first_name} ${deviation.lesson_agreements.profiles.last_name}`
								: deviation.lesson_agreements.profiles?.first_name ||
									deviation.lesson_agreements.profiles?.email ||
									'Onbekend';

						events.push({
							title: `${deviation.lesson_agreements.lesson_types.name} - ${deviationStudentName}`,
							start: eventDate,
							end: new Date(eventDate.getTime() + durationMinutes * 60 * 1000),
							resource: {
								type: 'deviation',
								agreementId: firstAgreement.id,
								deviationId: deviation.id,
								studentName: deviationStudentName,
								lessonTypeName: deviation.lesson_agreements.lesson_types.name,
								lessonTypeColor: deviation.lesson_agreements.lesson_types.color,
								isDeviation: true,
								isGroupLesson: false,
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

				events.push({
					title,
					start: eventDate,
					end: new Date(eventDate.getTime() + durationMinutes * 60 * 1000),
					resource: {
						type: 'agreement',
						agreementId: firstAgreement.id,
						studentName: isGroupLesson ? studentNames.join(', ') : studentNames[0],
						lessonTypeName: firstAgreement.lesson_types.name,
						lessonTypeColor: firstAgreement.lesson_types.color,
						isDeviation: false,
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

	const loadData = useCallback(async () => {
		if (!teacherId) return;

		setLoading(true);

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
				.select('user_id, first_name, last_name, email')
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
				'id, lesson_agreement_id, original_date, original_start_time, actual_date, actual_start_time, reason, lesson_agreements(id, day_of_week, start_time, start_date, end_date, is_active, student_user_id, lesson_type_id, lesson_types(id, name, icon, color))',
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
					.select('user_id, first_name, last_name, email')
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
	}, [teacherId]);

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

		return generateRecurringEvents(agreements, startDate, endDate, deviationsMap);
	}, [agreements, deviationsMap, currentDate]);

	const handleEventDrop = async ({ event, start }: { event: CalendarEvent; start: Date; end: Date }) => {
		if (!canEdit || !user) return;

		const agreement = agreements.find((a) => a.id === event.resource.agreementId);
		if (!agreement) return;

		// Calculate original_date for this week
		const originalDate = getDateForDayOfWeek(agreement.day_of_week, start);
		const originalDateStr = originalDate.toISOString().split('T')[0];
		const originalStartTime = agreement.start_time;

		// Calculate new date/time
		const actualDateStr = start.toISOString().split('T')[0];
		const actualStartTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

		// Check if new date/time matches original (delete deviation)
		if (originalDateStr === actualDateStr && originalStartTime === actualStartTime) {
			// Delete deviation if it exists
			if (event.resource.deviationId) {
				const { error } = await supabase
					.from('lesson_appointment_deviations')
					.delete()
					.eq('id', event.resource.deviationId);

				if (error) {
					console.error('Error deleting deviation:', error);
					toast.error('Fout bij verwijderen afwijking');
					return;
				}

				toast.success('Les teruggezet naar originele planning');
				loadData();
				return;
			}
		}

		// Check if deviation already exists
		const existingDeviation = deviations.find(
			(d) => d.lesson_agreement_id === agreement.id && d.original_date === originalDateStr,
		);

		if (existingDeviation) {
			// Update existing deviation
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
				return;
			}

			toast.success('Afspraak bijgewerkt');
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
				return;
			}

			toast.success('Afspraak verplaatst');
		}

		loadData();
	};

	const eventStyleGetter = (event: CalendarEvent) => {
		const color = event.resource.lessonTypeColor || '#3b82f6';
		const isDeviation = event.resource.isDeviation;

		return {
			style: {
				backgroundColor: color,
				borderColor: isDeviation ? color : 'transparent',
				borderStyle: isDeviation ? 'dashed' : 'solid',
				borderWidth: isDeviation ? '2px' : '1px',
				color: '#fff',
				borderRadius: '4px',
				opacity: 0.9,
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
						onEventDrop={canEdit ? handleEventDrop : undefined}
						onEventResize={canEdit ? handleEventDrop : undefined}
						draggableAccessor={() => canEdit}
						resizableAccessor={() => canEdit}
						eventPropGetter={eventStyleGetter}
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

			{/* Legend */}
			<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
				<div className="flex items-center gap-2">
					<div className="h-3 w-3 rounded border-2 border-dashed border-primary bg-primary/80" />
					<span>Afwijking van normale planning</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="h-3 w-3 rounded bg-[#6366F1]" />
					<span>Groepsles (meerdere deelnemers)</span>
				</div>
			</div>
		</div>
	);
}
