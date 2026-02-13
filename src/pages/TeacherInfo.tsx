import { useCallback, useEffect, useState } from 'react';
import { LuLoaderCircle } from 'react-icons/lu';
import { Navigate, useParams } from 'react-router-dom';
import { TeacherAgendaView } from '@/components/teachers/TeacherAgendaView';
import { TeacherAvailabilitySection } from '@/components/teachers/TeacherAvailabilitySection';
import { TeacherLessonTypesSection } from '@/components/teachers/TeacherLessonTypesSection';
import { TeacherProfileSection } from '@/components/teachers/TeacherProfileSection';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { TeacherWithProfile } from '@/types/teachers';

export default function TeacherInfo() {
	const { id } = useParams<{ id: string }>();
	const { isTeacher, teacherId, isAdmin, isSiteAdmin, isLoading: authLoading } = useAuth();
	const [loading, setLoading] = useState(true);
	const [teacherProfile, setTeacherProfile] = useState<TeacherWithProfile | null>(null);
	const [targetTeacherId, setTargetTeacherId] = useState<string | null>(null);

	// Determine which teacher we're viewing
	useEffect(() => {
		if (authLoading) return;

		// If id is provided in URL, use that (for admins viewing other teachers)
		if (id) {
			setTargetTeacherId(id);
			return;
		}

		// If no id and user is a teacher, use their own teacherId
		if (isTeacher && teacherId) {
			setTargetTeacherId(teacherId);
			return;
		}

		// Otherwise, can't determine teacher
		setTargetTeacherId(null);
	}, [id, isTeacher, teacherId, authLoading]);

	// Load teacher profile
	const loadProfile = useCallback(async () => {
		if (!targetTeacherId) return;

		setLoading(true);

		// Get teacher data
		const { data: teacherData, error: teacherError } = await supabase
			.from('teachers')
			.select('id, user_id, bio, is_active, created_at, updated_at')
			.eq('id', targetTeacherId)
			.single();

		if (teacherError) {
			console.error('Error loading teacher:', teacherError);
			setLoading(false);
			return;
		}

		// Get profile data
		const { data: profileData, error: profileError } = await supabase
			.from('profiles')
			.select('first_name, last_name, email, avatar_url, phone_number')
			.eq('user_id', teacherData.user_id)
			.single();

		if (profileError) {
			console.error('Error loading profile:', profileError);
			setLoading(false);
			return;
		}

		setTeacherProfile({
			id: teacherData.id,
			user_id: teacherData.user_id,
			bio: teacherData.bio,
			is_active: teacherData.is_active,
			created_at: teacherData.created_at,
			updated_at: teacherData.updated_at,
			profile: profileData,
		});
		setLoading(false);
	}, [targetTeacherId]);

	useEffect(() => {
		if (targetTeacherId) {
			loadProfile();
		}
	}, [targetTeacherId, loadProfile]);

	// Check access
	const canView = useCallback(() => {
		if (!targetTeacherId) return false;
		// Admins can view all teachers
		if (isAdmin || isSiteAdmin) return true;
		// Teachers can only view their own profile
		if (isTeacher && teacherId === targetTeacherId) return true;
		return false;
	}, [targetTeacherId, isAdmin, isSiteAdmin, isTeacher, teacherId]);

	// Check if can edit
	const canEdit = useCallback(() => {
		if (!targetTeacherId) return false;
		// Admins can edit all teachers
		if (isAdmin || isSiteAdmin) return true;
		// Teachers can only edit their own profile
		if (isTeacher && teacherId === targetTeacherId) return true;
		return false;
	}, [targetTeacherId, isAdmin, isSiteAdmin, isTeacher, teacherId]);

	// Show loading while auth is loading or while we're determining targetTeacherId
	if (authLoading || !targetTeacherId) {
		return (
			<div className="flex items-center justify-center py-12">
				<LuLoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// Check access after we know targetTeacherId
	if (!canView()) {
		return <Navigate to="/" replace />;
	}

	// Show loading while fetching teacher profile
	if (loading || !teacherProfile) {
		return (
			<div className="flex items-center justify-center py-12">
				<LuLoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const teacherName =
		teacherProfile.profile.first_name && teacherProfile.profile.last_name
			? `${teacherProfile.profile.first_name} ${teacherProfile.profile.last_name}`
			: teacherProfile.profile.first_name || teacherProfile.profile.email;

	const teacherInitials =
		teacherProfile.profile.first_name && teacherProfile.profile.last_name
			? `${teacherProfile.profile.first_name[0]}${teacherProfile.profile.last_name[0]}`.toUpperCase()
			: teacherProfile.profile.first_name
				? teacherProfile.profile.first_name.slice(0, 2).toUpperCase()
				: teacherProfile.profile.email.slice(0, 2).toUpperCase();

	return (
		<div className="space-y-6">
			{/* Breadcrumb */}
			<Breadcrumb items={[{ label: 'Docenten', href: '/teachers' }, { label: teacherName }]} />

			{/* Header */}
			<div className="flex items-center gap-4">
				<Avatar className="h-16 w-16">
					<AvatarImage src={teacherProfile.profile.avatar_url ?? undefined} alt={teacherName} />
					<AvatarFallback className="bg-primary/10 text-primary text-xl">{teacherInitials}</AvatarFallback>
				</Avatar>
				<div>
					<h1 className="text-3xl font-bold">{teacherName}</h1>
					<p className="text-muted-foreground">{teacherProfile.profile.email}</p>
				</div>
			</div>

			{/* Tabs */}
			<Tabs defaultValue="profile" className="space-y-6">
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
								teacherId={targetTeacherId}
								user_id={teacherProfile.user_id}
								canEdit={canEdit()}
								onUpdate={loadProfile}
								initialBio={teacherProfile.bio}
								initialFirstName={teacherProfile.profile.first_name}
								initialLastName={teacherProfile.profile.last_name}
								initialPhoneNumber={teacherProfile.profile.phone_number}
							/>
							<TeacherLessonTypesSection teacherId={targetTeacherId} canEdit={canEdit()} />
							<div className="text-xs italic text-muted-foreground space-y-1">
								<p>Aangemaakt: {new Date(teacherProfile.created_at).toLocaleString('nl-NL')}</p>
								<p>Laatst bijgewerkt: {new Date(teacherProfile.updated_at).toLocaleString('nl-NL')}</p>
							</div>
						</div>

						{/* Right column: Availability (scales with viewport) */}
						<div className="min-w-0">
							<TeacherAvailabilitySection teacherId={targetTeacherId} canEdit={canEdit()} />
						</div>
					</div>
				</TabsContent>

				<TabsContent value="agenda">
					<TeacherAgendaView teacherId={targetTeacherId} canEdit={canEdit()} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
