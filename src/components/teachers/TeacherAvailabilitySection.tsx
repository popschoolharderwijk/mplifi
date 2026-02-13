import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuLoaderCircle, LuPencil } from 'react-icons/lu';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import {
	AVAILABILITY_SETTINGS,
	DAY_NAMES_DISPLAY,
	DEFAULT_END_TIME,
	DEFAULT_START_TIME,
	displayDayToDbDay,
	displayTime,
	generateAvailabilityTimeSlots,
} from '@/lib/dateHelpers';

type Availability = Tables<'teacher_availability'>;

interface AvailabilityBlock {
	id: string;
	displayDay: number;
	startTime: string;
	endTime: string;
	topPercent: number;
	heightPercent: number;
}

interface TeacherAvailabilitySectionProps {
	teacherId: string;
	canEdit: boolean;
}

const dayNames = DAY_NAMES_DISPLAY;
const TIME_SLOTS = generateAvailabilityTimeSlots();
const HOURS = Array.from(
	{ length: AVAILABILITY_SETTINGS.END_HOUR - AVAILABILITY_SETTINGS.START_HOUR + 1 },
	(_, i) => AVAILABILITY_SETTINGS.START_HOUR + i,
);

export function TeacherAvailabilitySection({ teacherId, canEdit }: TeacherAvailabilitySectionProps) {
	const [availability, setAvailability] = useState<Availability[]>([]);
	const [loading, setLoading] = useState(true);
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [selectedSlot, setSelectedSlot] = useState<{ day: number; time: string } | null>(null);
	const [editingBlock, setEditingBlock] = useState<AvailabilityBlock | null>(null);
	const [form, setForm] = useState({
		start_time: DEFAULT_START_TIME,
		end_time: DEFAULT_END_TIME,
	});

	const loadAvailability = useCallback(async () => {
		if (!teacherId) return;

		setLoading(true);

		const { data, error } = await supabase
			.from('teacher_availability')
			.select('*')
			.eq('teacher_id', teacherId)
			.order('day_of_week', { ascending: true })
			.order('start_time', { ascending: true });

		if (error) {
			console.error('Error loading availability:', error);
			toast.error('Fout bij laden beschikbaarheid');
			setLoading(false);
			return;
		}

		setAvailability((data as Availability[]) ?? []);
		setLoading(false);
	}, [teacherId]);

	useEffect(() => {
		loadAvailability();
	}, [loadAvailability]);

	const handleAdd = async () => {
		if (!teacherId || !selectedSlot) return;

		if (form.start_time >= form.end_time) {
			toast.error('Eindtijd moet na starttijd zijn');
			return;
		}

		// Convert display day to database day
		const dbDay = displayDayToDbDay(selectedSlot.day);

		const { error } = await supabase
			.from('teacher_availability')
			.insert({
				teacher_id: teacherId,
				day_of_week: dbDay,
				start_time: form.start_time,
				end_time: form.end_time,
			})
			.select()
			.single();

		if (error) {
			console.error('Error adding availability:', error);
			toast.error('Fout bij toevoegen beschikbaarheid', {
				description: error.message,
			});
			return;
		}

		toast.success('Beschikbaarheid toegevoegd');
		setAddDialogOpen(false);
		setSelectedSlot(null);
		setEditingBlock(null);
		setForm({ start_time: DEFAULT_START_TIME, end_time: DEFAULT_END_TIME });
		loadAvailability();
	};

	const handleUpdate = async () => {
		if (!editingBlock) return;
		if (form.start_time >= form.end_time) {
			toast.error('Eindtijd moet na starttijd zijn');
			return;
		}

		const { error } = await supabase
			.from('teacher_availability')
			.update({ start_time: form.start_time, end_time: form.end_time })
			.eq('id', editingBlock.id);

		if (error) {
			console.error('Error updating availability:', error);
			toast.error('Fout bij wijzigen beschikbaarheid', {
				description: error.message,
			});
			return;
		}

		toast.success('Beschikbaarheid bijgewerkt');
		setAddDialogOpen(false);
		setEditingBlock(null);
		setForm({ start_time: DEFAULT_START_TIME, end_time: DEFAULT_END_TIME });
		loadAvailability();
	};

	const handleDelete = async (id: string) => {
		const { error } = await supabase.from('teacher_availability').delete().eq('id', id);

		if (error) {
			console.error('Error deleting availability:', error);
			toast.error('Fout bij verwijderen beschikbaarheid', {
				description: error.message,
			});
			return;
		}

		toast.success('Beschikbaarheid verwijderd');
		setAddDialogOpen(false);
		setEditingBlock(null);
		loadAvailability();
	};

	// Helper to get next time slot
	const getNextTimeSlot = (time: string, slots = 1): string => {
		const index = TIME_SLOTS.indexOf(time);
		if (index === -1 || index + slots >= TIME_SLOTS.length) {
			return TIME_SLOTS[TIME_SLOTS.length - 1];
		}
		return TIME_SLOTS[index + slots];
	};

	// Calculate availability blocks with positioning
	const availabilityBlocks = useMemo((): AvailabilityBlock[] => {
		const totalMinutes = (AVAILABILITY_SETTINGS.END_HOUR - AVAILABILITY_SETTINGS.START_HOUR) * 60;

		return availability.map((a) => {
			// Convert db day to display day
			const displayDay = a.day_of_week === 0 ? 6 : a.day_of_week - 1;

			// Parse times
			const [startHour, startMin] = a.start_time.split(':').map(Number);
			const [endHour, endMin] = a.end_time.split(':').map(Number);

			// Calculate positions
			const startMinutes = (startHour - AVAILABILITY_SETTINGS.START_HOUR) * 60 + startMin;
			const endMinutes = (endHour - AVAILABILITY_SETTINGS.START_HOUR) * 60 + endMin;

			const topPercent = (startMinutes / totalMinutes) * 100;
			const heightPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;

			return {
				id: a.id,
				displayDay,
				startTime: a.start_time,
				endTime: a.end_time,
				topPercent: Math.max(0, topPercent),
				heightPercent: Math.min(100 - topPercent, heightPercent),
			};
		});
	}, [availability]);

	// Get blocks for a specific day
	const getBlocksForDay = (displayDay: number): AvailabilityBlock[] => {
		return availabilityBlocks.filter((b) => b.displayDay === displayDay);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LuLoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<>
			<style>{`
				.availability-block { container-type: size; container-name: ab; }
				.availability-block .block-content-single { display: flex; }
				.availability-block .block-content-double { display: none; }
				.availability-block .block-edit-icon { display: none; }
				.availability-block .block-edit-icon-small { display: block; }
				@container ab (min-height: 2.5rem) {
					.availability-block .block-content-single { display: none; }
					.availability-block .block-content-double { display: flex; }
				}
				@container ab (min-height: 1.5rem) {
					.availability-block .block-edit-icon { display: block; }
					.availability-block .block-edit-icon-small { display: none; }
				}
			`}</style>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle>Beschikbaarheid</CardTitle>
					<CardDescription>
						{canEdit
							? 'Klik op lege cel om toe te voegen, op tijdslot om te wijzigen'
							: 'Beschikbare tijdsloten'}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{/* Day headers */}
					<div className="flex border-b border-border pb-2 mb-1">
						<div className="w-12 shrink-0" />
						{dayNames.map((dayName) => (
							<div key={dayName} className="flex-1 text-center text-xs font-semibold text-foreground">
								{dayName.substring(0, 2)}
							</div>
						))}
					</div>

					{/* Grid container – responsive height so availability block does not stay too large */}
					<div className="flex h-64 sm:h-72 lg:h-80">
						{/* Time labels column */}
						<div className="w-12 shrink-0 relative">
							{HOURS.map((hour) => (
								<div
									key={hour}
									className="absolute left-0 right-0 text-xs text-muted-foreground leading-none"
									style={{
										top: `${((hour - AVAILABILITY_SETTINGS.START_HOUR) / (AVAILABILITY_SETTINGS.END_HOUR - AVAILABILITY_SETTINGS.START_HOUR)) * 100}%`,
										transform: 'translateY(-50%)',
									}}
								>
									{hour}:00
								</div>
							))}
						</div>

						{/* Day columns */}
						{dayNames.map((dayName, dayIndex) => {
							const blocks = getBlocksForDay(dayIndex);

							return (
								<div key={dayName} className="flex-1 relative border-l border-border/50">
									{/* Hour lines */}
									{HOURS.map((hour) => (
										<div
											key={hour}
											className="absolute left-0 right-0 border-t border-border/40"
											style={{
												top: `${((hour - AVAILABILITY_SETTINGS.START_HOUR) / (AVAILABILITY_SETTINGS.END_HOUR - AVAILABILITY_SETTINGS.START_HOUR)) * 100}%`,
											}}
										/>
									))}

									{/* Time slot cells (30 min intervals, exclude last slot as it can't be a start time) */}
									{canEdit &&
										TIME_SLOTS.slice(0, -1).map((time) => {
											const totalMinutes =
												(AVAILABILITY_SETTINGS.END_HOUR - AVAILABILITY_SETTINGS.START_HOUR) *
												60;
											const [hour, minute] = time.split(':').map(Number);
											const minutesFromStart =
												(hour - AVAILABILITY_SETTINGS.START_HOUR) * 60 + minute;
											const topPercent = (minutesFromStart / totalMinutes) * 100;
											const heightPercent = (30 / totalMinutes) * 100;

											// Check if this slot is covered by an availability block
											const existingBlock = blocks.find(
												(b) => b.startTime <= time && b.endTime > time,
											);

											// Skip rendering clickable cell if covered by availability block
											if (existingBlock) return null;

											return (
												<button
													type="button"
													key={`${dayIndex}-${time}`}
													className="absolute left-0 right-0 hover:bg-primary/20 transition-colors border border-transparent hover:border-primary/40"
													style={{
														top: `${topPercent}%`,
														height: `${heightPercent}%`,
													}}
													onClick={() => {
														setSelectedSlot({ day: dayIndex, time });
														setForm({
															start_time: time,
															end_time: getNextTimeSlot(time, 2),
														});
														setAddDialogOpen(true);
													}}
													title={`${dayName} ${time} - Klik om beschikbaarheid toe te voegen`}
												/>
											);
										})}

									{/* Availability blocks */}
									{blocks.map((block) => (
										<button
											type="button"
											key={block.id}
											className="availability-block absolute left-0.5 right-0.5 bg-emerald-500/80 hover:bg-emerald-500 rounded-md shadow-sm transition-all cursor-pointer group border border-emerald-600/30 focus:outline-none focus:ring-2 focus:ring-white/50 z-10"
											style={{
												top: `${block.topPercent}%`,
												height: `${block.heightPercent}%`,
												minHeight: '10px',
											}}
											onClick={(e) => {
												e.stopPropagation();
												if (canEdit) {
													setEditingBlock(block);
													setSelectedSlot({ day: block.displayDay, time: block.startTime });
													setForm({
														start_time: displayTime(block.startTime),
														end_time: displayTime(block.endTime),
													});
													setAddDialogOpen(true);
												}
											}}
											title={`${dayName} ${displayTime(block.startTime)} - ${displayTime(block.endTime)}`}
										>
											{/* Single line: smaller font; two lines: normal font (container query) */}
											<div
												className="block-content-single absolute inset-0 flex items-center justify-center p-0.5 overflow-hidden min-w-0"
												title={`${displayTime(block.startTime)} - ${displayTime(block.endTime)}`}
											>
												<span className="text-[10px] font-medium leading-tight text-white truncate max-w-full">
													{displayTime(block.startTime)} – {displayTime(block.endTime)}
												</span>
											</div>
											<div
												className="block-content-double absolute inset-0 flex flex-col items-center justify-center gap-0 p-0.5 overflow-hidden text-center min-w-0"
												title={`${displayTime(block.startTime)} - ${displayTime(block.endTime)}`}
											>
												<span className="text-[12px] font-medium leading-tight text-white truncate max-w-full">
													{displayTime(block.startTime)} – {displayTime(block.endTime)}
												</span>
											</div>

											{/* Orange overlay on hover; small icon for single-line blocks, normal icon for taller blocks */}
											{canEdit && (
												<div className="absolute inset-0 flex items-center justify-center bg-primary/90 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
													<span className="block-edit-icon-small">
														<LuPencil className="h-2.5 w-2.5 text-white" />
													</span>
													<span className="block-edit-icon">
														<LuPencil className="h-4 w-4 text-white" />
													</span>
												</div>
											)}
										</button>
									))}
								</div>
							);
						})}
					</div>

					{/* Legend */}
					<div className="mt-3 pt-3 border-t border-border flex items-center gap-3 text-xs text-muted-foreground">
						<div className="flex items-center gap-1.5">
							<div className="h-3 w-5 bg-emerald-500/80 rounded-sm" />
							<span>Beschikbaar</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Add Availability Dialog */}
			{canEdit && (
				<Dialog
					open={addDialogOpen}
					onOpenChange={(open) => {
						setAddDialogOpen(open);
						if (!open) {
							setSelectedSlot(null);
							setEditingBlock(null);
						}
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>{editingBlock ? 'Tijdslot wijzigen' : 'Nieuw tijdslot toevoegen'}</DialogTitle>
							<DialogDescription>
								{selectedSlot &&
									(editingBlock ? (
										<>
											Wijzig beschikbaarheid voor <strong>{dayNames[selectedSlot.day]}</strong>
										</>
									) : (
										<>
											Voeg beschikbaarheid toe voor <strong>{dayNames[selectedSlot.day]}</strong>{' '}
											vanaf <strong>{displayTime(selectedSlot.time)}</strong>
										</>
									))}
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Starttijd</Label>
									<Select
										value={form.start_time}
										onValueChange={(value) => setForm({ ...form, start_time: value })}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{TIME_SLOTS.slice(0, -1).map((time) => (
												<SelectItem key={time} value={time}>
													{time}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Eindtijd</Label>
									<Select
										value={form.end_time}
										onValueChange={(value) => setForm({ ...form, end_time: value })}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{TIME_SLOTS.filter((time) => time > form.start_time).map((time) => (
												<SelectItem key={time} value={time}>
													{time}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							{editingBlock && (
								<Button
									variant="destructive"
									className="w-full"
									onClick={() => handleDelete(editingBlock.id)}
								>
									Verwijder tijdslot
								</Button>
							)}
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => {
									setAddDialogOpen(false);
									setSelectedSlot(null);
									setEditingBlock(null);
								}}
							>
								Annuleren
							</Button>
							{editingBlock ? (
								<Button onClick={handleUpdate}>Opslaan</Button>
							) : (
								<Button onClick={handleAdd}>Toevoegen</Button>
							)}
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</>
	);
}
