import { useMemo } from 'react';
import { LuCircleCheck, LuCircleX, LuTriangleAlert } from 'react-icons/lu';
import { Label } from '@/components/ui/label';
import { SectionSkeleton } from '@/components/ui/page-skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserSelectSingle } from '@/components/ui/user-select';
import type { SlotStatus, SlotWithStatus } from '@/lib/agreementSlots';
import { DAY_NAMES } from '@/lib/date/day-index';
import { formatTime } from '@/lib/time/time-format';
import { cn } from '@/lib/utils';

/** Slot of the existing agreement when editing (for clear visual marking) */
export interface CurrentAgreementSlot {
	day_of_week: number;
	start_time: string;
}

const SLOT_STATUS_ICON: Record<SlotStatus, typeof LuCircleCheck> = {
	free: LuCircleCheck,
	partial: LuTriangleAlert,
	occupied: LuCircleX,
};

const SLOT_STATUS_TITLE: Record<SlotStatus, string> = {
	free: 'Vrij',
	partial: 'Deels bezet',
	occupied: 'Bezet',
};

function SlotStatusIcon({
	status,
	occupiedOccurrences,
	totalOccurrences,
}: {
	status: SlotStatus;
	occupiedOccurrences: number;
	totalOccurrences: number;
}) {
	const Icon = SLOT_STATUS_ICON[status];
	const title =
		status === 'partial'
			? `Deels bezet (${occupiedOccurrences}/${totalOccurrences} momenten)`
			: SLOT_STATUS_TITLE[status];
	return (
		<Icon
			className={cn(
				'h-3.5 w-3.5 shrink-0',
				status === 'free' && 'text-green-600 dark:text-green-400',
				status === 'partial' && 'text-amber-600 dark:text-amber-400',
				status === 'occupied' && 'text-muted-foreground opacity-70',
			)}
			title={title}
			aria-label={title}
		/>
	);
}

/** Monday=1, ..., Sunday=0 for sort key (day_of_week from DB) */
function sortKeyDay(dayOfWeek: number): number {
	return (dayOfWeek + 6) % 7;
}

function sortSlotsByDayThenTime(slots: SlotWithStatus[]): SlotWithStatus[] {
	return [...slots].sort((a, b) => {
		const dayA = sortKeyDay(a.day_of_week);
		const dayB = sortKeyDay(b.day_of_week);
		if (dayA !== dayB) return dayA - dayB;
		return (a.start_time || '').localeCompare(b.start_time || '');
	});
}

function groupSlotsByDay(slots: SlotWithStatus[]): Map<number, SlotWithStatus[]> {
	const map = new Map<number, SlotWithStatus[]>();
	for (const slot of slots) {
		const day = slot.day_of_week;
		const arr = map.get(day) ?? [];
		if (arr.length === 0) map.set(day, arr);
		arr.push(slot);
	}
	// Sort by time within each day
	for (const arr of map.values()) {
		arr.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
	}
	return map;
}

interface TeacherOption {
	id: string;
	userId: string;
	firstName: string | null;
	lastName: string | null;
	email: string | null;
	avatarUrl: string | null;
}

interface TeacherSlotStepContentProps {
	teachers: TeacherOption[];
	selectedTeacher: TeacherOption | undefined;
	/** User IDs to exclude from the teacher list (e.g. the student so they can't be their own teacher) */
	excludeUserIds?: string[];
	slotsWithStatus: SlotWithStatus[];
	selectedSlot: SlotWithStatus | null;
	/** When editing: the time slot of the existing agreement (shown with solid background) */
	currentAgreementSlot?: CurrentAgreementSlot | null;
	loadingStep3: boolean;
	isTeacherOwnStudent: boolean;
	onTeacherChange: (userId: string | null) => void;
	onSlotClick: (slot: SlotWithStatus) => void;
}

export function TeacherSlotStepContent({
	teachers,
	selectedTeacher,
	excludeUserIds = [],
	slotsWithStatus,
	selectedSlot,
	currentAgreementSlot = null,
	loadingStep3,
	isTeacherOwnStudent,
	onTeacherChange,
	onSlotClick,
}: TeacherSlotStepContentProps) {
	const sortedSlots = useMemo(() => sortSlotsByDayThenTime(slotsWithStatus), [slotsWithStatus]);
	const slotsByDay = useMemo(() => groupSlotsByDay(sortedSlots), [sortedSlots]);
	const dayOrder = useMemo(() => [1, 2, 3, 4, 5, 6, 0] as const, []); // Monday first, Sunday last

	return (
		<div className="space-y-4 py-4">
			<div className="space-y-2">
				<Label>Docent</Label>
				<UserSelectSingle
					filter="teachers"
					value={selectedTeacher?.userId ?? null}
					onChange={(user) => {
						if (!user) {
							onTeacherChange(null);
							return;
						}
						const teacher = teachers.find((t) => t.userId === user.user_id);
						onTeacherChange(teacher?.id ?? null);
					}}
					excludeUserIds={excludeUserIds}
					placeholder="Selecteer docent..."
				/>
				{isTeacherOwnStudent && (
					<p className="text-sm text-destructive flex items-center gap-1 mt-2">
						<LuTriangleAlert className="h-4 w-4" />
						Een docent kan niet zijn eigen leerling zijn.
					</p>
				)}
			</div>
			<div className="space-y-2">
				<Label>Tijdslot</Label>
				{loadingStep3 ? (
					<SectionSkeleton className="py-6" />
				) : (
					<div className="space-y-2">
						<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
							<span className="inline-flex items-center gap-1">
								<LuCircleCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-hidden />
								Vrij
							</span>
							<span className="inline-flex items-center gap-1">
								<LuTriangleAlert
									className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
									aria-hidden
								/>
								Deels bezet
							</span>
							<span className="inline-flex items-center gap-1">
								<LuCircleX className="h-3.5 w-3.5 text-muted-foreground opacity-70" aria-hidden />
								Bezet
							</span>
						</div>
						<ScrollArea className="h-72 rounded-md border">
							<div className="p-2 space-y-3">
								{slotsWithStatus.length === 0 ? (
									<p className="text-sm text-muted-foreground py-2">
										Geen beschikbare slots voor deze docent in de gekozen periode.
									</p>
								) : (
									dayOrder.map((dayOfWeek) => {
										const daySlots = slotsByDay.get(dayOfWeek);
										if (!daySlots?.length) return null;
										return (
											<div key={dayOfWeek} className="space-y-1.5">
												<div className="text-xs font-medium text-muted-foreground sticky top-0 bg-background py-0.5">
													{DAY_NAMES[dayOfWeek]}
												</div>
												<div className="flex flex-wrap gap-1.5">
													{daySlots.map((slot, idx) => {
														const isSelected =
															selectedSlot?.day_of_week === slot.day_of_week &&
															selectedSlot?.start_time === slot.start_time;
														const isCurrentAgreementSlot =
															currentAgreementSlot != null &&
															currentAgreementSlot.day_of_week === slot.day_of_week &&
															formatTime(currentAgreementSlot.start_time) ===
																formatTime(slot.start_time);
														const isOccupied = slot.status === 'occupied';
														return (
															<button
																key={`${slot.day_of_week}-${slot.start_time}-${idx}`}
																type="button"
																disabled={isOccupied}
																onClick={() => onSlotClick(slot)}
																className={cn(
																	'rounded border px-2 py-1 text-xs transition-colors inline-flex items-center gap-1.5',
																	isOccupied &&
																		'cursor-not-allowed bg-muted opacity-60',
																	!isOccupied && 'hover:bg-accent',
																	isSelected && 'ring-2 ring-primary',
																	isCurrentAgreementSlot &&
																		'bg-primary/30 dark:bg-primary/40 border-primary dark:border-primary',
																	slot.status === 'free' &&
																		!isCurrentAgreementSlot &&
																		'border-green-200 dark:border-green-800',
																	slot.status === 'partial' &&
																		!isCurrentAgreementSlot &&
																		'border-amber-200 dark:border-amber-800',
																)}
																title={
																	(isCurrentAgreementSlot
																		? 'Huidige slot van deze overeenkomst. '
																		: '') +
																	SLOT_STATUS_TITLE[slot.status] +
																	(slot.status === 'partial'
																		? ` (${slot.occupiedOccurrences}/${slot.totalOccurrences})`
																		: '')
																}
															>
																<SlotStatusIcon
																	status={slot.status}
																	occupiedOccurrences={slot.occupiedOccurrences}
																	totalOccurrences={slot.totalOccurrences}
																/>
																<span className="font-medium tabular-nums">
																	{formatTime(slot.start_time)}
																</span>
															</button>
														);
													})}
												</div>
											</div>
										);
									})
								)}
							</div>
						</ScrollArea>
					</div>
				)}
			</div>
		</div>
	);
}
