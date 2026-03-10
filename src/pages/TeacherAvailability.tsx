import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DAY_NAMES } from '@/lib/date/day-index';
import { formatTime } from '@/lib/time/time-format';

interface Teacher {
	user_id: string;
	profile: {
		first_name: string | null;
		last_name: string | null;
		email: string;
	};
}

interface Availability {
	id: string;
	teacher_user_id: string;
	day_of_week: number;
	start_time: string;
	end_time: string;
}

const dayNames = DAY_NAMES;

export default function TeacherAvailability() {
	const { isPrivileged, isLoading: authLoading } = useAuth();
	const [teachers, setTeachers] = useState<Teacher[]>([]);
	const [availability, setAvailability] = useState<Availability[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedTeacherUserId, setSelectedTeacherUserId] = useState<string | 'all'>('all');

	// Check access - staff, admin and site_admin can view this page
	const hasAccess = isPrivileged;

	const loadData = useCallback(async () => {
		if (!hasAccess) return;

		setLoading(true);

		// Load teachers
		const { data: teachersData, error: teachersError } = await supabase
			.from('teachers')
			.select('user_id')
			.eq('is_active', true)
			.order('created_at', { ascending: false });

		if (teachersError) {
			console.error('Error loading teachers:', teachersError);
			toast.error('Fout bij laden docenten');
			setLoading(false);
			return;
		}

		if (!teachersData || teachersData.length === 0) {
			setTeachers([]);
			setLoading(false);
			return;
		}

		// Load profiles for teachers
		const userIds = teachersData.map((t) => t.user_id);
		const { data: profilesData, error: profilesError } = await supabase
			.from('profiles')
			.select('user_id, first_name, last_name, email')
			.in('user_id', userIds);

		if (profilesError) {
			console.error('Error loading profiles:', profilesError);
			toast.error('Fout bij laden profielen');
			setLoading(false);
			return;
		}

		// Combine the data
		const profileMap = new Map(profilesData?.map((p) => [p.user_id, p]) ?? []);
		const transformedTeachers: Teacher[] = teachersData.map((teacher) => ({
			user_id: teacher.user_id,
			profile: profileMap.get(teacher.user_id) ?? {
				first_name: null,
				last_name: null,
				email: '',
			},
		}));
		setTeachers(transformedTeachers);

		// Load availability
		const { data: availabilityData, error: availabilityError } = await supabase
			.from('teacher_availability')
			.select('*')
			.order('day_of_week', { ascending: true })
			.order('start_time', { ascending: true });

		if (availabilityError) {
			console.error('Error loading availability:', availabilityError);
			toast.error('Fout bij laden beschikbaarheid');
			setLoading(false);
			return;
		}

		setAvailability((availabilityData as Availability[]) ?? []);
		setLoading(false);
	}, [hasAccess]);

	useEffect(() => {
		if (!authLoading) {
			loadData();
		}
	}, [authLoading, loadData]);

	const getTeacherName = (teacher: Teacher) => {
		if (teacher.profile.first_name && teacher.profile.last_name) {
			return `${teacher.profile.first_name} ${teacher.profile.last_name}`;
		}
		if (teacher.profile.first_name) {
			return teacher.profile.first_name;
		}
		return teacher.profile.email;
	};

	const filteredAvailability =
		selectedTeacherUserId === 'all'
			? availability
			: availability.filter((a) => a.teacher_user_id === selectedTeacherUserId);

	// Group availability by day
	const availabilityByDay: Record<number, Availability[]> = {};
	for (const avail of filteredAvailability) {
		if (!availabilityByDay[avail.day_of_week]) {
			availabilityByDay[avail.day_of_week] = [];
		}
		availabilityByDay[avail.day_of_week].push(avail);
	}

	// Redirect if no access
	if (!hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Docent Beschikbaarheid</h1>
				<p className="text-muted-foreground">Overzicht van beschikbare tijden voor alle docenten</p>
			</div>

			{loading ? (
				<PageSkeleton variant="header-and-cards" />
			) : (
				<>
					{/* Filter */}
					<div className="flex items-center gap-2">
						<Button
							variant={selectedTeacherUserId === 'all' ? 'default' : 'outline'}
							size="sm"
							onClick={() => setSelectedTeacherUserId('all')}
						>
							Alle docenten
						</Button>
						{teachers.map((teacher) => (
							<Button
								key={teacher.user_id}
								variant={selectedTeacherUserId === teacher.user_id ? 'default' : 'outline'}
								size="sm"
								onClick={() => setSelectedTeacherUserId(teacher.user_id)}
							>
								{getTeacherName(teacher)}
							</Button>
						))}
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
												{dayAvailability.map((avail) => {
													const teacher = teachers.find(
														(t) => t.user_id === avail.teacher_user_id,
													);
													return (
														<div
															key={avail.id}
															className="rounded-md border bg-muted/50 p-2 text-sm"
														>
															<div className="font-medium">
																{formatTime(avail.start_time)} -{' '}
																{formatTime(avail.end_time)}
															</div>
															{selectedTeacherUserId === 'all' && teacher && (
																<div className="text-xs text-muted-foreground">
																	{getTeacherName(teacher)}
																</div>
															)}
														</div>
													);
												})}
											</div>
										)}
									</CardContent>
								</Card>
							);
						})}
					</div>
				</>
			)}
		</div>
	);
}
