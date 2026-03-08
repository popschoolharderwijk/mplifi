import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, type View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { toast } from 'sonner';
import { AgendaEventFormDialog, type DeleteScope, type DeviationInfo } from '@/components/agenda/AgendaEventFormDialog';
import { StudentInfoModal, type StudentInfoModalData } from '@/components/students/StudentInfoModal';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type LessonAgreementWithTeacher, useAgendaData } from '@/hooks/useAgendaData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PostgresErrorCodes } from '@/integrations/supabase/errorcodes';
import { AVAILABILITY_CONFIG } from '@/lib/availability';
import { calendarLocalizer } from '@/lib/calendar';
import { addDaysToDateStr, formatDateToDb, now } from '@/lib/date/date-format';
import { formatTimeFromDate, normalizeTime, normalizeTimeFromDate } from '@/lib/time/time-format';
import type { AgendaEventRow } from '@/types/agenda-events';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { AgendaEvent } from '@/components/agenda/AgendaEvent';
import { agendaMessages, getEventStyle } from '@/components/agenda/agenda-calendar-config';
import { CalendarToolbar } from '@/components/agenda/CalendarToolbar';
import { CalendarViewProvider } from '@/components/agenda/CalendarViewContext';
import { ConfirmCancelDialog } from '@/components/agenda/ConfirmCancelDialog';
import { Legend } from '@/components/agenda/Legend';
import { RecurrenceChoiceDialog, type RecurrenceScope } from '@/components/agenda/RecurrenceChoiceDialog';
import type { CalendarEvent } from '@/components/agenda/types';
import { buildTooltipText, dutchFormats } from '@/components/agenda/utils';

const DragAndDropCalendar = withDragAndDrop(Calendar);

export interface AgendaViewProps {
	userId?: string;
	canEdit?: boolean;
}

export function AgendaView({ userId: viewUserId, canEdit: canEditProp }: AgendaViewProps = {}) {
	const { user, isPrivileged } = useAuth();
	const effectiveUserId = viewUserId ?? user?.id;
	const canEdit = canEditProp ?? !!user;
	const isOwnAgenda = !viewUserId;

	const { agendaEvents, deviations, agreementsMap, loading, loadData, getEnrichedEvents } =
		useAgendaData(effectiveUserId);

	const [currentView, setCurrentView] = useState<View>('week');
	const [currentDate, setCurrentDate] = useState(new Date());
	const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
	const [formDialogOpen, setFormDialogOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<AgendaEventRow | null>(null);
	const [newEventSlot, setNewEventSlot] = useState<{ start: Date; end: Date } | null>(null);
	const openingForEditRef = useRef(false);
	const [isCancelling, setIsCancelling] = useState(false);
	const [cancelLessonConfirmOpen, setCancelLessonConfirmOpen] = useState(false);
	const [recurrenceChoiceOpen, setRecurrenceChoiceOpen] = useState(false);
	const [recurrenceChoiceAction, setRecurrenceChoiceAction] = useState<'change' | 'cancel'>('change');
	const [pendingDrop, setPendingDrop] = useState<{ event: CalendarEvent; start: Date; end: Date } | null>(null);
	const [pendingCancelScope, setPendingCancelScope] = useState<RecurrenceScope>('single');
	const [optimisticMove, setOptimisticMove] = useState<{
		originalEvent: CalendarEvent;
		newStart: Date;
		newEnd: Date;
	} | null>(null);
	const [studentInfoModal, setStudentInfoModal] = useState<{
		open: boolean;
		student: StudentInfoModalData | null;
	}>({ open: false, student: null });

	useEffect(() => {
		if (!formDialogOpen) openingForEditRef.current = false;
	}, [formDialogOpen]);

	const events = useMemo(() => {
		let result = getEnrichedEvents(currentDate, effectiveUserId);

		if (optimisticMove) {
			const { originalEvent, newStart, newEnd } = optimisticMove;
			const originalStartTime = originalEvent.start?.getTime();
			const newStartTime = newStart.getTime();

			result = result.map((ev) => {
				if (ev.resource.eventId !== originalEvent.resource.eventId) return ev;
				const evStartTime = ev.start?.getTime();
				if (evStartTime === originalStartTime) {
					return { ...ev, start: newStart, end: newEnd, resource: { ...ev.resource, isPending: true } };
				}
				if (evStartTime === newStartTime) {
					return { ...ev, resource: { ...ev.resource, isPending: true } };
				}
				return ev;
			});
		}

		return result;
	}, [getEnrichedEvents, currentDate, effectiveUserId, optimisticMove]);

	const needsRecurrenceChoice = useCallback((event: CalendarEvent) => {
		if (event.resource.isDeviation && event.resource.deviationId && event.resource.isRecurring === false)
			return false;
		if (event.resource.sourceType === 'manual' && !event.resource.isRecurring) return false;
		return true;
	}, []);

	const handleEventDrop = useCallback(
		async ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }, scope: RecurrenceScope) => {
			if (!canEdit || !user) return;
			const eventId = event.resource.eventId;
			if (!eventId) return;

			const agendaEvent = agendaEvents.find((e) => e.id === eventId);
			if (!agendaEvent) return;

			const isRecurring = agendaEvent.recurring;
			const actualDateStr = formatDateToDb(start);
			const actualStartTime = normalizeTimeFromDate(start);
			const actualEndDate = formatDateToDb(end);
			const actualEndTime = normalizeTimeFromDate(end);

			setOptimisticMove({ originalEvent: event, newStart: start, newEnd: end });

			if (!isRecurring) {
				const { error } = await supabase
					.from('agenda_events')
					.update({
						start_date: actualDateStr,
						start_time: actualStartTime,
						end_date: actualEndDate,
						end_time: actualEndTime,
						updated_by: user.id,
					})
					.eq('id', eventId);

				if (error) {
					setOptimisticMove(null);
					toast.error('Afspraak verplaatsen mislukt');
					return;
				}
				toast.success('Afspraak verplaatst');
				await loadData(false);
				setOptimisticMove(null);
				return;
			}

			const recurring = scope === 'thisAndFuture';
			const isLessonEvent = agendaEvent.source_type === 'lesson_agreement' && agendaEvent.source_id;
			const agreement = isLessonEvent ? agreementsMap.get(agendaEvent.source_id as string) : null;
			const baseStartTime = agreement ? agreement.start_time : agendaEvent.start_time;

			let originalDateStr: string;
			let originalStartTime: string;
			if (event.resource.isDeviation && event.resource.originalDate && event.resource.originalStartTime) {
				originalDateStr = event.resource.originalDate;
				originalStartTime = event.resource.originalStartTime;
			} else {
				originalDateStr = event.start ? formatDateToDb(event.start) : actualDateStr;
				originalStartTime = normalizeTime(baseStartTime);
			}

			const deviationById = event.resource.deviationId
				? deviations.find((d) => d.id === event.resource.deviationId)
				: null;
			const existingDeviation =
				deviationById?.original_date === originalDateStr
					? deviationById
					: deviations.find((d) => d.event_id === eventId && d.original_date === originalDateStr);

			const droppedOnSameSlot = existingDeviation
				? actualDateStr === existingDeviation.actual_date &&
					normalizeTime(actualStartTime) === normalizeTime(existingDeviation.actual_start_time)
				: event.start &&
					actualDateStr === formatDateToDb(event.start) &&
					normalizeTime(actualStartTime) === normalizeTimeFromDate(event.start);

			if (droppedOnSameSlot) return;

			const isRestoringToOriginal =
				originalDateStr === actualDateStr &&
				normalizeTime(originalStartTime) === normalizeTime(actualStartTime);

			if (isRestoringToOriginal) {
				if (existingDeviation) {
					const scopeParam = recurring ? 'this_and_future' : 'only_this';
					const { data: result, error } = await supabase.rpc('ensure_week_shows_original_slot', {
						p_event_id: eventId,
						p_week_date: originalDateStr,
						p_user_id: user.id,
						p_scope: scopeParam,
					});
					if (error) {
						setOptimisticMove(null);
						toast.error('Fout bij terugzetten');
						return;
					}
					toast.success(
						result === 'recurring_deleted'
							? 'Terugkerende wijziging verwijderd'
							: result === 'recurring_ended'
								? 'Terugkerende wijziging beëindigd vanaf deze week'
								: 'Afspraak teruggezet naar originele planning',
					);
					await loadData(false);
				}
				setOptimisticMove(null);
				return;
			}

			if (
				!existingDeviation &&
				originalDateStr === actualDateStr &&
				normalizeTime(originalStartTime) === normalizeTime(actualStartTime)
			) {
				setOptimisticMove(null);
				return;
			}

			if (existingDeviation) {
				const { error } = await supabase
					.from('agenda_event_deviations')
					.update({
						actual_date: actualDateStr,
						actual_start_time: actualStartTime,
						recurring,
						updated_by: user.id,
					})
					.eq('id', existingDeviation.id);
				if (error) {
					setOptimisticMove(null);
					const isDateCheck =
						error.code === PostgresErrorCodes.CHECK_VIOLATION ||
						(error.message ?? '').toLowerCase().includes('deviation_date_check');
					toast.error(
						isDateCheck
							? 'Afspraak kan niet in het verleden worden geplaatst.'
							: 'Fout bij bijwerken afwijking',
					);
					return;
				}
				toast.success('Afspraak bijgewerkt');
			} else {
				if (recurring && deviationById && deviationById.original_date !== originalDateStr) {
					const endDate = addDaysToDateStr(originalDateStr, -1);
					const { error: updateErr } = await supabase
						.from('agenda_event_deviations')
						.update({ recurring_end_date: endDate, updated_by: user.id })
						.eq('id', deviationById.id);
					if (updateErr) {
						setOptimisticMove(null);
						toast.error(`Fout bij bijwerken afwijking: ${updateErr.message}`);
						return;
					}
				}

				const payload = {
					event_id: eventId,
					original_date: originalDateStr,
					original_start_time: normalizeTime(originalStartTime || agendaEvent.start_time),
					actual_date: actualDateStr,
					actual_start_time: actualStartTime,
					recurring,
					created_by: user.id,
					updated_by: user.id,
				};
				const { error } = await supabase
					.from('agenda_event_deviations')
					.upsert(payload, { onConflict: 'event_id,original_date' });
				if (error) {
					setOptimisticMove(null);
					const isDateCheck =
						error.code === PostgresErrorCodes.CHECK_VIOLATION ||
						(error.message ?? '').toLowerCase().includes('deviation_date_check');
					const isUnique =
						error.code === PostgresErrorCodes.UNIQUE_VIOLATION ||
						(error.message ?? '').toLowerCase().includes('unique');
					toast.error(
						isDateCheck
							? 'Afspraak kan niet in het verleden worden geplaatst.'
							: isUnique
								? 'Deze afwijking bestaat al.'
								: `Fout bij aanmaken afwijking: ${error.message}`,
					);
					return;
				}
				toast.success('Afspraak verplaatst');
			}
			await loadData(false);
			setOptimisticMove(null);
		},
		[canEdit, user, agendaEvents, deviations, loadData, agreementsMap],
	);

	const onEventDropWithChoice = useCallback(
		(args: { event: CalendarEvent; start: Date; end: Date }) => {
			const originalStart = args.event.start;
			const originalEnd = args.event.end;
			if (
				originalStart &&
				originalEnd &&
				originalStart.getTime() === args.start.getTime() &&
				originalEnd.getTime() === args.end.getTime()
			)
				return;

			if (!needsRecurrenceChoice(args.event)) {
				handleEventDrop(args, 'single');
				return;
			}
			setPendingDrop(args);
			setRecurrenceChoiceAction('change');
			setRecurrenceChoiceOpen(true);
		},
		[needsRecurrenceChoice, handleEventDrop],
	);

	const handleCancelLesson = useCallback(
		async (scope: RecurrenceScope = 'single') => {
			if (!selectedEvent || !user) return;
			setIsCancelling(true);
			const recurring = scope === 'thisAndFuture';
			const eventId = selectedEvent.resource.eventId;
			const agendaEvent = eventId ? agendaEvents.find((e) => e.id === eventId) : null;
			if (!agendaEvent) {
				setIsCancelling(false);
				return;
			}

			const isLessonEvent = agendaEvent.source_type === 'lesson_agreement' && agendaEvent.source_id;
			const agreement = isLessonEvent ? agreementsMap.get(agendaEvent.source_id as string) : null;
			const baseStartTime = agreement ? agreement.start_time : agendaEvent.start_time;

			const isExistingDeviation = selectedEvent.resource.deviationId;
			let originalDateStr: string;
			let originalStartTime: string;
			if (selectedEvent.resource.originalDate && selectedEvent.resource.originalStartTime) {
				originalDateStr = selectedEvent.resource.originalDate;
				originalStartTime = selectedEvent.resource.originalStartTime;
			} else {
				originalDateStr = selectedEvent.start ? formatDateToDb(selectedEvent.start) : formatDateToDb(now());
				originalStartTime = normalizeTime(baseStartTime);
			}

			if (selectedEvent.resource.isCancelled && isExistingDeviation) {
				const { error } = await supabase
					.from('agenda_event_deviations')
					.delete()
					.eq('id', selectedEvent.resource.deviationId);
				if (error) {
					toast.error('Fout bij herstellen les');
					setIsCancelling(false);
					return;
				}
				toast.success('Les hersteld');
			} else if (isExistingDeviation) {
				const { error } = await supabase
					.from('agenda_event_deviations')
					.update({
						is_cancelled: true,
						actual_date: originalDateStr,
						actual_start_time: originalStartTime,
						recurring,
						updated_by: user.id,
					})
					.eq('id', selectedEvent.resource.deviationId);
				if (error) {
					toast.error('Fout bij annuleren les');
					setIsCancelling(false);
					return;
				}
				toast.success('Les geannuleerd');
			} else {
				if (!eventId) {
					setIsCancelling(false);
					return;
				}
				const { error } = await supabase.from('agenda_event_deviations').insert({
					event_id: eventId,
					original_date: originalDateStr,
					original_start_time: originalStartTime,
					actual_date: originalDateStr,
					actual_start_time: originalStartTime,
					is_cancelled: true,
					recurring,
					created_by: user.id,
					updated_by: user.id,
				});
				if (error) {
					toast.error('Fout bij annuleren les');
					setIsCancelling(false);
					return;
				}
				toast.success('Les geannuleerd');
			}
			setIsCancelling(false);
			setSelectedEvent(null);
			setCancelLessonConfirmOpen(false);
			loadData(false);
		},
		[selectedEvent, user, agendaEvents, loadData, agreementsMap],
	);

	const scrollToTime = useMemo(() => {
		const nowDate = new Date();
		return nowDate.getHours() >= AVAILABILITY_CONFIG.END_HOUR
			? new Date(0, 0, 0, AVAILABILITY_CONFIG.START_HOUR, 0, 0)
			: nowDate;
	}, []);

	if (loading) return <PageSkeleton variant="agenda" />;

	return (
		<div className="space-y-4">
			<div className="popschool-calendar rounded-lg border border-border bg-card overflow-hidden">
				<ScrollArea className="h-[600px]">
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
							onSelectEvent={
								canEdit && isOwnAgenda
									? async (event) => {
											const calEvent = event as CalendarEvent;
											const eventId = calEvent.resource?.eventId;
											if (!eventId) return;
											setSelectedEvent(calEvent);
											const { data } = await supabase
												.from('agenda_events')
												.select('*')
												.eq('id', eventId)
												.single();
											if (data) {
												openingForEditRef.current = true;
												setEditingEvent(data as AgendaEventRow);
												setFormDialogOpen(true);
											}
										}
									: undefined
							}
							onSelectSlot={
								canEdit && isOwnAgenda
									? (slotInfo) => {
											setNewEventSlot({ start: slotInfo.start, end: slotInfo.end });
											setEditingEvent(null);
											setFormDialogOpen(true);
										}
									: undefined
							}
							selectable={canEdit && isOwnAgenda}
							onEventDrop={canEdit ? onEventDropWithChoice : undefined}
							draggableAccessor={() => canEdit}
							resizableAccessor={() => false}
							eventPropGetter={(event) => getEventStyle(event as CalendarEvent, currentView)}
							tooltipAccessor={(event) => buildTooltipText(event as CalendarEvent)}
							components={{
								toolbar: CalendarToolbar,
								// biome-ignore lint/suspicious/noExplicitAny: react-big-calendar event component typing
								event: AgendaEvent as unknown as React.ComponentType<any>,
							}}
							min={new Date(0, 0, 0, AVAILABILITY_CONFIG.START_HOUR, 0, 0)}
							max={new Date(0, 0, 0, AVAILABILITY_CONFIG.END_HOUR, 0, 0)}
							scrollToTime={scrollToTime}
							step={30}
							timeslots={1}
							messages={agendaMessages}
						/>
					</CalendarViewProvider>
				</ScrollArea>
			</div>
			<Legend show={currentView !== 'agenda'} />

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
				hideFutureOption={
					recurrenceChoiceAction === 'cancel' &&
					(selectedEvent?.resource.isLesson || selectedEvent?.resource.sourceType === 'lesson_agreement')
				}
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

			<AgendaEventFormDialog
				open={formDialogOpen}
				onOpenChange={(open) => {
					setFormDialogOpen(open);
					if (!open) {
						setEditingEvent(null);
						setNewEventSlot(null);
						setSelectedEvent(null);
					}
				}}
				event={editingEvent}
				initialSlot={newEventSlot}
				onSuccess={() => loadData(false)}
				onDelete={
					isOwnAgenda
						? async (eventId: string, scope: DeleteScope, occurrenceDate?: string) => {
								if (scope === 'all') {
									const { error: err } = await supabase
										.from('agenda_events')
										.delete()
										.eq('id', eventId);
									if (err) {
										toast.error('Afspraak verwijderen mislukt');
										throw err;
									}
									toast.success('Alle afspraken verwijderd');
								} else if (scope === 'single' && occurrenceDate) {
									const { data: eventData, error: fetchErr } = await supabase
										.from('agenda_events')
										.select('start_time')
										.eq('id', eventId)
										.single();
									if (fetchErr || !eventData) {
										toast.error('Afspraak niet gevonden');
										throw fetchErr;
									}
									const { error: err } = await supabase.from('agenda_event_deviations').upsert(
										{
											event_id: eventId,
											original_date: occurrenceDate,
											original_start_time: eventData.start_time,
											actual_date: occurrenceDate,
											actual_start_time: eventData.start_time,
											is_cancelled: true,
											created_by: user?.id,
											updated_by: user?.id,
										},
										{ onConflict: 'event_id,original_date' },
									);
									if (err) {
										toast.error('Afspraak annuleren mislukt');
										throw err;
									}
									toast.success('Afspraak geannuleerd');
								} else if (scope === 'thisAndFuture' && occurrenceDate) {
									const newEndDate = addDaysToDateStr(occurrenceDate, -1);
									const { error: err } = await supabase
										.from('agenda_events')
										.update({ recurring_end_date: newEndDate, updated_by: user?.id })
										.eq('id', eventId);
									if (err) {
										toast.error('Afspraken verwijderen mislukt');
										throw err;
									}
									toast.success('Deze en toekomstige afspraken verwijderd');
								}
								loadData(false);
							}
						: undefined
				}
				occurrenceDate={selectedEvent ? formatDateToDb(selectedEvent.start) : null}
				occurrenceStartTime={
					selectedEvent?.resource.isDeviation && selectedEvent.start
						? formatTimeFromDate(selectedEvent.start)
						: null
				}
				occurrenceEndTime={
					selectedEvent?.resource.isDeviation && selectedEvent.end
						? formatTimeFromDate(selectedEvent.end)
						: null
				}
				deviationInfo={
					(selectedEvent?.resource.isDeviation || selectedEvent?.resource.isCancelled) &&
					selectedEvent.resource.deviationId &&
					selectedEvent.resource.originalDate &&
					selectedEvent.resource.originalStartTime
						? ({
								deviationId: selectedEvent.resource.deviationId,
								originalDate: selectedEvent.resource.originalDate,
								originalStartTime: selectedEvent.resource.originalStartTime,
								isCancelled: selectedEvent.resource.isCancelled,
							} satisfies DeviationInfo)
						: null
				}
				onRevert={
					(selectedEvent?.resource.isDeviation || selectedEvent?.resource.isCancelled) &&
					selectedEvent.resource.deviationId &&
					selectedEvent.resource.eventId &&
					isOwnAgenda
						? async () => {
								const eventId = selectedEvent.resource.eventId;
								const originalDate = selectedEvent.resource.originalDate;
								if (!eventId || !originalDate || !user) {
									toast.error('Kan afspraak niet terugzetten');
									return;
								}
								const { data: result, error } = await supabase.rpc('ensure_week_shows_original_slot', {
									p_event_id: eventId,
									p_week_date: originalDate,
									p_user_id: user.id,
									p_scope: 'only_this',
								});
								if (error) {
									toast.error('Fout bij terugzetten');
									throw error;
								}
								toast.success(
									result === 'recurring_deleted'
										? 'Terugkerende wijziging verwijderd'
										: result === 'recurring_ended'
											? 'Terugkerende wijziging beëindigd'
											: 'Afspraak teruggezet naar origineel',
								);
								await loadData(false);
							}
						: undefined
				}
				readonlyParticipantIds={(() => {
					if (editingEvent?.source_type !== 'lesson_agreement' || !editingEvent.source_id) return [];
					const agreement = agreementsMap.get(editingEvent.source_id) as
						| LessonAgreementWithTeacher
						| undefined;
					if (!agreement) return [];
					const ids: string[] = [agreement.student_user_id];
					if (agreement.teacherUserId) ids.push(agreement.teacherUserId);
					return ids;
				})()}
				canAddParticipants={(() => {
					// Only privileged users can add participants
					if (!isPrivileged) return false;
					if (editingEvent?.source_type !== 'lesson_agreement') return true;
					if (!editingEvent.source_id) return true;
					const agreement = agreementsMap.get(editingEvent.source_id) as
						| LessonAgreementWithTeacher
						| undefined;
					if (!agreement) return true;
					return effectiveUserId === agreement.teacherUserId;
				})()}
				lessonType={
					selectedEvent?.resource.lessonTypeName
						? {
								name: selectedEvent.resource.lessonTypeName,
								icon: selectedEvent.resource.lessonTypeIcon,
								color: selectedEvent.resource.lessonTypeColor,
							}
						: null
				}
			/>
		</div>
	);
}
