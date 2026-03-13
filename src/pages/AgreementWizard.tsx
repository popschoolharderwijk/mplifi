import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmStepContent } from '@/components/agreements/ConfirmStepContent';
import { PeriodStepContent } from '@/components/agreements/PeriodStepContent';
import { TeacherSlotStepContent } from '@/components/agreements/TeacherSlotStepContent';
import { UserStepContent } from '@/components/agreements/UserStepContent';
import { STEP_ORDER, WizardStep, WizardStepIndicator } from '@/components/agreements/WizardStepIndicator';
import { NavPageHeaderIcon } from '@/components/layout/NavPageHeaderIcon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { useAutofocus } from '@/hooks/useAutofocus';
import { supabase } from '@/integrations/supabase/client';
import { getSlotStatuses, type SlotWithStatus } from '@/lib/agreementSlots';
import { addDaysFromNow, addYearsFromNow, formatDateToDb } from '@/lib/date/date-format';
import { formatTime } from '@/lib/time/time-format';
import type {
	AgreementTableRow,
	LessonFrequency,
	LessonTypeOptionSnapshot,
	WizardLessonTypeInfo,
	WizardTeacherInfo,
} from '@/types/lesson-agreements';
import type { User } from '@/types/users';

// ============ Helpers ============

function tomorrow(): string {
	return formatDateToDb(addDaysFromNow(1));
}

function oneYearFromToday(): string {
	return formatDateToDb(addYearsFromNow(1));
}

// ============ Custom Hooks ============

function useAgreement(id: string | undefined, isEditMode: boolean) {
	const [agreement, setAgreement] = useState<AgreementTableRow | null>(null);
	const [loading, setLoading] = useState(isEditMode);
	const loadedPeriodRef = useRef<{ start_date: string; end_date: string | null } | null>(null);
	const navigate = useNavigate();

	useEffect(() => {
		if (!isEditMode || !id) {
			setLoading(false);
			return;
		}

		const load = async () => {
			const { data, error } = await supabase
				.from('lesson_agreements')
				.select(
					`id, created_at, day_of_week, start_time, start_date, end_date, is_active, notes, 
					student_user_id, teacher_user_id, lesson_type_id, duration_minutes, frequency, price_per_lesson,
					lesson_types(id, name, icon, color), 
					teachers(user_id)`,
				)
				.eq('id', id)
				.single();

			if (error || !data) {
				toast.error('Overeenkomst niet gevonden');
				navigate('/agreements');
				return;
			}

			loadedPeriodRef.current = { start_date: data.start_date, end_date: data.end_date ?? null };

			const teacher = Array.isArray(data.teachers) ? data.teachers[0] : data.teachers;
			const teacherUserId = teacher?.user_id;
			const lessonType = Array.isArray(data.lesson_types) ? data.lesson_types[0] : data.lesson_types;

			const [teacherProfile, studentProfile] = await Promise.all([
				teacherUserId
					? supabase
							.from('profiles')
							.select('first_name, last_name, email, avatar_url')
							.eq('user_id', teacherUserId)
							.single()
					: { data: null },
				supabase
					.from('profiles')
					.select('first_name, last_name, email, avatar_url')
					.eq('user_id', data.student_user_id)
					.single(),
			]);

			setAgreement({
				id: data.id,
				created_at: data.created_at,
				day_of_week: data.day_of_week,
				start_time: data.start_time,
				start_date: data.start_date,
				end_date: data.end_date,
				is_active: data.is_active,
				notes: data.notes,
				student_user_id: data.student_user_id,
				teacher_user_id: data.teacher_user_id,
				lesson_type_id: data.lesson_type_id,
				duration_minutes: data.duration_minutes,
				frequency: data.frequency,
				price_per_lesson: data.price_per_lesson,
				student: {
					first_name: studentProfile.data?.first_name ?? null,
					last_name: studentProfile.data?.last_name ?? null,
					avatar_url: studentProfile.data?.avatar_url ?? null,
					email: studentProfile.data?.email ?? '',
				},
				teacher: {
					email: teacherProfile.data?.email ?? null,
					first_name: teacherProfile.data?.first_name ?? null,
					last_name: teacherProfile.data?.last_name ?? null,
					avatar_url: teacherProfile.data?.avatar_url ?? null,
				},
				lesson_type: {
					id: lessonType.id,
					name: lessonType.name,
					icon: lessonType.icon,
					color: lessonType.color,
				},
			});
			setLoading(false);
		};

		load();
	}, [id, isEditMode, navigate]);

	return { agreement, loading, loadedPeriod: loadedPeriodRef };
}

function useLessonTypes() {
	const [types, setTypes] = useState<Array<{ id: string; name: string; icon: string; color: string }>>([]);

	useEffect(() => {
		supabase
			.from('lesson_types')
			.select('id, name, icon, color')
			.eq('is_active', true)
			.order('name')
			.then(({ data }) => setTypes(data ?? []));
	}, []);

	return types;
}

function useLessonTypeOptions(lessonTypeId: string | null) {
	const [options, setOptions] = useState<LessonTypeOptionSnapshot[]>([]);

	useEffect(() => {
		if (!lessonTypeId) {
			setOptions([]);
			return;
		}
		supabase
			.from('lesson_type_options')
			.select('id, duration_minutes, frequency, price_per_lesson')
			.eq('lesson_type_id', lessonTypeId)
			.order('duration_minutes')
			.order('frequency')
			.then(({ data }) => setOptions(data ?? []));
	}, [lessonTypeId]);

	return options;
}

function useTeacherSlots(
	step: WizardStep,
	teacherUserId: string | null,
	lessonTypeId: string | null,
	startDate: string,
	endDate: string,
	initialAgreement: AgreementTableRow | null,
	selectedLessonType: { duration_minutes: number; frequency: LessonFrequency } | undefined,
) {
	const [slots, setSlots] = useState<SlotWithStatus[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (step !== WizardStep.TeacherSlot || !teacherUserId || !lessonTypeId || !startDate || !endDate) {
			setSlots([]);
			return;
		}

		const load = async () => {
			setLoading(true);
			// Load ALL agreements for this teacher (all lesson types) so slot status reflects
			// whether the teacher is free/partially/fully occupied in that slot (e.g. drums + gitaar).
			const [avail, agreements] = await Promise.all([
				supabase
					.from('teacher_availability')
					.select('day_of_week, start_time, end_time')
					.eq('teacher_user_id', teacherUserId),
				supabase
					.from('lesson_agreements')
					.select('id, day_of_week, start_time, start_date, end_date, duration_minutes, frequency')
					.eq('teacher_user_id', teacherUserId)
					.lte('start_date', endDate),
			]);

			if (avail.error) {
				toast.error('Fout bij laden beschikbaarheid');
				setLoading(false);
				return;
			}

			const filteredAgreements = (agreements.data ?? [])
				.filter((a) => a.start_date <= endDate && (a.end_date === null || a.end_date >= startDate))
				.filter((a) => !initialAgreement || a.id !== initialAgreement.id)
				.map((a) => ({
					day_of_week: a.day_of_week,
					start_time: a.start_time,
					start_date: a.start_date,
					end_date: a.end_date,
					frequency: a.frequency,
					duration_minutes: a.duration_minutes,
				}));

			if (!selectedLessonType) {
				setSlots([]);
				setLoading(false);
				return;
			}
			const duration = selectedLessonType.duration_minutes;
			const frequency = selectedLessonType.frequency;
			const statuses = getSlotStatuses(
				new Date(startDate),
				new Date(endDate),
				avail.data ?? [],
				filteredAgreements,
				duration,
				frequency,
			);

			// Auto-select existing slot in edit mode
			if (initialAgreement) {
				const existing = statuses.find(
					(s) =>
						s.day_of_week === initialAgreement.day_of_week &&
						formatTime(s.start_time) === formatTime(initialAgreement.start_time),
				);
				if (existing) {
					setSlots(statuses);
					// Need to communicate selected slot back - handled via parent
					setSlots(statuses);
				} else {
					setSlots(statuses);
				}
			} else {
				setSlots(statuses);
			}

			setLoading(false);
		};

		load();
	}, [step, teacherUserId, lessonTypeId, startDate, endDate, initialAgreement, selectedLessonType]);

	return { slots, loading };
}

function useTeachers(step: WizardStep, lessonTypeId: string | null) {
	const [teachers, setTeachers] = useState<WizardTeacherInfo[]>([]);

	useEffect(() => {
		if (step === WizardStep.User || step === WizardStep.Period || !lessonTypeId) {
			setTeachers([]);
			return;
		}

		const load = async () => {
			const { data: tltData } = await supabase
				.from('teacher_lesson_types')
				.select('teacher_user_id')
				.eq('lesson_type_id', lessonTypeId);

			if (!tltData?.length) return;

			const teacherUserIds = tltData.map((r) => r.teacher_user_id);
			const { data: teachersData } = await supabase
				.from('teachers')
				.select('user_id')
				.in('user_id', teacherUserIds)
				.eq('is_active', true);

			if (!teachersData?.length) return;

			const userIds = teachersData.map((t) => t.user_id);
			const { data: profiles } = await supabase
				.from('profiles')
				.select('user_id, first_name, last_name, email, avatar_url')
				.in('user_id', userIds);

			const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

			setTeachers(
				teachersData.map((t) => {
					const p = profileMap.get(t.user_id);
					return {
						id: t.user_id,
						userId: t.user_id,
						firstName: p?.first_name ?? null,
						lastName: p?.last_name ?? null,
						email: p?.email ?? null,
						avatarUrl: p?.avatar_url ?? null,
					};
				}),
			);
		};

		load();
	}, [step, lessonTypeId]);

	return teachers;
}

// ============ Main Component ============

export default function AgreementWizard() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { setBreadcrumbSuffix } = useBreadcrumb();

	const isEditMode = id !== undefined && id !== 'new';

	// Data loading
	const { agreement, loading: loadingAgreement, loadedPeriod } = useAgreement(id, isEditMode);
	const lessonTypes = useLessonTypes();

	// Form state
	const [step, setStep] = useState<WizardStep>(WizardStep.User);
	const [form, setForm] = useState({
		studentUserId: null as string | null,
		user: null as User | null,
		lessonTypeId: null as string | null,
		/** Snapshot from chosen option (for new agreement); in edit mode comes from agreement */
		selectedOptionSnapshot: null as {
			duration_minutes: number;
			frequency: LessonFrequency;
			price_per_lesson: number;
		} | null,
		startDate: tomorrow(),
		endDate: oneYearFromToday(),
		teacherUserId: null as string | null,
		slot: null as SlotWithStatus | null,
	});

	const [highestStep, setHighestStep] = useState(0);
	const [partialConfirmOpen, setPartialConfirmOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const startDatePickerRef = useAutofocus<HTMLButtonElement>(step === WizardStep.Period);

	// Derived state
	const teachers = useTeachers(step, form.lessonTypeId);
	const lessonTypeOptions = useLessonTypeOptions(form.lessonTypeId);

	const selectedLessonType = useMemo((): WizardLessonTypeInfo | undefined => {
		if (agreement) {
			return {
				id: agreement.lesson_type_id,
				name: agreement.lesson_type.name,
				icon: agreement.lesson_type.icon,
				color: agreement.lesson_type.color,
				duration_minutes: agreement.duration_minutes,
				frequency: agreement.frequency,
				price_per_lesson: agreement.price_per_lesson,
			};
		}
		const type = lessonTypes.find((lt) => lt.id === form.lessonTypeId);
		const snap = form.selectedOptionSnapshot;
		if (!type || !snap) return undefined;
		return {
			id: type.id,
			name: type.name,
			icon: type.icon,
			color: type.color,
			duration_minutes: snap.duration_minutes,
			frequency: snap.frequency,
			price_per_lesson: snap.price_per_lesson,
		};
	}, [agreement, lessonTypes, form.lessonTypeId, form.selectedOptionSnapshot]);

	const { slots: slotsWithStatus, loading: loadingSlots } = useTeacherSlots(
		step,
		form.teacherUserId,
		form.lessonTypeId,
		form.startDate,
		form.endDate,
		agreement,
		selectedLessonType,
	);

	const selectedTeacher = useMemo(() => {
		if (teachers.length > 0) return teachers.find((t) => t.id === form.teacherUserId);
		if (agreement?.teacher) {
			return {
				id: agreement.teacher_user_id,
				userId: '',
				firstName: agreement.teacher.first_name,
				lastName: agreement.teacher.last_name,
				email: agreement.teacher.email ?? '',
				avatarUrl: agreement.teacher.avatar_url,
			};
		}
		return undefined;
	}, [teachers, form.teacherUserId, agreement]);

	const effectiveSlot = useMemo(() => {
		if (form.slot) return form.slot;
		if (agreement?.day_of_week) {
			return {
				day_of_week: agreement.day_of_week,
				start_time: agreement.start_time,
				end_time: agreement.start_time,
				status: 'free' as const,
				occupiedOccurrences: 0,
				totalOccurrences: 0,
			};
		}
		return null;
	}, [form.slot, agreement]);

	// Check for changes
	const hasChanges = useMemo(() => {
		if (!agreement) return false;
		const periodChanged = agreement.start_date !== form.startDate;
		const endChanged = (agreement.end_date ?? '') !== form.endDate;
		const teacherChanged = agreement.teacher_user_id !== form.teacherUserId;
		const slotChanged =
			agreement.day_of_week !== effectiveSlot?.day_of_week ||
			formatTime(agreement.start_time) !== (effectiveSlot ? formatTime(effectiveSlot.start_time) : '');
		return periodChanged || endChanged || teacherChanged || slotChanged;
	}, [agreement, form.startDate, form.endDate, form.teacherUserId, effectiveSlot]);

	const isTeacherOwnStudent = selectedTeacher && form.studentUserId && selectedTeacher.userId === form.studentUserId;

	// Initialize form from loaded agreement
	useEffect(() => {
		if (loadingAgreement) return;
		setStep(isEditMode ? WizardStep.Confirm : WizardStep.User);
		setHighestStep(isEditMode ? STEP_ORDER.length - 1 : 0);

		if (agreement) {
			const slotFromAgreement: SlotWithStatus = {
				day_of_week: agreement.day_of_week,
				start_time: agreement.start_time,
				end_time: agreement.start_time,
				status: 'free',
				totalOccurrences: 0,
				occupiedOccurrences: 0,
			};
			setForm((f) => ({
				...f,
				studentUserId: agreement.student_user_id,
				user: {
					user_id: agreement.student_user_id,
					first_name: agreement.student.first_name,
					last_name: agreement.student.last_name,
					email: agreement.student.email,
					avatar_url: agreement.student.avatar_url,
					phone_number: null,
				},
				lessonTypeId: agreement.lesson_type_id,
				selectedOptionSnapshot: {
					duration_minutes: agreement.duration_minutes,
					frequency: agreement.frequency,
					price_per_lesson: agreement.price_per_lesson,
				},
				startDate: agreement.start_date,
				endDate: agreement.end_date?.trim() ? agreement.end_date : oneYearFromToday(),
				teacherUserId: agreement.teacher_user_id,
				slot: slotFromAgreement,
			}));
		}
	}, [loadingAgreement, isEditMode, agreement]);

	// Breadcrumbs
	useEffect(() => {
		if (loadingAgreement || !isEditMode || !agreement) return;
		const studentName = [agreement.student.first_name, agreement.student.last_name].filter(Boolean).join(' ');
		const label = studentName ? `${studentName} (${agreement.lesson_type.name})` : agreement.lesson_type.name;
		setBreadcrumbSuffix([{ label, href: `/agreements/${id}` }]);
		return () => setBreadcrumbSuffix([]);
	}, [loadingAgreement, isEditMode, agreement, id, setBreadcrumbSuffix]);

	// Navigation
	const stepIndex = STEP_ORDER.indexOf(step);
	const isFirstStep = stepIndex === 0;
	const isLastStep = stepIndex === STEP_ORDER.length - 1;

	const canProceed = useCallback(
		(s: WizardStep) => {
			switch (s) {
				case WizardStep.User:
					return Boolean(
						form.studentUserId && form.lessonTypeId && (isEditMode || form.selectedOptionSnapshot),
					);
				case WizardStep.Period:
					return Boolean(
						form.startDate && form.endDate && new Date(form.endDate) >= new Date(form.startDate),
					);
				case WizardStep.TeacherSlot:
					return Boolean(form.slot && form.slot.status !== 'occupied' && !isTeacherOwnStudent);
				case WizardStep.Confirm:
					return true;
				default:
					return false;
			}
		},
		[form, isTeacherOwnStudent, isEditMode],
	);

	const nextStep = () => {
		if (!isLastStep) {
			const next = stepIndex + 1;
			setStep(STEP_ORDER[next]);
			if (next > highestStep) setHighestStep(next);
		}
	};

	const prevStep = () => {
		if (!isFirstStep) setStep(STEP_ORDER[stepIndex - 1]);
	};

	// Save
	const handleSave = async () => {
		if (
			!form.studentUserId ||
			!form.lessonTypeId ||
			!form.teacherUserId ||
			!form.slot ||
			form.slot.status === 'occupied'
		) {
			toast.error('Selecteer alle verplichte velden');
			return;
		}
		setSaving(true);
		const timeValue = form.slot.start_time.includes(':') ? form.slot.start_time : form.slot.start_time + ':00';

		const payload = {
			teacher_user_id: form.teacherUserId,
			day_of_week: form.slot.day_of_week,
			start_time: timeValue,
			start_date: form.startDate,
			end_date: form.endDate || null,
		};

		const { error } = agreement
			? await supabase.from('lesson_agreements').update(payload).eq('id', agreement.id)
			: await supabase.from('lesson_agreements').insert({
					...payload,
					student_user_id: form.studentUserId,
					lesson_type_id: form.lessonTypeId,
					duration_minutes: form.selectedOptionSnapshot ? form.selectedOptionSnapshot.duration_minutes : 30,
					frequency: form.selectedOptionSnapshot ? form.selectedOptionSnapshot.frequency : 'weekly',
					price_per_lesson: form.selectedOptionSnapshot ? form.selectedOptionSnapshot.price_per_lesson : 30,
					is_active: true,
				});

		setSaving(false);
		if (error) {
			toast.error(error.message.includes('unique') ? 'Deze combinatie bestaat al' : 'Fout bij opslagen');
			return;
		}
		toast.success(agreement ? 'Overeenkomst bijgewerkt' : 'Overeenkomst toegevoegd');
		navigate('/agreements');
	};

	if (loadingAgreement) {
		return (
			<div className="flex items-center justify-center p-8">
				<div className="text-muted-foreground">Laden...</div>
			</div>
		);
	}

	const studentName =
		isEditMode && agreement
			? [agreement.student.first_name, agreement.student.last_name].filter(Boolean).join(' ') ||
				agreement.student.email
			: null;
	const studentInitials =
		isEditMode && agreement
			? agreement.student.first_name && agreement.student.last_name
				? `${agreement.student.first_name[0]}${agreement.student.last_name[0]}`.toUpperCase()
				: agreement.student.first_name
					? agreement.student.first_name.slice(0, 2).toUpperCase()
					: agreement.student.email.slice(0, 2).toUpperCase()
			: '?';

	return (
		<>
			{/* Header */}
			<div className="mb-6">
				<PageHeader
					icon={
						isEditMode && agreement ? (
							<Avatar className="h-16 w-16">
								{agreement.student.avatar_url && (
									<AvatarImage src={agreement.student.avatar_url} alt={studentName ?? ''} />
								)}
								<AvatarFallback className="bg-primary/10 text-primary text-xl">
									{studentInitials}
								</AvatarFallback>
							</Avatar>
						) : (
							<NavPageHeaderIcon name="agreements" />
						)
					}
					title={isEditMode && agreement ? studentName : 'Nieuwe overeenkomst'}
					subtitle={isEditMode && agreement ? agreement.lesson_type.name : undefined}
				/>
			</div>

			{/* Steps */}
			<WizardStepIndicator
				step={step}
				stepIndex={stepIndex}
				highestReachedStepIndex={highestStep}
				onStepChange={setStep}
			/>

			{/* Content */}
			<div className="mt-6 max-w-2xl rounded-lg border bg-card p-6">
				{step === WizardStep.User && (
					<UserStepContent
						isEditMode={isEditMode}
						selectedStudentUserId={form.studentUserId}
						selectedUser={form.user}
						selectedLessonTypeId={form.lessonTypeId}
						selectedLessonType={selectedLessonType}
						lessonTypes={lessonTypes.map((lt) => ({
							id: lt.id,
							name: lt.name,
							icon: lt.icon,
							color: lt.color,
						}))}
						lessonTypeOptions={lessonTypeOptions}
						selectedOptionSnapshot={form.selectedOptionSnapshot}
						onStudentUserIdChange={(v) => setForm((f) => ({ ...f, studentUserId: v }))}
						onUserChange={(v) => setForm((f) => ({ ...f, user: v }))}
						onLessonTypeChange={(v) =>
							setForm((f) => ({ ...f, lessonTypeId: v, selectedOptionSnapshot: null }))
						}
						onOptionSnapshotChange={(snap) => setForm((f) => ({ ...f, selectedOptionSnapshot: snap }))}
					/>
				)}

				{step === WizardStep.Period && (
					<PeriodStepContent
						startDate={form.startDate}
						endDate={form.endDate}
						onStartDateChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
						onEndDateChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
						startDatePickerRef={startDatePickerRef}
					/>
				)}

				{step === WizardStep.TeacherSlot && (
					<TeacherSlotStepContent
						teachers={teachers}
						selectedTeacher={selectedTeacher}
						excludeUserIds={form.studentUserId ? [form.studentUserId] : []}
						slotsWithStatus={slotsWithStatus}
						selectedSlot={form.slot}
						currentAgreementSlot={
							isEditMode && agreement && form.teacherUserId === agreement.teacher_user_id
								? { day_of_week: agreement.day_of_week, start_time: agreement.start_time }
								: null
						}
						loadingStep3={loadingSlots}
						isTeacherOwnStudent={isTeacherOwnStudent}
						onTeacherChange={(v) => setForm((f) => ({ ...f, teacherUserId: v, slot: null }))}
						onSlotClick={(slot) => {
							if (slot.status === 'occupied') return;
							if (slot.status === 'partial') {
								setForm((f) => ({ ...f, slot }));
								setPartialConfirmOpen(true);
								return;
							}
							setForm((f) => ({ ...f, slot }));
						}}
					/>
				)}

				{step === WizardStep.Confirm && (
					<div className="space-y-6">
						<div className="text-center mb-4">
							<h3 className="text-lg font-semibold">
								{hasChanges ? 'Controleer je wijzigingen' : 'Overzicht'}
							</h3>
							<p className="text-sm text-muted-foreground">
								{isEditMode
									? hasChanges
										? 'Bekijk de wijzigingen en bevestig om op te slaan.'
										: ''
									: 'Bekijk de samenvatting en bevestig om de overeenkomst aan te maken.'}
							</p>
						</div>
						<ConfirmStepContent
							isEditMode={isEditMode}
							hasChanges={hasChanges}
							initialAgreement={agreement}
							loadedPeriod={loadedPeriod.current}
							selectedUser={form.user}
							selectedLessonType={selectedLessonType}
							startDate={form.startDate}
							endDate={form.endDate}
							selectedTeacherUserId={form.teacherUserId}
							selectedTeacher={selectedTeacher}
							effectiveSlot={effectiveSlot}
						/>
					</div>
				)}
			</div>

			{/* Navigation */}
			<div className="mt-6 max-w-2xl flex justify-between gap-2">
				{!isFirstStep && (
					<Button variant="outline" onClick={prevStep}>
						Vorige
					</Button>
				)}
				<div className="flex-1" />
				{!isLastStep ? (
					<Button onClick={nextStep} disabled={stepIndex < highestStep ? false : !canProceed(step)}>
						Volgende
					</Button>
				) : (
					<Button
						onClick={handleSave}
						disabled={
							!form.slot ||
							form.slot.status === 'occupied' ||
							saving ||
							isTeacherOwnStudent ||
							(isEditMode && !hasChanges)
						}
					>
						{saving ? 'Opslaan...' : isEditMode ? 'Opslaan' : 'Bevestigen'}
					</Button>
				)}
			</div>

			{/* Partial slot dialog */}
			{partialConfirmOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
						<div className="flex items-center gap-2 mb-4">
							<LuTriangleAlert className="h-5 w-5 text-amber-500" />
							<h3 className="text-lg font-semibold">Deels bezet tijdslot</h3>
						</div>
						<p className="text-muted-foreground mb-6">
							Dit tijdslot is deels bezet in de gekozen periode
							{form.slot?.totalOccurrences != null && form.slot?.occupiedOccurrences != null && (
								<>
									{' '}
									({form.slot.occupiedOccurrences} van {form.slot.totalOccurrences} momenten bezet)
								</>
							)}
							. Weet je zeker dat je dit tijdslot wilt gebruiken?
						</p>
						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setPartialConfirmOpen(false)}>
								Annuleren
							</Button>
							<Button onClick={() => setPartialConfirmOpen(false)}>Toch gebruiken</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
