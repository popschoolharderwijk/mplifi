import { useCallback, useEffect, useMemo } from 'react';
import { Calendar } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { toast } from 'sonner';
import { AgendaEventFormDialog, type DeleteScope, type DeviationInfo } from '@/components/agenda/AgendaEventFormDialog';
import { StudentInfoModal } from '@/components/students/StudentInfoModal';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type LessonAgreementWithTeacher, useAgendaData } from '@/hooks/useAgendaData';
import { useAgendaUI } from '@/hooks/useAgendaUI';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDateToDb } from '@/lib/date/date-format';
import { formatTimeFromDate } from '@/lib/time/time-format';
import type { AgendaEventRow } from '@/types/agenda-events';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { CalendarViewProvider } from '@/components/agenda/CalendarViewContext';
import { ConfirmCancelDialog } from '@/components/agenda/ConfirmCancelDialog';
import { Legend } from '@/components/agenda/Legend';
import { RecurrenceChoiceDialog, type RecurrenceScope } from '@/components/agenda/RecurrenceChoiceDialog';
import type { CalendarEvent } from '@/components/agenda/types';
import { buildCalendarEvents } from '@/lib/agenda/buildCalendarEvents';
import { getCalendarProps } from '@/lib/agenda/calendarProps';
import { cancelLesson } from '@/lib/agenda/cancelLesson';
import { deleteAgendaEvent } from '@/lib/agenda/deleteAgendaEvent';
import { moveAgendaEvent } from '@/lib/agenda/moveAgendaEvent';
import { needsRecurrenceChoice } from '@/lib/agenda/needsRecurrenceChoice';
import { revertDeviation } from '@/lib/agenda/revertDeviation';
import { AVAILABILITY_CONFIG } from '@/lib/availability';

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

	const { agendaEvents, deviations, deviationsByEventId, agreementsMap, loading, loadData, getEnrichedEvents } =
		useAgendaData(effectiveUserId);

	const ui = useAgendaUI();
	const {
		currentView,
		setCurrentView,
		currentDate,
		setCurrentDate,
		selectedEvent,
		setSelectedEvent,
		formDialogOpen,
		setFormDialogOpen,
		editingEvent,
		setEditingEvent,
		newEventSlot,
		setNewEventSlot,
		openingForEditRef,
		isCancelling,
		setIsCancelling,
		cancelLessonConfirmOpen,
		setCancelLessonConfirmOpen,
		recurrenceChoiceOpen,
		setRecurrenceChoiceOpen,
		recurrenceChoiceAction,
		setRecurrenceChoiceAction,
		pendingDrop,
		setPendingDrop,
		pendingCancelScope,
		setPendingCancelScope,
		optimisticMove,
		setOptimisticMove,
		studentInfoModal,
		setStudentInfoModal,
	} = ui;

	useEffect(() => {
		if (!formDialogOpen) openingForEditRef.current = false;
	}, [formDialogOpen, openingForEditRef]);

	const events = useMemo(
		() => buildCalendarEvents(getEnrichedEvents(currentDate, effectiveUserId), optimisticMove),
		[getEnrichedEvents, currentDate, effectiveUserId, optimisticMove],
	);

	const occurrenceParticipantIds = useMemo(() => {
		if (!selectedEvent?.resource.eventId || !selectedEvent?.resource.originalDate || !editingEvent?.id) return null;
		const d = deviationsByEventId.get(selectedEvent.resource.eventId)?.get(selectedEvent.resource.originalDate);
		const ids = d?.participant_ids;
		return ids && ids.length > 0 ? ids : null;
	}, [selectedEvent?.resource.eventId, selectedEvent?.resource.originalDate, editingEvent?.id, deviationsByEventId]);

	const occurrenceOverrides = useMemo(() => {
		if (!selectedEvent?.resource.eventId || !selectedEvent?.resource.originalDate || !editingEvent?.id) return null;
		const d = deviationsByEventId.get(selectedEvent.resource.eventId)?.get(selectedEvent.resource.originalDate);
		return d ? { title: d.title ?? null, description: d.description ?? null, color: d.color ?? null } : null;
	}, [selectedEvent?.resource.eventId, selectedEvent?.resource.originalDate, editingEvent?.id, deviationsByEventId]);

	const occurrenceTimes = useMemo(() => {
		if (!selectedEvent?.resource.isDeviation) return { start: null, end: null };
		return {
			start: selectedEvent.start ? formatTimeFromDate(selectedEvent.start) : null,
			end: selectedEvent.end ? formatTimeFromDate(selectedEvent.end) : null,
		};
	}, [selectedEvent]);

	const readonlyParticipantIds = useMemo(() => {
		if (editingEvent?.source_type !== 'lesson_agreement' || !editingEvent.source_id) return [];
		const agreement = agreementsMap.get(editingEvent.source_id) as LessonAgreementWithTeacher | undefined;
		if (!agreement) return [];
		const ids: string[] = [agreement.student_user_id];
		if (agreement.teacherUserId) ids.push(agreement.teacherUserId);
		return ids;
	}, [editingEvent?.source_type, editingEvent?.source_id, agreementsMap]);

	const canAddParticipants = useMemo(() => {
		if (!isPrivileged) return false;
		if (editingEvent?.source_type !== 'lesson_agreement') return true;
		if (!editingEvent.source_id) return true;
		const agreement = agreementsMap.get(editingEvent.source_id) as LessonAgreementWithTeacher | undefined;
		if (!agreement) return true;
		return effectiveUserId === agreement.teacherUserId;
	}, [isPrivileged, editingEvent?.source_type, editingEvent?.source_id, agreementsMap, effectiveUserId]);

	const deviationInfo = useMemo((): DeviationInfo | null => {
		if (
			!(selectedEvent?.resource.isDeviation || selectedEvent?.resource.isCancelled) ||
			!selectedEvent.resource.deviationId ||
			!selectedEvent.resource.originalDate ||
			!selectedEvent.resource.originalStartTime
		)
			return null;
		return {
			deviationId: selectedEvent.resource.deviationId,
			originalDate: selectedEvent.resource.originalDate,
			originalStartTime: selectedEvent.resource.originalStartTime,
			isCancelled: selectedEvent.resource.isCancelled,
			hasTimeOrDateChange: selectedEvent.resource.hasTimeOrDateChange ?? false,
		};
	}, [
		selectedEvent?.resource.isDeviation,
		selectedEvent?.resource.isCancelled,
		selectedEvent?.resource.deviationId,
		selectedEvent?.resource.originalDate,
		selectedEvent?.resource.originalStartTime,
		selectedEvent?.resource.hasTimeOrDateChange,
	]);

	const lessonType = useMemo(
		() =>
			selectedEvent?.resource.lessonTypeName
				? {
						name: selectedEvent.resource.lessonTypeName,
						icon: selectedEvent.resource.lessonTypeIcon,
						color: selectedEvent.resource.lessonTypeColor,
					}
				: null,
		[
			selectedEvent?.resource.lessonTypeName,
			selectedEvent?.resource.lessonTypeIcon,
			selectedEvent?.resource.lessonTypeColor,
		],
	);

	const handleEventDrop = useCallback(
		async (args: { event: CalendarEvent; start: Date; end: Date }, scope: RecurrenceScope) => {
			if (!canEdit || !user) return;
			setOptimisticMove({ originalEvent: args.event, newStart: args.start, newEnd: args.end });
			const result = await moveAgendaEvent({
				event: args.event,
				start: args.start,
				end: args.end,
				scope,
				user,
				agendaEvents,
				deviations,
				agreementsMap,
			});
			if (!result.ok) {
				setOptimisticMove(null);
				toast.error(result.message);
				return;
			}
			if (result.message) {
				toast.success(result.message);
				await loadData(false);
			}
			setOptimisticMove(null);
		},
		[canEdit, user, agendaEvents, deviations, agreementsMap, loadData, setOptimisticMove],
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
		[handleEventDrop, setPendingDrop, setRecurrenceChoiceAction, setRecurrenceChoiceOpen],
	);

	const handleCancelLesson = useCallback(
		async (scope: RecurrenceScope = 'single') => {
			if (!selectedEvent || !user) return;
			setIsCancelling(true);
			const result = await cancelLesson({
				selectedEvent,
				user,
				agendaEvents,
				agreementsMap,
				scope,
			});
			if (!result.ok) {
				toast.error(result.message);
				setIsCancelling(false);
				return;
			}
			toast.success(result.message);
			setSelectedEvent(null);
			setCancelLessonConfirmOpen(false);
			setIsCancelling(false);
			loadData(false);
		},
		[
			selectedEvent,
			user,
			agendaEvents,
			agreementsMap,
			loadData,
			setSelectedEvent,
			setCancelLessonConfirmOpen,
			setIsCancelling,
		],
	);

	const handleSelectEvent = useCallback(
		async (event: CalendarEvent) => {
			const eventId = event.resource?.eventId;
			if (!eventId) return;
			setSelectedEvent(event);
			const { data } = await supabase.from('agenda_events').select('*').eq('id', eventId).single();
			if (data) {
				openingForEditRef.current = true;
				setEditingEvent(data as AgendaEventRow);
				setFormDialogOpen(true);
			}
		},
		[setSelectedEvent, setEditingEvent, setFormDialogOpen, openingForEditRef],
	);

	const handleSelectSlot = useCallback(
		(slotInfo: { start: Date; end: Date }) => {
			setNewEventSlot({ start: slotInfo.start, end: slotInfo.end });
			setEditingEvent(null);
			setFormDialogOpen(true);
		},
		[setNewEventSlot, setEditingEvent, setFormDialogOpen],
	);

	const scrollToTime = useMemo(() => {
		const nowDate = new Date();
		return nowDate.getHours() >= AVAILABILITY_CONFIG.END_HOUR
			? new Date(0, 0, 0, AVAILABILITY_CONFIG.START_HOUR, 0, 0)
			: nowDate;
	}, []);

	const calendarProps = getCalendarProps({
		events,
		currentView,
		currentDate,
		canEdit,
		isOwnAgenda,
		scrollToTime,
		onEventDrop: onEventDropWithChoice,
		onSelectEvent: handleSelectEvent,
		onSelectSlot: handleSelectSlot,
		setCurrentView,
		setCurrentDate,
	});

	if (loading) return <PageSkeleton variant="agenda" />;

	return (
		<div className="space-y-4">
			<div className="popschool-calendar rounded-lg border border-border bg-card overflow-hidden">
				<ScrollArea className="h-[600px]">
					<CalendarViewProvider value={currentView}>
						<DragAndDropCalendar {...calendarProps} />
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
					isOwnAgenda && user
						? async (eventId: string, scope: DeleteScope, occurrenceDate?: string) => {
								const result = await deleteAgendaEvent({
									eventId,
									scope,
									occurrenceDate,
									userId: user.id,
								});
								if (!result.ok) {
									toast.error(result.message);
									throw new Error(result.message);
								}
								toast.success(result.message);
								await loadData(false);
							}
						: undefined
				}
				occurrenceDate={selectedEvent ? formatDateToDb(selectedEvent.start) : null}
				occurrenceParticipantIds={occurrenceParticipantIds}
				occurrenceOverrides={occurrenceOverrides}
				occurrenceStartTime={occurrenceTimes.start}
				occurrenceEndTime={occurrenceTimes.end}
				deviationInfo={deviationInfo}
				onRevert={
					(selectedEvent?.resource.isDeviation || selectedEvent?.resource.isCancelled) &&
					selectedEvent.resource.deviationId &&
					selectedEvent.resource.eventId &&
					selectedEvent.resource.originalDate &&
					isOwnAgenda &&
					user
						? async () => {
								const result = await revertDeviation({
									eventId: selectedEvent.resource.eventId,
									originalDate: selectedEvent.resource.originalDate,
									userId: user.id,
								});
								if (!result.ok) {
									toast.error(result.message);
									throw new Error(result.message);
								}
								toast.success(result.message);
								await loadData(false);
							}
						: undefined
				}
				readonlyParticipantIds={readonlyParticipantIds}
				canAddParticipants={canAddParticipants}
				lessonType={lessonType}
			/>
		</div>
	);
}
