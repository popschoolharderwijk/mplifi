import { useState } from 'react';
import { LuTrash2, LuX } from 'react-icons/lu';
import { toast } from 'sonner';
import { DeviationInfoBanner } from '@/components/agenda/DeviationInfoBanner';
import { RecurrenceChoiceDialog, type RecurrenceScope } from '@/components/agenda/RecurrenceChoiceDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LessonTypeBadge } from '@/components/ui/lesson-type-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TimeInput } from '@/components/ui/time-input';
import { getDisplayName } from '@/components/ui/user-display';
import { UsersSelect } from '@/components/ui/users-select';
import { useAgendaEventForm } from '@/hooks/useAgendaEventForm';
import { useAuth } from '@/hooks/useAuth';
import { frequencyOptions } from '@/lib/frequencies';
import type { AgendaEventRow, DeleteScope, DeviationInfo } from '@/types/agenda-events';
import type { LessonFrequency } from '@/types/lesson-agreements';

export type { DeleteScope, DeviationInfo } from '@/types/agenda-events';

interface AgendaEventFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	event?: AgendaEventRow | null;
	initialSlot?: { start: Date; end: Date } | null;
	onSuccess?: () => void;
	onDelete?: (eventId: string, scope: DeleteScope, occurrenceDate?: string) => void | Promise<void>;
	deviationInfo?: DeviationInfo | null;
	onRevert?: () => void | Promise<void>;
	occurrenceDate?: string | null;
	occurrenceStartTime?: string | null;
	occurrenceEndTime?: string | null;
	occurrenceParticipantIds?: string[] | null;
	readonlyParticipantIds?: string[];
	canAddParticipants?: boolean;
	lessonType?: { name: string; icon?: string | null; color?: string | null } | null;
}

export function AgendaEventFormDialog({
	open,
	onOpenChange,
	event,
	initialSlot,
	onSuccess,
	onDelete,
	deviationInfo,
	onRevert,
	occurrenceDate,
	occurrenceStartTime,
	occurrenceEndTime,
	occurrenceParticipantIds,
	readonlyParticipantIds = [],
	canAddParticipants = true,
	lessonType,
}: AgendaEventFormDialogProps) {
	const { user } = useAuth();
	const { formState, handlers, saving, hasChanges } = useAgendaEventForm({
		open,
		event,
		initialSlot,
		userId: user?.id,
		occurrenceDate,
		occurrenceStartTime,
		occurrenceEndTime,
		occurrenceParticipantIds,
		readonlyParticipantIds,
		onSuccess,
		onOpenChange,
	});

	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [deleteRecurrenceOpen, setDeleteRecurrenceOpen] = useState(false);
	const [editRecurrenceOpen, setEditRecurrenceOpen] = useState(false);
	const [reverting, setReverting] = useState(false);

	const isManualEvent = event?.source_type === 'manual';
	const isLessonEvent = event?.source_type === 'lesson_agreement';
	const isRecurringEvent = !!event?.recurring;
	const isCancelledEvent = !!deviationInfo?.isCancelled;
	const canDelete = isManualEvent && event?.id && onDelete && !isCancelledEvent;
	const canRevert = !!deviationInfo && !!onRevert;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || !formState.startDate || !formState.startTime) return;
		if (event?.id && isRecurringEvent) {
			setEditRecurrenceOpen(true);
		} else {
			await handlers.performSave('all');
		}
	};

	const handleDeleteClick = () => {
		if (!canDelete || !event?.id) return;
		if (isRecurringEvent) {
			setDeleteRecurrenceOpen(true);
		} else {
			setDeleteConfirmOpen(true);
		}
	};

	const handleDeleteConfirm = async () => {
		if (!canDelete || !event?.id) return;
		await onDelete(event.id, 'all');
		onOpenChange(false);
		onSuccess?.();
	};

	const handleDeleteRecurrenceChoice = async (scope: RecurrenceScope) => {
		if (!canDelete || !event?.id) return;
		await onDelete(event.id, scope, occurrenceDate ?? undefined);
		onOpenChange(false);
		onSuccess?.();
	};

	const handleRevert = async () => {
		if (!canRevert || !onRevert) return;
		setReverting(true);
		try {
			await onRevert();
			onOpenChange(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Terugzetten mislukt');
		} finally {
			setReverting(false);
		}
	};

	const {
		title,
		setTitle,
		description,
		setDescription,
		startDate,
		setStartDate,
		startTime,
		setStartTime,
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
	} = formState;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
				<form onSubmit={handleSubmit} className="space-y-4 pt-2">
					<div className="flex items-center gap-3">
						{isLessonEvent ? (
							<LessonTypeBadge
								lessonType={lessonType ?? { name: '', icon: null, color }}
								size="lg"
								showName={false}
								showTooltip={false}
							/>
						) : (
							<ColorPicker
								value={color || undefined}
								onChange={(hex) => setColor(hex)}
								compact
								disabled={isCancelledEvent}
							/>
						)}
						{isLessonEvent ? (
							<span className="flex-1 text-lg font-medium">{title}</span>
						) : (
							<Input
								id="title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Titel toevoegen"
								disabled={isCancelledEvent}
								className="flex-1 border-0 border-b rounded-none px-0 text-lg font-medium focus-visible:ring-0 focus-visible:border-primary"
								required
								autoFocus={!event}
							/>
						)}
					</div>

					{showDescription ? (
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Omschrijving toevoegen"
							disabled={isCancelledEvent}
							rows={2}
							autoFocus={!description}
						/>
					) : (
						!isCancelledEvent && (
							<button
								type="button"
								onClick={() => setShowDescription(true)}
								className="text-sm text-muted-foreground hover:text-foreground transition-colors"
							>
								+ Omschrijving toevoegen
							</button>
						)
					)}

					<div className="flex flex-wrap items-end gap-2">
						<div className="flex-1 min-w-[140px]">
							<DatePicker
								value={startDate}
								onChange={(date) => {
									setStartDate(date);
									setEndDate(date);
								}}
								disabled={isCancelledEvent}
							/>
						</div>
						{!isAllDay && (
							<>
								<TimeInput
									value={startTime}
									onChange={(e) => setStartTime(e.target.value)}
									disabled={isCancelledEvent}
									className="w-20"
								/>
								<span className="text-muted-foreground pb-2">–</span>
								<TimeInput
									value={endTime}
									onChange={(e) => setEndTime(e.target.value)}
									disabled={isCancelledEvent}
									className="w-20"
								/>
							</>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-4">
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								id="allDay"
								checked={isAllDay}
								onChange={(e) => setIsAllDay(e.target.checked)}
								disabled={isCancelledEvent}
								className="h-4 w-4"
							/>
							<span className="text-sm">Hele dag</span>
						</label>
						<Select
							value={recurring ? recurringFrequency : 'none'}
							onValueChange={(val) => {
								if (val === 'none') {
									setRecurring(false);
								} else {
									setRecurring(true);
									setRecurringFrequency(val as LessonFrequency);
								}
							}}
							disabled={isCancelledEvent}
						>
							<SelectTrigger className="w-[150px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Herhaalt niet</SelectItem>
								{frequencyOptions.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{recurring && (
							<div className="flex items-center gap-2">
								<span className="text-sm text-muted-foreground">tot</span>
								<DatePicker
									value={recurringEndDate}
									onChange={setRecurringEndDate}
									disabled={isCancelledEvent}
								/>
							</div>
						)}
					</div>

					<div>
						{participantIds.some((id) => id !== (event?.owner_user_id ?? user?.id)) && (
							<>
								<Label>Deelnemers</Label>
								<div className="flex flex-wrap gap-2 mt-1 mb-2">
									{participantIds.map((id) => {
										const profile = participantProfiles[id];
										const label = id === user?.id ? 'Jij' : profile ? getDisplayName(profile) : '…';
										const isOwner = id === (event?.owner_user_id ?? user?.id);
										const isReadonly = readonlyParticipantIds.includes(id);
										const isLessonParticipant = isReadonly && !isOwner;
										return (
											<Badge key={id} variant="secondary" className="gap-1">
												{label}
												{isOwner && (
													<span className="text-xs text-muted-foreground">(eigenaar)</span>
												)}
												{isLessonParticipant && (
													<span className="text-xs text-muted-foreground">(les)</span>
												)}
												{!isOwner && !isReadonly && !isCancelledEvent && (
													<button
														type="button"
														className="ml-1 rounded hover:bg-muted"
														onClick={() => handlers.handleRemoveParticipant(id)}
														aria-label="Verwijderen"
													>
														<LuX className="h-3 w-3" />
													</button>
												)}
											</Badge>
										);
									})}
								</div>
							</>
						)}
						{canAddParticipants && (
							<UsersSelect
								value={participantAddId}
								onChange={(id) => {
									if (id) handlers.handleAddParticipant(id);
									setParticipantAddId(null);
								}}
								disabled={isCancelledEvent}
								filter="all"
								excludeUserIds={participantIds}
								placeholder="Deelnemer toevoegen..."
							/>
						)}
					</div>

					{canRevert && deviationInfo && (
						<DeviationInfoBanner
							deviationInfo={deviationInfo}
							onRevert={handleRevert}
							disabled={saving}
							reverting={reverting}
						/>
					)}

					<DialogFooter className={`flex-wrap gap-2 ${canDelete ? 'sm:justify-between' : 'sm:justify-end'}`}>
						{canDelete && (
							<Button
								type="button"
								variant="outline"
								className="text-destructive hover:bg-destructive/10 hover:text-destructive order-last sm:order-none"
								onClick={handleDeleteClick}
								disabled={saving || reverting}
							>
								<LuTrash2 className="h-4 w-4 mr-2" />
								Verwijderen
							</Button>
						)}
						<div className="flex gap-2">
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								{isCancelledEvent ? 'Sluiten' : 'Annuleren'}
							</Button>
							{!isCancelledEvent && (
								<Button type="submit" disabled={saving || reverting || (!!event && !hasChanges)}>
									{saving ? 'Opslaan...' : event ? 'Bijwerken' : 'Aanmaken'}
								</Button>
							)}
						</div>
					</DialogFooter>
				</form>

				<ConfirmDeleteDialog
					open={deleteConfirmOpen}
					onOpenChange={setDeleteConfirmOpen}
					title="Afspraak verwijderen"
					description={
						<>
							<strong>{event?.title}</strong> wilt verwijderen?
							<p className="mt-2 text-muted-foreground">Deze actie kan niet ongedaan worden gemaakt.</p>
						</>
					}
					onConfirm={handleDeleteConfirm}
				/>
				<RecurrenceChoiceDialog
					open={deleteRecurrenceOpen}
					onOpenChange={setDeleteRecurrenceOpen}
					action="delete"
					onChoose={handleDeleteRecurrenceChoice}
				/>
				<RecurrenceChoiceDialog
					open={editRecurrenceOpen}
					onOpenChange={setEditRecurrenceOpen}
					action="edit"
					onChoose={handlers.performSave}
				/>
			</DialogContent>
		</Dialog>
	);
}
