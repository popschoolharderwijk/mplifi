import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { RecurrenceScope } from '@/components/agenda/RecurrenceChoiceDialog';
import { supabase } from '@/integrations/supabase/client';
import { addDaysToDateStr, formatDateToDb, now } from '@/lib/date/date-format';
import { formatTimeFromDate } from '@/lib/time/time-format';
import type { AgendaEventInsert, AgendaEventRow } from '@/types/agenda-events';
import type { LessonFrequency } from '@/types/lesson-agreements';

export interface UseAgendaEventFormOptions {
	open: boolean;
	event: AgendaEventRow | null | undefined;
	initialSlot: { start: Date; end: Date } | null | undefined;
	userId: string | undefined;
	occurrenceDate?: string | null;
	occurrenceStartTime?: string | null;
	occurrenceEndTime?: string | null;
	readonlyParticipantIds?: string[];
	onSuccess?: () => void;
	onOpenChange: (open: boolean) => void;
}

export interface ParticipantProfile {
	first_name: string | null;
	last_name: string | null;
	email: string | null;
}

export function useAgendaEventForm({
	open,
	event,
	initialSlot,
	userId,
	occurrenceDate,
	occurrenceStartTime,
	occurrenceEndTime,
	readonlyParticipantIds = [],
	onSuccess,
	onOpenChange,
}: UseAgendaEventFormOptions) {
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [startDate, setStartDate] = useState<string | null>(null);
	const [startTime, setStartTime] = useState('09:00');
	const [endDate, setEndDate] = useState<string | null>(null);
	const [endTime, setEndTime] = useState('10:00');
	const [isAllDay, setIsAllDay] = useState(false);
	const [recurring, setRecurring] = useState(false);
	const [recurringFrequency, setRecurringFrequency] = useState<LessonFrequency>('weekly');
	const [recurringEndDate, setRecurringEndDate] = useState<string | null>(null);
	const [color, setColor] = useState<string | null>(null);
	const [participantIds, setParticipantIds] = useState<string[]>([]);
	const [participantAddId, setParticipantAddId] = useState<string | null>(null);
	const [participantProfiles, setParticipantProfiles] = useState<Record<string, ParticipantProfile>>({});
	const [showDescription, setShowDescription] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		if (event) {
			setTitle(event.title);
			setDescription(event.description ?? '');
			setShowDescription(!!event.description);
			setStartDate(occurrenceDate ?? event.start_date);
			setStartTime((occurrenceStartTime ?? event.start_time).substring(0, 5));
			setEndDate(occurrenceDate ?? event.end_date ?? event.start_date);
			setEndTime((occurrenceEndTime ?? event.end_time)?.substring(0, 5) ?? '10:00');
			setIsAllDay(event.is_all_day);
			setRecurring(event.recurring);
			setRecurringFrequency((event.recurring_frequency as LessonFrequency) ?? 'weekly');
			setRecurringEndDate(event.recurring_end_date);
			setColor(event.color);
		} else {
			const today = formatDateToDb(now());
			if (initialSlot) {
				setStartDate(formatDateToDb(initialSlot.start));
				setStartTime(formatTimeFromDate(initialSlot.start));
				setEndDate(formatDateToDb(initialSlot.end));
				setEndTime(formatTimeFromDate(initialSlot.end));
			} else {
				setStartDate(today);
				setStartTime('09:00');
				setEndDate(today);
				setEndTime('10:00');
			}
			setTitle('');
			setDescription('');
			setShowDescription(false);
			setIsAllDay(false);
			setRecurring(false);
			setRecurringFrequency('weekly');
			setRecurringEndDate(null);
			setColor(null);
			setParticipantIds(userId ? [userId] : []);
		}
	}, [open, event, userId, initialSlot, occurrenceDate, occurrenceStartTime, occurrenceEndTime]);

	useEffect(() => {
		const eventId = event?.id;
		if (!open || !eventId) return;
		async function loadParticipants() {
			const { data } = await supabase.from('agenda_participants').select('user_id').eq('event_id', eventId);
			if (data) setParticipantIds(data.map((p) => p.user_id));
		}
		loadParticipants();
	}, [open, event?.id]);

	useEffect(() => {
		if (!open || participantIds.length === 0) {
			setParticipantProfiles({});
			return;
		}
		async function loadProfiles() {
			const { data } = await supabase
				.from('profiles')
				.select('user_id, first_name, last_name, email')
				.in('user_id', participantIds);
			const map: Record<string, ParticipantProfile> = {};
			for (const row of data ?? []) {
				map[row.user_id] = {
					first_name: row.first_name ?? null,
					last_name: row.last_name ?? null,
					email: row.email ?? null,
				};
			}
			setParticipantProfiles(map);
		}
		loadProfiles();
	}, [open, participantIds]);

	const handleAddParticipant = useCallback(
		(newUserId: string | null) => {
			if (!newUserId || participantIds.includes(newUserId)) return;
			setParticipantIds((prev) => [...prev, newUserId]);
			setParticipantAddId(null);
		},
		[participantIds],
	);

	const handleRemoveParticipant = useCallback(
		(removeUserId: string) => {
			if (readonlyParticipantIds.includes(removeUserId)) return;
			setParticipantIds((prev) => prev.filter((id) => id !== removeUserId));
		},
		[readonlyParticipantIds],
	);

	const performSave = useCallback(
		async (scope: RecurrenceScope = 'all') => {
			if (!userId || !startDate || !startTime) return;

			const payload: AgendaEventInsert = {
				source_type: 'manual',
				source_id: null,
				owner_user_id: userId,
				title: title.trim(),
				description: description.trim() || null,
				start_date: startDate,
				start_time: startTime + (startTime.length === 5 ? '' : ':00'),
				end_date: endDate ?? startDate,
				end_time: isAllDay ? null : endTime + (endTime.length === 5 ? '' : ':00'),
				is_all_day: isAllDay,
				recurring,
				recurring_frequency: recurring ? recurringFrequency : null,
				recurring_end_date: recurring ? recurringEndDate : null,
				color: color || null,
				created_by: userId,
				updated_by: userId,
			};
			setSaving(true);
			try {
				if (event?.id) {
					if (scope === 'thisAndFuture' && occurrenceDate) {
						const newEndDate = addDaysToDateStr(occurrenceDate, -1);
						const { error: endErr } = await supabase
							.from('agenda_events')
							.update({ recurring_end_date: newEndDate, updated_by: userId })
							.eq('id', event.id);
						if (endErr) throw endErr;
						const { data: inserted, error: insertError } = await supabase
							.from('agenda_events')
							.insert({ ...payload, start_date: occurrenceDate, end_date: occurrenceDate })
							.select('id')
							.single();
						if (insertError) throw insertError;
						const newEventId = inserted?.id;
						if (newEventId) {
							for (const pId of participantIds) {
								const { error: pErr } = await supabase
									.from('agenda_participants')
									.insert({ event_id: newEventId, user_id: pId });
								if (pErr) throw pErr;
							}
						}
					} else {
						const { error: updateError } = await supabase
							.from('agenda_events')
							.update({
								title: payload.title,
								description: payload.description,
								start_date: payload.start_date,
								start_time: payload.start_time,
								end_date: payload.end_date,
								end_time: payload.end_time,
								is_all_day: payload.is_all_day,
								recurring: payload.recurring,
								recurring_frequency: payload.recurring_frequency,
								recurring_end_date: payload.recurring_end_date,
								color: payload.color,
								updated_by: userId,
							})
							.eq('id', event.id);
						if (updateError) throw updateError;
						const { data: existing } = await supabase
							.from('agenda_participants')
							.select('user_id')
							.eq('event_id', event.id);
						const existingIds = new Set((existing ?? []).map((p) => p.user_id));
						const toAdd = participantIds.filter((id) => !existingIds.has(id));
						const toRemove = [...existingIds].filter((id) => !participantIds.includes(id));
						for (const id of toAdd) {
							const { error: addErr } = await supabase
								.from('agenda_participants')
								.insert({ event_id: event.id, user_id: id });
							if (addErr) throw addErr;
						}
						for (const id of toRemove) {
							await supabase
								.from('agenda_participants')
								.delete()
								.eq('event_id', event.id)
								.eq('user_id', id);
						}
					}
				} else {
					const { data: inserted, error: insertError } = await supabase
						.from('agenda_events')
						.insert(payload)
						.select('id')
						.single();
					if (insertError) throw insertError;
					const eventId = inserted?.id;
					if (eventId) {
						for (const pId of participantIds) {
							const { error: pErr } = await supabase
								.from('agenda_participants')
								.insert({ event_id: eventId, user_id: pId });
							if (pErr) throw pErr;
						}
					}
				}
				onSuccess?.();
				onOpenChange(false);
			} catch (err: unknown) {
				let message = 'Opslaan mislukt';
				if (err instanceof Error) {
					if (err.message.includes('row-level security')) {
						message = 'Je hebt geen toestemming om deze deelnemer toe te voegen';
					} else {
						message = err.message;
					}
				}
				toast.error(message);
			} finally {
				setSaving(false);
			}
		},
		[
			userId,
			startDate,
			startTime,
			endDate,
			endTime,
			isAllDay,
			recurring,
			recurringFrequency,
			recurringEndDate,
			color,
			title,
			description,
			participantIds,
			event,
			occurrenceDate,
			onSuccess,
			onOpenChange,
		],
	);

	return {
		formState: {
			title,
			setTitle,
			description,
			setDescription,
			startDate,
			setStartDate,
			startTime,
			setStartTime,
			endDate,
			setEndDate,
			endTime,
			setEndTime,
			isAllDay,
			setIsAllDay,
			recurring,
			setRecurring,
			recurringFrequency,
			setRecurringFrequency,
			recurringEndDate,
			setRecurringEndDate,
			color,
			setColor,
			showDescription,
			setShowDescription,
			participantIds,
			participantAddId,
			setParticipantAddId,
			participantProfiles,
		},
		handlers: {
			handleAddParticipant,
			handleRemoveParticipant,
			performSave,
		},
		saving,
	};
}
