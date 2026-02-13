import { useCallback, useEffect, useState } from 'react';
import { LuLoaderCircle, LuPlus, LuTrash2 } from 'react-icons/lu';
import { Navigate } from 'react-router-dom';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { DAY_NAMES, DEFAULT_END_TIME, DEFAULT_START_TIME, displayTime } from '@/lib/dateHelpers';

type Availability = Tables<'teacher_availability'>;

const dayNames = DAY_NAMES;

export default function MyAvailability() {
	const { isTeacher, teacherId, isLoading: authLoading } = useAuth();
	const [availability, setAvailability] = useState<Availability[]>([]);
	const [loading, setLoading] = useState(true);
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [form, setForm] = useState({
		day_of_week: 1,
		start_time: DEFAULT_START_TIME,
		end_time: DEFAULT_END_TIME,
	});

	const loadAvailability = useCallback(async () => {
		if (!isTeacher || !teacherId) return;

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
	}, [isTeacher, teacherId]);

	useEffect(() => {
		if (!authLoading && isTeacher) {
			loadAvailability();
		}
	}, [authLoading, isTeacher, loadAvailability]);

	// Redirect if not a teacher
	if (!authLoading && !isTeacher) {
		return <Navigate to="/" replace />;
	}

	const handleAdd = async () => {
		if (!teacherId) return;

		if (form.start_time >= form.end_time) {
			toast.error('Eindtijd moet na starttijd zijn');
			return;
		}

		const { error } = await supabase
			.from('teacher_availability')
			.insert({
				teacher_id: teacherId,
				day_of_week: form.day_of_week,
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
		setForm({ day_of_week: 1, start_time: DEFAULT_START_TIME, end_time: DEFAULT_END_TIME });
		loadAvailability();
	};

	const handleDelete = async (id: string) => {
		setDeletingId(id);

		const { error } = await supabase.from('teacher_availability').delete().eq('id', id);

		if (error) {
			console.error('Error deleting availability:', error);
			toast.error('Fout bij verwijderen beschikbaarheid', {
				description: error.message,
			});
			setDeletingId(null);
			return;
		}

		toast.success('Beschikbaarheid verwijderd');
		setDeletingId(null);
		loadAvailability();
	};

	// Group availability by day
	const availabilityByDay: Record<number, Availability[]> = {};
	for (const avail of availability) {
		if (!availabilityByDay[avail.day_of_week]) {
			availabilityByDay[avail.day_of_week] = [];
		}
		availabilityByDay[avail.day_of_week].push(avail);
	}

	if (authLoading || loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LuLoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Mijn Beschikbaarheid</h1>
					<p className="text-muted-foreground">
						Beheer je beschikbare dagen en tijden voor het plannen van lessen
					</p>
				</div>
				<Button onClick={() => setAddDialogOpen(true)}>
					<LuPlus className="mr-2 h-4 w-4" />
					Beschikbaarheid toevoegen
				</Button>
			</div>

			{/* Availability Calendar */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{dayNames.map((dayName, dayIndex) => {
					const dayAvailability = availabilityByDay[dayIndex] || [];
					return (
						<Card key={dayName}>
							<CardHeader>
								<CardTitle>{dayName}</CardTitle>
								<CardDescription>
									{dayAvailability.length} beschikbaarheidsblok
									{dayAvailability.length !== 1 ? 'ken' : ''}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{dayAvailability.length === 0 ? (
									<p className="text-sm text-muted-foreground">Geen beschikbaarheid</p>
								) : (
									<div className="space-y-2">
										{dayAvailability.map((avail) => (
											<div
												key={avail.id}
												className="flex items-center justify-between rounded-md border bg-muted/50 p-2 text-sm"
											>
												<div className="font-medium">
													{displayTime(avail.start_time)} - {displayTime(avail.end_time)}
												</div>
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 text-destructive hover:text-destructive"
													onClick={() => handleDelete(avail.id)}
													disabled={deletingId === avail.id}
												>
													{deletingId === avail.id ? (
														<LuLoaderCircle className="h-3 w-3 animate-spin" />
													) : (
														<LuTrash2 className="h-3 w-3" />
													)}
												</Button>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* Add Availability Dialog */}
			<Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Beschikbaarheid toevoegen</DialogTitle>
						<DialogDescription>
							Voeg een nieuw beschikbaarheidsblok toe voor een specifieke dag
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="day">Dag</Label>
							<Select
								value={String(form.day_of_week)}
								onValueChange={(value) => setForm({ ...form, day_of_week: Number.parseInt(value, 10) })}
							>
								<SelectTrigger id="day">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{dayNames.map((dayName, index) => (
										<SelectItem key={dayName} value={String(index)}>
											{dayName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="start-time">Starttijd</Label>
								<Input
									id="start-time"
									type="time"
									value={form.start_time}
									onChange={(e) => setForm({ ...form, start_time: e.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="end-time">Eindtijd</Label>
								<Input
									id="end-time"
									type="time"
									value={form.end_time}
									onChange={(e) => setForm({ ...form, end_time: e.target.value })}
								/>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAddDialogOpen(false)}>
							Annuleren
						</Button>
						<Button onClick={handleAdd}>Toevoegen</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
