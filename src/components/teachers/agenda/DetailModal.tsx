import { LuBan, LuLoaderCircle, LuTriangleAlert, LuUndo2 } from 'react-icons/lu';
import { StudentInfoCard } from '@/components/students/StudentInfoCard';
import { Button } from '@/components/ui/button';
import { ColorIcon } from '@/components/ui/color-icon';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { resolveIconFromList } from '@/components/ui/icon-picker';
import { MUSIC_ICONS } from '@/constants/icons';
import { displayTime, formatDate } from '@/lib/dateHelpers';
import type { StudentInfoModalData } from '@/types/students';
import type { CalendarEvent } from './types';

interface DetailModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	event: CalendarEvent | null;
	canEdit: boolean;
	isCancelling: boolean;
	isReverting: boolean;
	onCancelLesson: () => void;
	onRevertToOriginal: () => void;
	onRevertRecurringAll?: () => void;
	onOpenCancelConfirm: () => void;
	onOpenStudentInfo: (student: StudentInfoModalData) => void;
}

export function DetailModal({
	open,
	onOpenChange,
	event: selectedEvent,
	canEdit,
	isCancelling,
	isReverting,
	onCancelLesson,
	onRevertToOriginal,
	onRevertRecurringAll,
	onOpenCancelConfirm,
	onOpenStudentInfo,
}: DetailModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<div className="flex items-center gap-3">
						<ColorIcon
							icon={
								selectedEvent?.resource.lessonTypeIcon
									? resolveIconFromList(MUSIC_ICONS, selectedEvent.resource.lessonTypeIcon)
									: undefined
							}
							color={selectedEvent?.resource.lessonTypeColor ?? null}
							size="lg"
						/>
						<div>
							<DialogTitle>{selectedEvent?.resource.lessonTypeName}</DialogTitle>
							{selectedEvent?.resource.isGroupLesson && (
								<DialogDescription>
									Groepsles met {selectedEvent?.resource.studentCount} deelnemers
								</DialogDescription>
							)}
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4">
					{selectedEvent?.resource.studentInfo && !selectedEvent.resource.isGroupLesson && (
						<StudentInfoCard
							student={{
								id: selectedEvent.resource.agreementId,
								user_id: selectedEvent.resource.studentInfo.user_id,
								profile: {
									email: selectedEvent.resource.studentInfo.email,
									first_name: selectedEvent.resource.studentInfo.first_name,
									last_name: selectedEvent.resource.studentInfo.last_name,
									avatar_url: selectedEvent.resource.studentInfo.avatar_url,
								},
							}}
							onClick={() => {
								const info = selectedEvent.resource.studentInfo;
								if (!info) return;
								onOpenStudentInfo({
									id: selectedEvent.resource.agreementId,
									user_id: info.user_id,
									profile: {
										email: info.email,
										first_name: info.first_name,
										last_name: info.last_name,
										avatar_url: info.avatar_url,
										phone_number: null,
									},
								});
							}}
						/>
					)}

					{selectedEvent?.resource.isGroupLesson && selectedEvent.resource.studentInfoList && (
						<div className="space-y-2">
							<h4 className="text-sm font-medium">Deelnemers</h4>
							<div className="space-y-2 max-h-48 overflow-y-auto">
								{selectedEvent.resource.studentInfoList.map((student) => (
									<StudentInfoCard
										key={student.user_id}
										student={{
											id: selectedEvent.resource.agreementId,
											user_id: student.user_id,
											profile: {
												email: student.email,
												first_name: student.first_name,
												last_name: student.last_name,
												avatar_url: student.avatar_url,
											},
										}}
										onClick={() =>
											onOpenStudentInfo({
												id: selectedEvent.resource.agreementId,
												user_id: student.user_id,
												profile: {
													email: student.email,
													first_name: student.first_name,
													last_name: student.last_name,
													avatar_url: student.avatar_url,
													phone_number: null,
												},
											})
										}
										className="py-2"
									/>
								))}
							</div>
						</div>
					)}

					{selectedEvent?.resource.isGroupLesson && !selectedEvent.resource.studentInfoList && (
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

					<div className="rounded-lg bg-muted p-4 space-y-2">
						<div className="flex justify-between">
							<span className="text-sm text-muted-foreground">Datum</span>
							<span className="font-medium">
								{selectedEvent?.start
									? formatDate(new Date(selectedEvent.start).toISOString().split('T')[0])
									: ''}
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
										Origineel: {formatDate(selectedEvent.resource.originalDate)} om{' '}
										{displayTime(selectedEvent.resource.originalStartTime)}
									</p>
								)}
								{selectedEvent.resource.reason && (
									<p className="text-xs">Reden: {selectedEvent.resource.reason}</p>
								)}
							</div>
							{canEdit && selectedEvent.resource.deviationId && (
								<div className="flex shrink-0 flex-col gap-2">
									{selectedEvent.resource.isRecurring && onRevertRecurringAll && (
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

				{canEdit && !selectedEvent?.resource.isGroupLesson && (
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
