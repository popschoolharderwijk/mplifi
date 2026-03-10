import { LuTriangleAlert } from 'react-icons/lu';
import { Card, CardContent } from '@/components/ui/card';
import { UserDisplay } from '@/components/ui/user-display';
import type { SlotWithStatus } from '@/lib/agreementSlots';
import { formatDbDateToUi } from '@/lib/date/date-format';
import { DAY_NAMES } from '@/lib/date/day-index';
import { frequencyLabels } from '@/lib/frequencies';
import { formatTime } from '@/lib/time/time-format';
import type { WizardInitialAgreement, WizardLessonTypeInfo, WizardTeacherInfo } from '@/types/lesson-agreements';
import type { UserOptional } from '@/types/users';
import { ConfirmStepRow } from './ConfirmStepRow';

interface ConfirmStepContentProps {
	isEditMode: boolean;
	hasChanges: boolean;
	initialAgreement: WizardInitialAgreement | null;
	loadedPeriod: { start_date: string; end_date: string | null } | null;
	selectedUser: UserOptional | null;
	selectedLessonType: WizardLessonTypeInfo | undefined;
	startDate: string;
	endDate: string;
	selectedTeacherUserId: string | null;
	selectedTeacher: WizardTeacherInfo | undefined;
	effectiveSlot: SlotWithStatus | null;
}

export function ConfirmStepContent({
	isEditMode,
	hasChanges,
	initialAgreement,
	loadedPeriod,
	selectedUser,
	selectedLessonType,
	startDate,
	endDate,
	selectedTeacherUserId,
	selectedTeacher,
	effectiveSlot,
}: ConfirmStepContentProps) {
	// Diff view (only when edit mode with changes)
	if (isEditMode && initialAgreement && hasChanges) {
		return (
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Card className="border-muted">
					<CardContent className="p-4">
						<p className="mb-3 text-sm font-semibold text-muted-foreground">Huidige overeenkomst</p>
						<ConfirmStepRow label="Leerling" alwaysSame>
							{selectedUser ? (
								<UserDisplay
									profile={{
										first_name: selectedUser.first_name,
										last_name: selectedUser.last_name,
										email: selectedUser.email,
										avatar_url: selectedUser.avatar_url,
									}}
									showEmail
								/>
							) : (
								<span>-</span>
							)}
						</ConfirmStepRow>
						<ConfirmStepRow label="Lessoort" alwaysSame>
							<span>
								{initialAgreement.lesson_type?.name
									? `${initialAgreement.lesson_type.name} (${frequencyLabels[initialAgreement.frequency]})`
									: '-'}
							</span>
						</ConfirmStepRow>
						<ConfirmStepRow label="Duur" alwaysSame>
							<span>
								{initialAgreement.duration_minutes != null
									? `${initialAgreement.duration_minutes} min`
									: '-'}
							</span>
						</ConfirmStepRow>
						<ConfirmStepRow label="Prijs" alwaysSame>
							<span>
								{initialAgreement.price_per_lesson != null
									? `€ ${Number(initialAgreement.price_per_lesson).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per les`
									: '-'}
							</span>
						</ConfirmStepRow>
						<ConfirmStepRow
							label="Periode"
							hideIcon
							changed={
								(loadedPeriod?.start_date ?? initialAgreement.start_date) !== startDate ||
								(loadedPeriod?.end_date ?? initialAgreement.end_date ?? '') !== endDate
							}
							oldValue={`${formatDbDateToUi(loadedPeriod?.start_date ?? initialAgreement.start_date ?? '')} t/m ${loadedPeriod?.end_date?.trim() ? formatDbDateToUi(loadedPeriod.end_date) : '-'}`}
						/>
						<ConfirmStepRow
							label="Docent"
							hideIcon
							changed={initialAgreement.teacher_user_id !== selectedTeacherUserId}
							oldValue={
								initialAgreement.teacher ? (
									<UserDisplay
										profile={{
											first_name: initialAgreement.teacher.first_name,
											last_name: initialAgreement.teacher.last_name,
											email: initialAgreement.teacher.email,
											avatar_url: initialAgreement.teacher.avatar_url,
										}}
										showEmail
									/>
								) : (
									<span>-</span>
								)
							}
						/>
						<ConfirmStepRow
							label="Tijdslot"
							hideIcon
							changed={
								initialAgreement.day_of_week !== effectiveSlot?.day_of_week ||
								formatTime(initialAgreement.start_time) !==
									(effectiveSlot ? formatTime(effectiveSlot.start_time) : '')
							}
							oldValue={`${DAY_NAMES[initialAgreement.day_of_week]} om ${formatTime(initialAgreement.start_time)}`}
						/>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<p className="mb-3 text-sm font-semibold text-primary">Nieuwe overeenkomst</p>
						<ConfirmStepRow label="Leerling" alwaysSame>
							{selectedUser ? (
								<UserDisplay
									profile={{
										first_name: selectedUser.first_name,
										last_name: selectedUser.last_name,
										email: selectedUser.email,
										avatar_url: selectedUser.avatar_url,
									}}
									showEmail
								/>
							) : (
								<span>-</span>
							)}
						</ConfirmStepRow>
						<ConfirmStepRow label="Lessoort" alwaysSame>
							<span>
								{selectedLessonType
									? `${selectedLessonType.name} (${frequencyLabels[selectedLessonType.frequency]})`
									: '-'}
							</span>
						</ConfirmStepRow>
						<ConfirmStepRow label="Duur" alwaysSame>
							<span>{selectedLessonType ? `${selectedLessonType.duration_minutes} min` : '-'}</span>
						</ConfirmStepRow>
						<ConfirmStepRow label="Prijs" alwaysSame>
							<span>
								{selectedLessonType?.price_per_lesson != null
									? `€ ${Number(selectedLessonType.price_per_lesson).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per les`
									: '-'}
							</span>
						</ConfirmStepRow>
						<ConfirmStepRow
							label="Periode"
							changed={
								initialAgreement.start_date !== startDate ||
								(initialAgreement.end_date ?? '') !== endDate
							}
							newValue={`${startDate ? formatDbDateToUi(startDate) : '-'} t/m ${endDate ? formatDbDateToUi(endDate) : '-'}`}
						/>
						<ConfirmStepRow
							label="Docent"
							changed={initialAgreement.teacher_user_id !== selectedTeacherUserId}
							newValue={
								selectedTeacher ? (
									<UserDisplay
										profile={{
											first_name: selectedTeacher.firstName,
											last_name: selectedTeacher.lastName,
											email: selectedTeacher.email,
											avatar_url: selectedTeacher.avatarUrl,
										}}
										showEmail
									/>
								) : (
									<span>-</span>
								)
							}
						/>
						<ConfirmStepRow
							label="Tijdslot"
							changed={
								initialAgreement.day_of_week !== effectiveSlot?.day_of_week ||
								formatTime(initialAgreement.start_time) !==
									(effectiveSlot ? formatTime(effectiveSlot.start_time) : '')
							}
							newValue={
								effectiveSlot ? (
									<>
										<span>
											{DAY_NAMES[effectiveSlot.day_of_week]} om{' '}
											{formatTime(effectiveSlot.start_time)}
										</span>
										{effectiveSlot.status === 'partial' && (
											<p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
												<LuTriangleAlert className="h-3 w-3" />
												Deels bezet ({effectiveSlot.occupiedOccurrences}/
												{effectiveSlot.totalOccurrences} momenten)
											</p>
										)}
									</>
								) : (
									<span>-</span>
								)
							}
						/>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Single view (new agreement or edit mode without changes)
	return (
		<div className="space-y-4 rounded-lg border p-4">
			<ConfirmStepRow label="Leerling">
				{selectedUser ? (
					<UserDisplay
						profile={{
							first_name: selectedUser.first_name,
							last_name: selectedUser.last_name,
							email: selectedUser.email,
							avatar_url: selectedUser.avatar_url,
						}}
						showEmail
					/>
				) : (
					<p className="font-medium">-</p>
				)}
			</ConfirmStepRow>
			<ConfirmStepRow label="Lessoort">
				<p className="font-medium">
					{selectedLessonType
						? `${selectedLessonType.name} (${frequencyLabels[selectedLessonType.frequency]})`
						: '-'}
				</p>
			</ConfirmStepRow>
			<ConfirmStepRow label="Duur">
				<p className="font-medium">{selectedLessonType ? `${selectedLessonType.duration_minutes} min` : '-'}</p>
			</ConfirmStepRow>
			<ConfirmStepRow label="Prijs">
				<p className="font-medium">
					{selectedLessonType?.price_per_lesson != null
						? `€ ${Number(selectedLessonType.price_per_lesson).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per les`
						: '-'}
				</p>
			</ConfirmStepRow>
			<ConfirmStepRow label="Periode">
				<p className="font-medium">
					{startDate ? formatDbDateToUi(startDate) : '-'} t/m {endDate ? formatDbDateToUi(endDate) : 'Geen'}
				</p>
			</ConfirmStepRow>
			<ConfirmStepRow label="Docent">
				{selectedTeacher ? (
					<UserDisplay
						profile={{
							first_name: selectedTeacher.firstName,
							last_name: selectedTeacher.lastName,
							email: selectedTeacher.email,
							avatar_url: selectedTeacher.avatarUrl,
						}}
						showEmail
					/>
				) : (
					<p className="font-medium">-</p>
				)}
			</ConfirmStepRow>
			<ConfirmStepRow label="Tijdslot">
				<p className="font-medium">
					{effectiveSlot
						? `${DAY_NAMES[effectiveSlot.day_of_week]} om ${formatTime(effectiveSlot.start_time)}`
						: '-'}
				</p>
				{effectiveSlot?.status === 'partial' && (
					<p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
						<LuTriangleAlert className="h-3 w-3" />
						Deels bezet ({effectiveSlot.occupiedOccurrences}/{effectiveSlot.totalOccurrences} momenten)
					</p>
				)}
			</ConfirmStepRow>
		</div>
	);
}
