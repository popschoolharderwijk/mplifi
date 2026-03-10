import { useRef, useState } from 'react';
import type { View } from 'react-big-calendar';
import type { RecurrenceScope } from '@/components/agenda/RecurrenceChoiceDialog';
import type { CalendarEvent } from '@/components/agenda/types';
import type { OptimisticMove } from '@/lib/agenda/buildCalendarEvents';
import type { AgendaEventRow } from '@/types/agenda-events';
import type { User } from '@/types/users';

export function useAgendaUI() {
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
	const [optimisticMove, setOptimisticMove] = useState<OptimisticMove | null>(null);
	const [studentInfoModal, setStudentInfoModal] = useState<{
		open: boolean;
		student: User | null;
	}>({ open: false, student: null });

	return {
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
	};
}
