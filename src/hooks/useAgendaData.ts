import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { CalendarEvent } from '@/components/agenda/types';
import { buildStudentInfo, formatStudentName, generateAgendaEvents } from '@/components/agenda/utils';
import { supabase } from '@/integrations/supabase/client';
import type { AgendaEventDeviationRow, AgendaEventRow } from '@/types/agenda-events';
import type { LessonAgreementWithStudent } from '@/types/lesson-agreements';

export interface LessonAgreementWithTeacher extends LessonAgreementWithStudent {
	teacherUserId?: string;
	teacherProfile?: {
		first_name: string | null;
		last_name: string | null;
		email: string | null;
	} | null;
}

export interface UseAgendaDataResult {
	agendaEvents: AgendaEventRow[];
	deviations: AgendaEventDeviationRow[];
	deviationsByEventId: Map<string, Map<string, AgendaEventDeviationRow>>;
	recurringByEventId: Map<string, AgendaEventDeviationRow[]>;
	agreementsMap: Map<string, LessonAgreementWithTeacher>;
	participantCountByEventId: Map<string, number>;
	participantNamesByEventId: Map<string, string[]>;
	loading: boolean;
	loadData: (showLoading?: boolean) => Promise<void>;
	getEnrichedEvents: (currentDate: Date, effectiveUserId: string | undefined) => CalendarEvent[];
}

export function useAgendaData(effectiveUserId: string | undefined): UseAgendaDataResult {
	const [agendaEvents, setAgendaEvents] = useState<AgendaEventRow[]>([]);
	const [deviations, setDeviations] = useState<AgendaEventDeviationRow[]>([]);
	const [participantCountByEventId, setParticipantCountByEventId] = useState<Map<string, number>>(new Map());
	const [participantNamesByEventId, setParticipantNamesByEventId] = useState<Map<string, string[]>>(new Map());
	const [agreements, setAgreements] = useState<LessonAgreementWithTeacher[]>([]);
	const [loading, setLoading] = useState(true);

	const loadData = useCallback(
		async (showLoading = true) => {
			if (!effectiveUserId) return;
			if (showLoading) setLoading(true);

			const { data: participantRows, error: partError } = await supabase
				.from('agenda_participants')
				.select('event_id')
				.eq('user_id', effectiveUserId);

			if (partError || !participantRows?.length) {
				setAgendaEvents([]);
				setDeviations([]);
				setParticipantCountByEventId(new Map());
				setParticipantNamesByEventId(new Map());
				setAgreements([]);
				setLoading(false);
				return;
			}

			const eventIds = [...new Set(participantRows.map((p) => p.event_id))];

			const { data: eventsData, error: eventsError } = await supabase
				.from('agenda_events')
				.select('*')
				.in('id', eventIds);

			if (eventsError) {
				toast.error('Failed to load agenda events');
				setLoading(false);
				return;
			}

			const { data: devData, error: devError } = await supabase
				.from('agenda_event_deviations')
				.select('*')
				.in('event_id', eventIds);

			if (devError) {
				toast.error('Failed to load deviations');
				setLoading(false);
				return;
			}

			const eventsList = (eventsData as AgendaEventRow[]) ?? [];
			setAgendaEvents(eventsList);
			setDeviations((devData as AgendaEventDeviationRow[]) ?? []);

			const { data: allParticipants } = await supabase
				.from('agenda_participants')
				.select('event_id, user_id')
				.in('event_id', eventIds);
			const countByEvent = new Map<string, number>();
			const userIdsByEvent = new Map<string, string[]>();
			for (const p of allParticipants ?? []) {
				countByEvent.set(p.event_id, (countByEvent.get(p.event_id) ?? 0) + 1);
				const list = userIdsByEvent.get(p.event_id) ?? [];
				list.push(p.user_id);
				userIdsByEvent.set(p.event_id, list);
			}
			setParticipantCountByEventId(countByEvent);

			const allUserIds = [...new Set((allParticipants ?? []).map((p) => p.user_id))];
			const { data: participantProfiles } = await supabase
				.from('profiles')
				.select('user_id, first_name, last_name')
				.in('user_id', allUserIds);
			const profileMap = new Map(participantProfiles?.map((p) => [p.user_id, p]) ?? []);
			const namesByEvent = new Map<string, string[]>();
			for (const [eventId, userIds] of userIdsByEvent) {
				if (userIds.length <= 1) continue;
				const names = userIds
					.map((uid) => {
						const prof = profileMap.get(uid);
						return prof?.first_name && prof?.last_name
							? `${prof.first_name} ${prof.last_name}`
							: (prof?.first_name ?? prof?.last_name ?? 'Onbekend');
					})
					.sort();
				namesByEvent.set(eventId, names);
			}
			setParticipantNamesByEventId(namesByEvent);

			const lessonSourceIds = eventsList
				.filter((e) => e.source_type === 'lesson_agreement' && e.source_id)
				.map((e) => e.source_id as string);
			if (lessonSourceIds.length === 0) {
				setAgreements([]);
				setLoading(false);
				return;
			}

			const { data: agreementsData, error: agreementsError } = await supabase
				.from('lesson_agreements')
				.select(
					'id, day_of_week, start_time, start_date, end_date, is_active, student_user_id, lesson_type_id, duration_minutes, frequency, price_per_lesson, lesson_types(id, name, icon, color, is_group_lesson), teachers(user_id)',
				)
				.in('id', lessonSourceIds)
				.eq('is_active', true);

			if (agreementsError || !agreementsData?.length) {
				setAgreements([]);
				setLoading(false);
				return;
			}

			const studentUserIds = [...new Set(agreementsData.map((a) => a.student_user_id))];
			const getTeacherUserId = (teachers: unknown): string | undefined => {
				if (Array.isArray(teachers) && teachers.length > 0) {
					return (teachers[0] as { user_id?: string })?.user_id;
				}
				if (teachers && typeof teachers === 'object' && 'user_id' in teachers) {
					return (teachers as { user_id: string }).user_id;
				}
				return undefined;
			};
			const teacherUserIds = [
				...new Set(agreementsData.map((a) => getTeacherUserId(a.teachers)).filter((id): id is string => !!id)),
			];
			const agreementUserIds = [...new Set([...studentUserIds, ...teacherUserIds])];

			const { data: profilesData } = await supabase
				.from('profiles')
				.select('user_id, first_name, last_name, email, avatar_url')
				.in('user_id', agreementUserIds);

			const profilesMap = new Map(profilesData?.map((p) => [p.user_id, p]) ?? []);
			const withProfiles = agreementsData.map((a) => {
				const teacherUserId = getTeacherUserId(a.teachers);
				const row = {
					...a,
					profiles: profilesMap.get(a.student_user_id) ?? null,
					lesson_types: Array.isArray(a.lesson_types) ? a.lesson_types[0] : a.lesson_types,
					teacherUserId,
					teacherProfile: teacherUserId ? (profilesMap.get(teacherUserId) ?? null) : null,
				} as unknown as LessonAgreementWithTeacher;
				return row;
			});
			setAgreements(withProfiles);
			setLoading(false);
		},
		[effectiveUserId],
	);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const deviationsByEventId = useMemo(() => {
		const outer = new Map<string, Map<string, AgendaEventDeviationRow>>();
		for (const d of deviations) {
			let inner = outer.get(d.event_id);
			if (!inner) {
				inner = new Map();
				outer.set(d.event_id, inner);
			}
			inner.set(d.original_date, d);
		}
		return outer;
	}, [deviations]);

	const recurringByEventId = useMemo(() => {
		const map = new Map<string, AgendaEventDeviationRow[]>();
		for (const d of deviations) {
			if (!d.recurring) continue;
			const list = map.get(d.event_id) ?? [];
			list.push(d);
			map.set(d.event_id, list);
		}
		for (const list of map.values()) {
			list.sort((a, b) => b.original_date.localeCompare(a.original_date));
		}
		return map;
	}, [deviations]);

	const agreementsMap = useMemo(
		() => new Map(agreements.map((a) => [a.id, a])) as Map<string, LessonAgreementWithTeacher>,
		[agreements],
	);

	const getEnrichedEvents = useCallback(
		(currentDate: Date, viewerUserId: string | undefined): CalendarEvent[] => {
			const startDate = new Date(currentDate);
			startDate.setMonth(startDate.getMonth() - 1);
			const endDate = new Date(currentDate);
			endDate.setMonth(endDate.getMonth() + 2);

			const baseEvents = generateAgendaEvents(
				agendaEvents,
				startDate,
				endDate,
				deviationsByEventId,
				recurringByEventId,
				agreementsMap,
			);

			return baseEvents.map((ev) => {
				const participantCount = ev.resource.eventId
					? participantCountByEventId.get(ev.resource.eventId)
					: undefined;
				const participantNames = ev.resource.eventId
					? participantNamesByEventId.get(ev.resource.eventId)
					: undefined;
				const enriched = {
					...ev,
					resource: {
						...ev.resource,
						participantCount,
						participantNames,
					},
				};
				if (ev.resource.sourceType !== 'lesson_agreement' || !ev.resource.agreementId) return enriched;
				const agreement = agreementsMap.get(ev.resource.agreementId);
				if (!agreement) return enriched;
				const studentInfo = buildStudentInfo(agreement.profiles, agreement.student_user_id);
				const studentName = formatStudentName(agreement.profiles);
				const teacherName = agreement.teacherProfile
					? formatStudentName(agreement.teacherProfile)
					: 'Docent onbekend';
				const viewerIsTeacher = viewerUserId === agreement.teacherUserId;
				return {
					...enriched,
					title: `${studentName} - ${agreement.lesson_types.name}`,
					resource: {
						...enriched.resource,
						studentName,
						teacherName,
						viewerIsTeacher,
						lessonTypeName: agreement.lesson_types.name,
						lessonTypeColor: agreement.lesson_types.color,
						lessonTypeIcon: agreement.lesson_types.icon,
						isGroupLesson: agreement.lesson_types.is_group_lesson ?? false,
						studentCount: agreement.lesson_types.is_group_lesson ? 1 : undefined,
						studentInfo: studentInfo ?? undefined,
						studentInfoList: studentInfo ? [studentInfo] : undefined,
						isLesson: true,
					},
				};
			});
		},
		[
			agendaEvents,
			deviationsByEventId,
			recurringByEventId,
			agreementsMap,
			participantCountByEventId,
			participantNamesByEventId,
		],
	);

	return {
		agendaEvents,
		deviations,
		deviationsByEventId,
		recurringByEventId,
		agreementsMap,
		participantCountByEventId,
		participantNamesByEventId,
		loading,
		loadData,
		getEnrichedEvents,
	};
}
