import { LuBan, LuLoaderCircle, LuPencil, LuTrash2, LuTriangleAlert, LuUndo2 } from 'react-icons/lu';
import { StudentInfoCard } from '@/components/students/StudentInfoCard';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { LessonTypeBadge } from '@/components/ui/lesson-type-badge';
import { formatDateLong, formatDbDateLong } from '@/lib/date/date-format';
import { formatTime } from '@/lib/time/time-format';
import type { User } from '@/types/users';
import type { CalendarEvent } from './types';

interface DetailModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	event: CalendarEvent | null;
	canEdit: boolean;
	isCancelling?: boolean;
	isReverting?: boolean;
	onCancelLesson?: () => void;
	onRevertToOriginal?: () => void;
	onRevertRecurringAll?: () => void;
	onOpenCancelConfirm?: () => void;
	onOpenStudentInfo?: (student: User) => void;
	/** For agenda (manual) events: edit opens form */
	onEditAgenda?: (eventId: string) => void;
	/** For agenda (manual) events: delete and close */
	onDeleteAgenda?: (eventId: string) => void;
}

export function DetailModal({
	open,
	onOpenChange,
	event: selectedEvent,
	canEdit,
	isCancelling = false,
	isReverting = false,
	onCancelLesson,
	onRevertToOriginal,
	onRevertRecurringAll,
	onOpenCancelConfirm,
	onOpenStudentInfo,
	onEditAgenda,
	onDeleteAgenda,
}: DetailModalProps) {
	const isAgendaEvent = selectedEvent?.resource.type === 'agenda';
	const isLessonEvent =
		selectedEvent?.resource.type !== 'agenda' || selectedEvent?.resource.sourceType === 'lesson_agreement';
	const isManualAgendaEvent = isAgendaEvent && selectedEvent?.resource.sourceType === 'manual';
	const eventId = selectedEvent?.resource.eventId;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<div className="flex items-center gap-3">
						{isLessonEvent && (
							<LessonTypeBadge
								lessonType={{
									name: selectedEvent?.resource.lessonTypeName ?? '',
									icon: selectedEvent?.resource.lessonTypeIcon,
									color: selectedEvent?.resource.lessonTypeColor,
								}}
								size="lg"
								showName={false}
							/>
						)}
						<div>
							<DialogTitle>
								{isLessonEvent ? selectedEvent?.resource.lessonTypeName : selectedEvent?.title}
							</DialogTitle>
							{isLessonEvent && selectedEvent?.resource.isGroupLesson && (
								<DialogDescription>
									Groepsles met {selectedEvent?.resource.studentCount} deelnemers
								</DialogDescription>
							)}
							{isManualAgendaEvent && selectedEvent?.resource.participantCount !== undefined && (
								<DialogDescription>
									{selectedEvent.resource.participantCount} participant(s)
								</DialogDescription>
							)}
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4">
					{isManualAgendaEvent && (
						<div className="rounded-lg bg-muted p-4 space-y-2">
							<div className="flex justify-between">
								<span className="text-sm text-muted-foreground">Datum</span>
								<span className="font-medium">
									{selectedEvent?.start ? formatDateLong(selectedEvent.start) : ''}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-sm text-muted-foreground">Tijd</span>
								<span className="font-medium">
									{selectedEvent?.start
										? `${String(new Date(selectedEvent.start).getHours()).padStart(2, '0')}:${String(new Date(selectedEvent.start).getMinutes()).padStart(2, '0')}`
										: ''}
									{' - '}
									{selectedEvent?.end
										? `${String(new Date(selectedEvent.end).getHours()).padStart(2, '0')}:${String(new Date(selectedEvent.end).getMinutes()).padStart(2, '0')}`
										: ''}
								</span>
							</div>
						</div>
					)}

					{isLessonEvent && selectedEvent?.resource.user && !selectedEvent.resource.isGroupLesson && (
						<StudentInfoCard
							student={selectedEvent.resource.user}
							onClick={() => {
								const user = selectedEvent.resource.user;
								if (!user || !onOpenStudentInfo) return;
								onOpenStudentInfo(user);
							}}
						/>
					)}

					{isLessonEvent && selectedEvent?.resource.isGroupLesson && selectedEvent.resource.users && (
						<div className="space-y-2">
							<h4 className="text-sm font-medium">Deelnemers</h4>
							<div className="space-y-2 max-h-48 overflow-y-auto">
								{selectedEvent.resource.users.map((user) => (
									<StudentInfoCard
										key={user.user_id}
										student={user}
										onClick={() => onOpenStudentInfo?.(user)}
										className="py-2"
									/>
								))}
							</div>
						</div>
					)}

					{isLessonEvent && selectedEvent?.resource.isGroupLesson && !selectedEvent.resource.users && (
						<div className="space-y-2">
							<h4 className="text-sm font-medium">Deelnemers</h4>
							<ul className="space-y-1">
								{selectedEvent.resource.studentName.split(', ').map((name) => (
									<li key={name} className="text-sm text-muted-foreground">
										• {name}
									</li>
								))}
							</ul>
						</div>
					)}

					{isLessonEvent && (
						<div className="rounded-lg bg-muted p-4 space-y-2">
							<div className="flex justify-between">
								<span className="text-sm text-muted-foreground">Datum</span>
								<span className="font-medium">
									{selectedEvent?.start ? formatDateLong(selectedEvent.start) : ''}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-sm text-muted-foreground">Tijd</span>
								<span className="font-medium">
									{selectedEvent?.start
										? `${String(new Date(selectedEvent.start).getHours()).padStart(2, '0')}:${String(new Date(selectedEvent.start).getMinutes()).padStart(2, '0')}`
										: ''}
									{' - '}
									{selectedEvent?.end
										? `${String(new Date(selectedEvent.end).getHours()).padStart(2, '0')}:${String(new Date(selectedEvent.end).getMinutes()).padStart(2, '0')}`
										: ''}
								</span>
							</div>
						</div>
					)}

					{selectedEvent?.resource.isCancelled && (
						<div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-red-600">
							<LuBan className="h-4 w-4" />
							<span className="text-sm font-medium">Deze les is geannuleerd</span>
						</div>
					)}

					{selectedEvent?.resource.isDeviation && !selectedEvent?.resource.isCancelled && (
						<div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-5 text-amber-600">
							<LuTriangleAlert className="h-4 w-4 shrink-0" />
							<div className="min-w-0 flex-1 space-y-0.5">
								<span className="text-sm font-medium">
									{selectedEvent.resource.isRecurring ? 'Afwijkende reeks' : 'Afwijkende afspraak'}
								</span>
								{selectedEvent.resource.originalDate && selectedEvent.resource.originalStartTime && (
									<p className="text-xs">
										Origineel: {formatDbDateLong(selectedEvent.resource.originalDate)} om{' '}
										{formatTime(selectedEvent.resource.originalStartTime)}
									</p>
								)}
								{selectedEvent.resource.reason && (
									<p className="text-xs">Reden: {selectedEvent.resource.reason}</p>
								)}
							</div>
							{canEdit && selectedEvent.resource.deviationId && (
								<div className="flex shrink-0 flex-col gap-2">
									{selectedEvent.resource.isRecurring && onRevertRecurringAll != null && (
										<Button
											variant="outline"
											size="sm"
											className="border-amber-500/50 bg-amber-500/5 text-amber-700 hover:bg-amber-500/15 hover:text-amber-800"
											onClick={onRevertRecurringAll}
											disabled={isReverting}
										>
											{isReverting ? (
												<>
													<LuLoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
													Bezig...
												</>
											) : (
												'Herstel alle volgende'
											)}
										</Button>
									)}
									{!selectedEvent.resource.isRecurring &&
										selectedEvent.resource.originalDate &&
										selectedEvent.resource.originalStartTime && (
											<Button
												variant="outline"
												size="sm"
												className="border-amber-500/50 bg-amber-500/5 text-amber-700 hover:bg-amber-500/15 hover:text-amber-800"
												onClick={onRevertToOriginal}
												disabled={isReverting}
											>
												{isReverting ? (
													<>
														<LuLoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
														Bezig...
													</>
												) : (
													<>
														<LuUndo2 className="mr-1.5 h-3.5 w-3.5" />
														Terugzetten
													</>
												)}
											</Button>
										)}
								</div>
							)}
						</div>
					)}
				</div>

				{isManualAgendaEvent && canEdit && eventId && (onEditAgenda || onDeleteAgenda) && (
					<DialogFooter>
						{onEditAgenda && (
							<Button variant="outline" onClick={() => onEditAgenda(eventId)}>
								<LuPencil className="mr-2 h-4 w-4" />
								Edit
							</Button>
						)}
						{onDeleteAgenda && (
							<Button variant="destructive" onClick={() => onDeleteAgenda(eventId)}>
								<LuTrash2 className="mr-2 h-4 w-4" />
								Delete
							</Button>
						)}
					</DialogFooter>
				)}

				{isLessonEvent &&
					canEdit &&
					!selectedEvent?.resource.isGroupLesson &&
					onCancelLesson != null &&
					onOpenCancelConfirm != null && (
						<DialogFooter>
							{selectedEvent?.resource.isCancelled ? (
								<Button onClick={onCancelLesson} disabled={isCancelling}>
									{isCancelling ? (
										<>
											<LuLoaderCircle className="mr-2 h-4 w-4 animate-spin" />
											Bezig...
										</>
									) : (
										'Les herstellen'
									)}
								</Button>
							) : (
								<Button variant="destructive" onClick={onOpenCancelConfirm} disabled={isCancelling}>
									{isCancelling ? (
										<>
											<LuLoaderCircle className="mr-2 h-4 w-4 animate-spin" />
											Bezig...
										</>
									) : (
										'Les annuleren'
									)}
								</Button>
							)}
						</DialogFooter>
					)}
			</DialogContent>
		</Dialog>
	);
}
