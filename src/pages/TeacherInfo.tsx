import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AgendaView } from '@/components/agenda/AgendaView';
import { TeacherAvailabilitySection } from '@/components/teachers/TeacherAvailabilitySection';
import { TeacherLessonTypesSection } from '@/components/teachers/TeacherLessonTypesSection';
import { TeacherProfileSection } from '@/components/teachers/TeacherProfileSection';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Teacher } from '@/types/teachers';

export default function TeacherInfo() {
	const { id } = useParams<{ id: string }>();
	const { isTeacher, teacherUserId, isAdmin, isSiteAdmin, isLoading: authLoading } = useAuth();
	const [loading, setLoading] = useState(true);
	const [teacherProfile, setTeacherProfile] = useState<Teacher | null>(null);
	const [targetTeacherUserId, setTargetTeacherUserId] = useState<string | null>(null);

	// Determine which teacher we're viewing
	useEffect(() => {
		if (authLoading) return;

		// If id is provided in URL, use that (for admins viewing other teachers)
		if (id) {
			setTargetTeacherUserId(id);
			return;
		}

		// If no id and user is a teacher, use their own teacherUserId
		if (isTeacher && teacherUserId) {
			setTargetTeacherUserId(teacherUserId);
			return;
		}

		// Otherwise, can't determine teacher
		setTargetTeacherUserId(null);
	}, [id, isTeacher, teacherUserId, authLoading]);

	// Load teacher profile
	const loadProfile = useCallback(async () => {
		if (!targetTeacherUserId) return;

		setLoading(true);

		// Get teacher data
		const { data: teacherData, error: teacherError } = await supabase
			.from('teachers')
			.select('user_id, bio, is_active, created_at, updated_at')
			.eq('user_id', targetTeacherUserId)
			.single();

		if (teacherError) {
			console.error('Error loading teacher:', teacherError);
			setLoading(false);
			return;
		}

		// Get profile data
		const { data: profileData, error: profileError } = await supabase
			.from('profiles')
			.select('user_id, first_name, last_name, email, avatar_url, phone_number')
			.eq('user_id', teacherData.user_id)
			.single();

		if (profileError) {
			console.error('Error loading profile:', profileError);
			setLoading(false);
			return;
		}

		setTeacherProfile({
			...teacherData,
			...profileData,
		} as Teacher);
		setLoading(false);
	}, [targetTeacherUserId]);

	useEffect(() => {
		if (targetTeacherUserId) {
			loadProfile();
		}
	}, [targetTeacherUserId, loadProfile]);

	const { setBreadcrumbSuffix } = useBreadcrumb();
	useEffect(() => {
		if (!teacherProfile) {
			setBreadcrumbSuffix([]);
			return;
		}
		const name =
			teacherProfile.first_name && teacherProfile.last_name
				? `${teacherProfile.first_name} ${teacherProfile.last_name}`
				: teacherProfile.first_name || teacherProfile.email;
		setBreadcrumbSuffix([{ label: name }]);
		return () => setBreadcrumbSuffix([]);
	}, [teacherProfile, setBreadcrumbSuffix]);

	// Check access
	const canView = useCallback(() => {
		if (!targetTeacherUserId) return false;
		// Admins can view all teachers
		if (isAdmin || isSiteAdmin) return true;
		// Teachers can only view their own profile
		if (isTeacher && teacherUserId === targetTeacherUserId) return true;
		return false;
	}, [targetTeacherUserId, isAdmin, isSiteAdmin, isTeacher, teacherUserId]);

	// Check if can edit
	const canEdit = useCallback(() => {
		if (!targetTeacherUserId) return false;
		// Admins can edit all teachers
		if (isAdmin || isSiteAdmin) return true;
		// Teachers can only edit their own profile
		if (isTeacher && teacherUserId === targetTeacherUserId) return true;
		return false;
	}, [targetTeacherUserId, isAdmin, isSiteAdmin, isTeacher, teacherUserId]);

	// Show loading while auth is loading or while we're determining targetTeacherUserId
	if (authLoading || !targetTeacherUserId) {
		return <PageSkeleton variant="header-and-tabs" />;
	}

	// Check access after we know targetTeacherUserId
	if (!canView()) {
		return <Navigate to="/" replace />;
	}

	// Show loading while fetching teacher profile
	if (loading || !teacherProfile) {
		return <PageSkeleton variant="header-and-tabs" />;
	}

	const teacherName =
		teacherProfile.first_name && teacherProfile.last_name
			? `${teacherProfile.first_name} ${teacherProfile.last_name}`
			: teacherProfile.first_name || teacherProfile.email;

	const teacherInitials =
		teacherProfile.first_name && teacherProfile.last_name
			? `${teacherProfile.first_name[0]}${teacherProfile.last_name[0]}`.toUpperCase()
			: teacherProfile.first_name
				? teacherProfile.first_name.slice(0, 2).toUpperCase()
				: teacherProfile.email.slice(0, 2).toUpperCase();

	return (
		<div className="space-y-6">
			<PageHeader
				icon={
					<Avatar className="h-16 w-16">
						<AvatarImage src={teacherProfile.avatar_url ?? undefined} alt={teacherName} />
						<AvatarFallback className="bg-primary/10 text-primary text-xl">
							{teacherInitials}
						</AvatarFallback>
					</Avatar>
				}
				title={teacherName}
				subtitle={teacherProfile.email}
			/>

			{/* Tabs */}
			<Tabs defaultValue="profile" className="space-y-2">
				<TabsList>
					<TabsTrigger value="profile">Profiel</TabsTrigger>
					<TabsTrigger value="agenda">Agenda</TabsTrigger>
				</TabsList>

				<TabsContent value="profile">
					{/* Two-column grid: both columns scale with viewport */}
					<div className="grid gap-6 lg:grid-cols-2">
						{/* Left column: Profile + Lesson types */}
						<div className="space-y-6 min-w-0">
							<TeacherProfileSection
								teacherUserId={targetTeacherUserId}
								user_id={teacherProfile.user_id}
								canEdit={canEdit()}
								onUpdate={loadProfile}
								initialBio={teacherProfile.bio}
								initialFirstName={teacherProfile.first_name}
								initialLastName={teacherProfile.last_name}
								initialPhoneNumber={teacherProfile.phone_number}
							/>
							<TeacherLessonTypesSection teacherUserId={targetTeacherUserId} canEdit={canEdit()} />
							<div className="text-xs italic text-muted-foreground space-y-1">
								<p>Aangemaakt: {new Date(teacherProfile.created_at).toLocaleString('nl-NL')}</p>
								<p>Laatst bijgewerkt: {new Date(teacherProfile.updated_at).toLocaleString('nl-NL')}</p>
							</div>
						</div>

						{/* Right column: Availability (scales with viewport) */}
						<div className="min-w-0">
							<TeacherAvailabilitySection teacherUserId={targetTeacherUserId} canEdit={canEdit()} />
						</div>
					</div>
				</TabsContent>

				<TabsContent value="agenda">
					<AgendaView userId={targetTeacherUserId} canEdit={canEdit()} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
