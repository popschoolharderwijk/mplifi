import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Statistics {
	studentCount: number;
	lessonsPerWeek: number;
	groupLessons: number;
	upcomingLessons: number;
}

export default function MyStatistics() {
	const { isTeacher, teacherUserId, isLoading: authLoading } = useAuth();
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState<Statistics>({
		studentCount: 0,
		lessonsPerWeek: 0,
		groupLessons: 0,
		upcomingLessons: 0,
	});

	const loadStatistics = useCallback(async () => {
		if (!isTeacher || !teacherUserId) return;

		setLoading(true);

		// Get active lesson agreements for this teacher
		const { data: agreements, error: agreementsError } = await supabase
			.from('lesson_agreements')
			.select('student_user_id, lesson_type_id, is_active, lesson_types!inner(is_group_lesson)')
			.eq('teacher_user_id', teacherUserId)
			.eq('is_active', true);

		if (agreementsError) {
			console.error('Error loading agreements:', agreementsError);
			toast.error('Fout bij laden statistieken');
			setLoading(false);
			return;
		}

		// Calculate statistics
		const uniqueStudents = new Set(agreements?.map((a) => a.student_user_id) || []);
		const groupLessons =
			agreements?.filter((a) =>
				Array.isArray(a.lesson_types)
					? a.lesson_types[0]?.is_group_lesson
					: (a.lesson_types as { is_group_lesson?: boolean })?.is_group_lesson,
			) || [];
		const upcomingLessons =
			agreements?.filter((_a) => {
				// Simple check - in real implementation, calculate actual upcoming lesson dates
				return true;
			}).length || 0;

		setStats({
			studentCount: uniqueStudents.size,
			lessonsPerWeek: agreements?.length || 0,
			groupLessons: groupLessons.length,
			upcomingLessons,
		});

		setLoading(false);
	}, [isTeacher, teacherUserId]);

	useEffect(() => {
		if (!authLoading && isTeacher) {
			loadStatistics();
		}
	}, [authLoading, isTeacher, loadStatistics]);

	// Redirect if not a teacher
	if (!authLoading && !isTeacher) {
		return <Navigate to="/" replace />;
	}

	if (authLoading || loading) {
		return <PageSkeleton variant="header-and-cards" />;
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Mijn Statistieken</h1>
				<p className="text-muted-foreground">Overzicht van je lesactiviteiten</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader>
						<CardTitle>Aantal leerlingen</CardTitle>
						<CardDescription>Unieke leerlingen</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{stats.studentCount}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Lessen per week</CardTitle>
						<CardDescription>Actieve lesovereenkomsten</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{stats.lessonsPerWeek}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Groepslessen</CardTitle>
						<CardDescription>Actieve groepslessen</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{stats.groupLessons}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Aankomende lessen</CardTitle>
						<CardDescription>Geplande lessen</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{stats.upcomingLessons}</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
