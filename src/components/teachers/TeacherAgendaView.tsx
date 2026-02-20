import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, type View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { LuLoaderCircle } from 'react-icons/lu';
import { toast } from 'sonner';
import { StudentInfoModal, type StudentInfoModalData } from '@/components/students/StudentInfoModal';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PostgresErrorCodes } from '@/integrations/supabase/errorcodes';
import { AVAILABILITY_CONFIG } from '@/lib/availability';
import { calendarLocalizer } from '@/lib/calendar';
import { formatDateToDb, getDateForDayOfWeek, now } from '@/lib/date/date-format';
import { normalizeTime, normalizeTimeFromDate } from '@/lib/time/time-format';
import type { LessonAgreementWithStudent, LessonAppointmentDeviationWithAgreement } from '@/types/lesson-agreements';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { CalendarViewProvider } from './agenda/CalendarViewContext';
import { ConfirmCancelDialog } from './agenda/ConfirmCancelDialog';
import { DetailModal } from './agenda/DetailModal';
import { AgendaEvent } from './agenda/Event';
import { Legend } from './agenda/Legend';
import { RecurrenceChoiceDialog, type RecurrenceScope } from './agenda/RecurrenceChoiceDialog';
import type { CalendarEvent, TeacherAgendaViewProps } from './agenda/types';
import { buildTooltipText, dutchFormats, generateRecurringEvents } from './agenda/utils';

const DragAndDropCalendar = withDragAndDrop(Calendar);

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
	const [isReverting, setIsReverting] = useState(false);
	const [cancelLessonConfirmOpen, setCancelLessonConfirmOpen] = useState(false);
	const [recurrenceChoiceOpen, setRecurrenceChoiceOpen] = useState(false);
	const [recurrenceChoiceAction, setRecurrenceChoiceAction] = useState<'change' | 'cancel'>('change');
	const [pendingDrop, setPendingDrop] = useState<{
		event: CalendarEvent;
		start: Date;
		end: Date;
	} | null>(null);
	const [pendingCancelScope, setPendingCancelScope] = useState<RecurrenceScope>('single');
	const [studentInfoModal, setStudentInfoModal] = useState<{
		open: boolean;
		student: StudentInfoModalData | null;
	}>({ open: false, student: null });
	const [pendingEvent, setPendingEvent] = useState<CalendarEvent | null>(null);

	const loadData = useCallback(
		async (showLoading = true) => {
			if (!teacherId) return;

			if (showLoading) {
				setLoading(true);
			}

			const { data: agreementsData, error: agreementsError } = await supabase
				.from('lesson_agreements')
				.select(
					'id, day_of_week, start_time, start_date, end_date, is_active, student_user_id, lesson_type_id, lesson_types(id, name, icon, color, is_group_lesson, duration_minutes, frequency)',
				)
				.eq('teacher_id', teacherId)
				.eq('is_active', true);

			if (agreementsData) {
				const studentUserIds = [...new Set(agreementsData.map((a) => a.student_user_id))];
				const { data: profilesData } = await supabase
					.from('profiles')
					.select('user_id, first_name, last_name, email, avatar_url')
					.in('user_id', studentUserIds);

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

			const { data: deviationsData, error: deviationsError } = await supabase
				.from('lesson_appointment_deviations')
				.select(
					'id, lesson_agreement_id, original_date, original_start_time, actual_date, actual_start_time, reason, is_cancelled, recurring, recurring_end_date, lesson_agreements(id, day_of_week, start_time, start_date, end_date, is_active, student_user_id, lesson_type_id, lesson_types(id, name, icon, color, frequency))',
				)
				.eq('lesson_agreements.teacher_id', teacherId);

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

	const deviationsMap = useMemo(() => {
		const map = new Map<string, LessonAppointmentDeviationWithAgreement>();
		for (const deviation of deviations) {
			const key = `${deviation.lesson_agreement_id}-${deviation.original_date}`;
			map.set(key, deviation);
		}
		return map;
	}, [deviations]);

	const recurringByAgreement = useMemo(() => {
		const map = new Map<string, LessonAppointmentDeviationWithAgreement[]>();
		for (const deviation of deviations) {
			if (!deviation.recurring) continue;
			const list = map.get(deviation.lesson_agreement_id) ?? [];
			list.push(deviation);
			map.set(deviation.lesson_agreement_id, list);
		}
		for (const list of map.values()) {
			list.sort((a, b) => b.original_date.localeCompare(a.original_date));
		}
		return map;
	}, [deviations]);

	const events = useMemo(() => {
		const startDate = new Date(currentDate);
		startDate.setMonth(startDate.getMonth() - 1);
		const endDate = new Date(currentDate);
		endDate.setMonth(endDate.getMonth() + 2);

		const baseEvents = generateRecurringEvents(agreements, startDate, endDate, deviationsMap, recurringByAgreement);

		if (pendingEvent) {
			const filteredEvents = baseEvents.filter((e) => {
				const isSameAgreement = e.resource.agreementId === pendingEvent.resource.agreementId;
				if (pendingEvent.resource.deviationId) {
					return !(isSameAgreement && e.resource.deviationId === pendingEvent.resource.deviationId);
				}
				const pendingOriginalDate = pendingEvent.resource.originalDate;
				if (pendingOriginalDate && e.start) {
					const eventDateStr = formatDateToDb(e.start);
					return !(isSameAgreement && eventDateStr === pendingOriginalDate);
				}
				return true;
			});
			return [...filteredEvents, pendingEvent];
		}

		return baseEvents;
	}, [agreements, deviationsMap, recurringByAgreement, currentDate, pendingEvent]);

	const handleEventDrop = async (
		{ event, start, end }: { event: CalendarEvent; start: Date; end: Date },
		scope: RecurrenceScope,
	) => {
		if (!canEdit || !user) return;

		const agreement = agreements.find((a) => a.id === event.resource.agreementId);
		if (!agreement) return;

		const isExistingDeviation = event.resource.isDeviation && event.resource.deviationId;
		const isRecurringDeviation = isExistingDeviation && event.resource.isRecurring;
		const recurring = scope === 'thisAndFuture';

		let originalDateStr: string;
		let originalStartTime: string;

		if (isExistingDeviation && event.resource.originalDate && event.resource.originalStartTime) {
			originalDateStr = event.resource.originalDate;
			originalStartTime = event.resource.originalStartTime;
		} else {
			originalDateStr = event.start ? formatDateToDb(event.start) : formatDateToDb(start);
			originalStartTime = agreement.start_time;
		}

		// For recurring deviations: agreement's weekday in the occurrence's week (for override lookup).
		const occurrenceWeekOriginalDate = event.start
			? getDateForDayOfWeek(agreement.day_of_week, new Date(event.start))
			: null;
		const occurrenceWeekOriginalDateStr = occurrenceWeekOriginalDate
			? formatDateToDb(occurrenceWeekOriginalDate)
			: '';

		// Are we editing a later occurrence of a recurring deviation? (e.g., week 4 when deviation is from week 1)
		const isLaterRecurringOccurrence =
			isRecurringDeviation && occurrenceWeekOriginalDateStr && occurrenceWeekOriginalDateStr !== originalDateStr;

		if (isLaterRecurringOccurrence) {
			// For "only this" on a later occurrence: create a NEW deviation for this week.
			// The original_date must be the AGREEMENT's original day for this week
			// because the deviations Map is keyed by agreement_id + agreement's original date.
			// The DB trigger (enforce_deviation_validity) allows actual = original when
			// it serves as an override for a recurring deviation.
			originalDateStr = occurrenceWeekOriginalDateStr;
			originalStartTime = normalizeTime(agreement.start_time);
		}

		// Use dropped date (DB: actual_date >= CURRENT_DATE).
		const actualDateStr = formatDateToDb(start);
		const actualStartTime = normalizeTimeFromDate(start);

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

		// For later occurrences of a recurring deviation, look up by (agreement_id, originalDateStr)
		// to find/create a deviation for THIS specific week, not the recurring row.
		// For non-recurring or the original occurrence, use deviationId to find the existing row.
		const existingDeviation = isLaterRecurringOccurrence
			? deviations.find((d) => d.lesson_agreement_id === agreement.id && d.original_date === originalDateStr)
			: event.resource.deviationId
				? deviations.find((d) => d.id === event.resource.deviationId)
				: deviations.find((d) => d.lesson_agreement_id === agreement.id && d.original_date === originalDateStr);

		const isRestoringToOriginal =
			originalDateStr === actualDateStr && normalizeTime(originalStartTime) === normalizeTime(actualStartTime);

		// For recurring deviation "this and future" restore: user dropped on agreement's original slot.
		// This checks if the user is restoring to the agreement's original schedule for this week.
		const isRestoringRecurringToOriginalSlot =
			isRecurringDeviation &&
			actualDateStr === occurrenceWeekOriginalDateStr &&
			normalizeTime(actualStartTime) === normalizeTime(agreement.start_time);

		// No-op: dropped on same slot as current (no change)
		const droppedOnSameSlot = existingDeviation
			? actualDateStr === existingDeviation.actual_date &&
				normalizeTime(actualStartTime) === normalizeTime(existingDeviation.actual_start_time)
			: event.start &&
				actualDateStr === formatDateToDb(event.start) &&
				normalizeTime(actualStartTime) === normalizeTimeFromDate(event.start);

		if (droppedOnSameSlot) {
			setPendingEvent(null);
			return;
		}

		// Restore to original slot: one DB rule handles all cases (recurring/single, only this/this and future)
		if (isRestoringToOriginal || isRestoringRecurringToOriginalSlot) {
			const weekWhereUserDropped = occurrenceWeekOriginalDateStr ?? originalDateStr;
			const scopeParam = recurring ? 'this_and_future' : 'only_this';

			const { data: result, error } = await supabase.rpc('ensure_week_shows_original_slot', {
				p_lesson_agreement_id: agreement.id,
				p_week_date: weekWhereUserDropped,
				p_user_id: user.id,
				p_scope: scopeParam,
			});

			if (error) {
				console.error('Error restoring to original:', error);
				toast.error('Fout bij terugzetten');
				setPendingEvent(null);
				return;
			}
			if (result === 'recurring_deleted' || result === 'recurring_ended') {
				toast.success(
					result === 'recurring_deleted'
						? 'Terugkerende wijziging verwijderd'
						: 'Terugkerende wijziging beëindigd vanaf deze week',
				);
			} else if (result === 'recurring_shifted') {
				toast.success('Alleen deze afspraak teruggezet; terugkerende wijziging start volgende week');
			} else {
				toast.success('Les teruggezet naar originele planning');
			}
			await loadData(false);
			setPendingEvent(null);
			return;
		}

		// Update if a row already exists (unique on agreement_id + original_date); otherwise insert
		if (existingDeviation) {
			const { error } = await supabase
				.from('lesson_appointment_deviations')
				.update({
					actual_date: actualDateStr,
					actual_start_time: actualStartTime,
					recurring,
					last_updated_by_user_id: user.id,
				})
				.eq('id', existingDeviation.id);

			if (error) {
				console.error('Error updating deviation:', error);
				const isDateCheck =
					error.code === PostgresErrorCodes.CHECK_VIOLATION ||
					(error.message ?? '').toLowerCase().includes('deviation_date_check');
				toast.error(
					isDateCheck
						? 'Afspraak kan niet in het verleden worden geplaatst.'
						: 'Fout bij bijwerken afwijking',
				);
				setPendingEvent(null);
				return;
			}
			toast.success('Afspraak bijgewerkt');
		} else {
			const { error } = await supabase.from('lesson_appointment_deviations').insert({
				lesson_agreement_id: agreement.id,
				original_date: originalDateStr,
				original_start_time: normalizeTime(originalStartTime),
				actual_date: actualDateStr,
				actual_start_time: actualStartTime,
				recurring,
				created_by_user_id: user.id,
				last_updated_by_user_id: user.id,
			});

			if (error) {
				console.error('Error creating deviation:', error);
				const isDateCheck =
					error.code === PostgresErrorCodes.CHECK_VIOLATION ||
					(error.message ?? '').toLowerCase().includes('deviation_date_check');
				toast.error(
					isDateCheck ? 'Afspraak kan niet in het verleden worden geplaatst.' : 'Fout bij aanmaken afwijking',
				);
				setPendingEvent(null);
				return;
			}

			toast.success('Afspraak verplaatst');
		}

		await loadData(false);
		setPendingEvent(null);
	};

	const needsRecurrenceChoice = (event: CalendarEvent) => {
		// Single deviation (already detached): no popup, move directly
		if (event.resource.isDeviation && event.resource.deviationId && event.resource.isRecurring === false) {
			return false;
		}
		// Original series or recurring deviation: show choice
		return true;
	};

	const isDropBackToOriginalSlot = (args: { event: CalendarEvent; start: Date }) => {
		const { event, start } = args;
		const agreement = agreements.find((a) => a.id === event.resource.agreementId);
		if (!agreement) return false;

		// For deviations: "original slot" is the agreement's original position
		// For later occurrences of recurring deviations: we need to check against the
		// agreement's original slot for THIS SPECIFIC WEEK, not the deviation's stored original_date
		const isRecurringDeviation =
			event.resource.isDeviation && event.resource.deviationId && event.resource.isRecurring;

		// Get the agreement's original slot for the week of the current event
		const eventWeekOriginalDate = event.start
			? getDateForDayOfWeek(agreement.day_of_week, new Date(event.start))
			: null;
		const eventWeekOriginalDateStr = eventWeekOriginalDate ? formatDateToDb(eventWeekOriginalDate) : '';

		// For recurring deviations, the "original slot" to restore to is the agreement's slot for this week
		// For regular deviations, use the stored original_date
		let originalDateStr: string;
		let originalStartTime: string;

		if (isRecurringDeviation) {
			// For later occurrences of recurring deviations: compare against agreement's original slot
			originalDateStr = eventWeekOriginalDateStr;
			originalStartTime = agreement.start_time;
		} else if (event.resource.isDeviation && event.resource.originalDate && event.resource.originalStartTime) {
			originalDateStr = event.resource.originalDate;
			originalStartTime = event.resource.originalStartTime;
		} else {
			originalDateStr = event.start ? formatDateToDb(event.start) : '';
			originalStartTime = agreement.start_time;
		}

		const actualDateStr = formatDateToDb(start);
		const actualStartTime = normalizeTimeFromDate(start);
		return actualDateStr === originalDateStr && normalizeTime(actualStartTime) === normalizeTime(originalStartTime);
	};

	const onEventDropWithChoice = (args: { event: CalendarEvent; start: Date; end: Date }) => {
		const isRecurringDeviation =
			args.event.resource.isDeviation && args.event.resource.deviationId && args.event.resource.isRecurring;

		if (isDropBackToOriginalSlot(args)) {
			// For recurring deviations: show choice dialog even when restoring to original
			// User may want to restore "only this week" or "this and future"
			if (isRecurringDeviation) {
				setPendingDrop(args);
				setRecurrenceChoiceAction('change');
				setRecurrenceChoiceOpen(true);
				return;
			}
			// For non-recurring deviations: restore directly
			if (args.event.resource.isDeviation && args.event.resource.deviationId) {
				handleEventDrop(args, 'single');
			}
			return;
		}
		if (!needsRecurrenceChoice(args.event)) {
			handleEventDrop(args, 'single');
			return;
		}
		setPendingDrop(args);
		setRecurrenceChoiceAction('change');
		setRecurrenceChoiceOpen(true);
	};

	const handleEventClick = (event: CalendarEvent) => {
		if (!canEdit) return;
		setSelectedEvent(event);
		setIsModalOpen(true);
	};

	const handleCancelLesson = async (scope: RecurrenceScope = 'single') => {
		if (!selectedEvent || !user) return;

		setIsCancelling(true);
		const recurring = scope === 'thisAndFuture';

		const agreement = agreements.find((a) => a.id === selectedEvent.resource.agreementId);
		if (!agreement) {
			setIsCancelling(false);
			return;
		}

		const isCancelled = selectedEvent.resource.isCancelled;
		const isExistingDeviation = selectedEvent.resource.deviationId;

		let originalDateStr: string;
		let originalStartTime: string;

		if (selectedEvent.resource.originalDate && selectedEvent.resource.originalStartTime) {
			originalDateStr = selectedEvent.resource.originalDate;
			originalStartTime = selectedEvent.resource.originalStartTime;
		} else {
			originalDateStr = selectedEvent.start ? formatDateToDb(selectedEvent.start) : formatDateToDb(now());
			originalStartTime = agreement.start_time;
		}

		if (isCancelled && isExistingDeviation) {
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
			const { error } = await supabase
				.from('lesson_appointment_deviations')
				.update({
					is_cancelled: true,
					actual_date: originalDateStr,
					actual_start_time: originalStartTime,
					recurring,
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
			const { error } = await supabase.from('lesson_appointment_deviations').insert({
				lesson_agreement_id: agreement.id,
				original_date: originalDateStr,
				original_start_time: originalStartTime,
				actual_date: originalDateStr,
				actual_start_time: originalStartTime,
				is_cancelled: true,
				recurring,
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
		setCancelLessonConfirmOpen(false);
		loadData(false);
	};

	const handleRevertToOriginal = async () => {
		if (
			!user ||
			!selectedEvent?.resource.deviationId ||
			!selectedEvent.resource.originalDate ||
			!selectedEvent.resource.originalStartTime
		)
			return;
		setIsReverting(true);
		const { error } = await supabase
			.from('lesson_appointment_deviations')
			.update({
				actual_date: selectedEvent.resource.originalDate,
				actual_start_time: selectedEvent.resource.originalStartTime,
				last_updated_by_user_id: user.id,
			})
			.eq('id', selectedEvent.resource.deviationId);

		if (error) {
			console.error('Error reverting deviation:', error);
			toast.error('Fout bij terugzetten afspraak');
			setIsReverting(false);
			return;
		}
		toast.success('Afspraak teruggezet naar origineel');
		setIsReverting(false);
		setIsModalOpen(false);
		setSelectedEvent(null);
		loadData(false);
	};

	const handleRevertRecurringAll = async () => {
		if (!selectedEvent?.resource.deviationId || !user) return;
		setIsReverting(true);
		const { error } = await supabase
			.from('lesson_appointment_deviations')
			.delete()
			.eq('id', selectedEvent.resource.deviationId);

		if (error) {
			console.error('Error reverting recurring deviation:', error);
			toast.error('Fout bij herstellen');
			setIsReverting(false);
			return;
		}
		toast.success('Alle volgende afspraken hersteld');
		setIsReverting(false);
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

		let backgroundColor: string;
		let borderColor: string;

		if (isCancelled) {
			backgroundColor = '#ef4444';
			borderColor = '#dc2626';
		} else if (isDeviation || isPending) {
			backgroundColor = '#f59e0b';
			borderColor = '#d97706';
		} else if (isGroupLesson) {
			backgroundColor = '#6366f1';
			borderColor = '#4f46e5';
		} else {
			backgroundColor = '#10b981';
			borderColor = '#059669';
		}

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

	const scrollToTime = useMemo(() => {
		const now = new Date();
		if (now.getHours() >= AVAILABILITY_CONFIG.END_HOUR) {
			return new Date(0, 0, 0, AVAILABILITY_CONFIG.START_HOUR, 0, 0);
		}
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
			<div className="popschool-calendar rounded-lg border border-border bg-card overflow-hidden">
				<div className="h-[600px] min-h-0 overflow-y-auto overflow-x-hidden">
					<CalendarViewProvider value={currentView}>
						<DragAndDropCalendar
							localizer={calendarLocalizer}
							formats={dutchFormats}
							culture="nl-NL"
							events={events}
							showAllEvents
							startAccessor={(event) => (event as CalendarEvent).start}
							endAccessor={(event) => (event as CalendarEvent).end}
							view={currentView}
							onView={setCurrentView}
							date={currentDate}
							onNavigate={setCurrentDate}
							onSelectEvent={(event) => handleEventClick(event as CalendarEvent)}
							onEventDrop={canEdit ? onEventDropWithChoice : undefined}
							draggableAccessor={() => canEdit}
							resizableAccessor={() => false}
							eventPropGetter={eventStyleGetter}
							tooltipAccessor={(event) => buildTooltipText(event as CalendarEvent)}
							components={{
								// biome-ignore lint/suspicious/noExplicitAny: react-big-calendar event component typing is complex
								event: AgendaEvent as unknown as React.ComponentType<any>,
							}}
							min={new Date(0, 0, 0, AVAILABILITY_CONFIG.START_HOUR, 0, 0)}
							max={new Date(0, 0, 0, AVAILABILITY_CONFIG.END_HOUR, 0, 0)}
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
					</CalendarViewProvider>
				</div>
			</div>

			<Legend show={currentView !== 'agenda'} />

			<DetailModal
				open={isModalOpen}
				onOpenChange={setIsModalOpen}
				event={selectedEvent}
				canEdit={canEdit}
				isCancelling={isCancelling}
				isReverting={isReverting}
				onCancelLesson={handleCancelLesson}
				onRevertToOriginal={handleRevertToOriginal}
				onRevertRecurringAll={handleRevertRecurringAll}
				onOpenCancelConfirm={() => {
					if (selectedEvent && !needsRecurrenceChoice(selectedEvent)) {
						setPendingCancelScope('single');
						setCancelLessonConfirmOpen(true);
					} else {
						setRecurrenceChoiceAction('cancel');
						setRecurrenceChoiceOpen(true);
					}
				}}
				onOpenStudentInfo={(student) =>
					setStudentInfoModal({
						open: true,
						student,
					})
				}
			/>

			<RecurrenceChoiceDialog
				open={recurrenceChoiceOpen}
				onOpenChange={(open) => {
					setRecurrenceChoiceOpen(open);
					if (!open) setPendingDrop(null);
				}}
				action={recurrenceChoiceAction}
				onChoose={(scope) => {
					if (recurrenceChoiceAction === 'change' && pendingDrop) {
						handleEventDrop(pendingDrop, scope);
						setPendingDrop(null);
					} else if (recurrenceChoiceAction === 'cancel') {
						setPendingCancelScope(scope);
						setCancelLessonConfirmOpen(true);
					}
				}}
			/>

			<ConfirmCancelDialog
				open={cancelLessonConfirmOpen}
				onOpenChange={setCancelLessonConfirmOpen}
				onConfirm={() => handleCancelLesson(pendingCancelScope)}
				disabled={isCancelling}
			/>

			<StudentInfoModal
				open={studentInfoModal.open}
				onOpenChange={(open) => setStudentInfoModal({ ...studentInfoModal, open })}
				student={studentInfoModal.student}
			/>
		</div>
	);
}
