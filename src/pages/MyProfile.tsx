import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { PhoneInput } from '@/components/ui/phone-input';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface TeacherProfile {
	id: string;
	bio: string | null;
	profile: {
		first_name: string | null;
		last_name: string | null;
		phone_number: string | null;
		avatar_url: string | null;
	};
	lesson_types: Array<{
		lesson_type_id: string;
		lesson_types: {
			name: string;
		};
	}>;
}

export default function MyProfile() {
	const { isTeacher, teacherUserId, user, isLoading: authLoading } = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
	const [form, setForm] = useState({
		bio: '',
		phone_number: '',
	});

	const loadProfile = useCallback(async () => {
		if (!isTeacher || !teacherUserId || !user) return;

		setLoading(true);

		// Get teacher data
		const { data: teacherData, error: teacherError } = await supabase
			.from('teachers')
			.select('user_id, bio, teacher_lesson_types (lesson_type_id, lesson_types (name))')
			.eq('user_id', teacherUserId)
			.single();

		if (teacherError) {
			console.error('Error loading teacher:', teacherError);
			toast.error('Fout bij laden profiel');
			setLoading(false);
			return;
		}

		// Get profile data
		const { data: profileData, error: profileError } = await supabase
			.from('profiles')
			.select('first_name, last_name, phone_number, avatar_url')
			.eq('user_id', teacherData.user_id)
			.single();

		if (profileError) {
			console.error('Error loading profile:', profileError);
			toast.error('Fout bij laden profiel');
			setLoading(false);
			return;
		}

		setTeacherProfile({
			id: teacherData.user_id,
			bio: teacherData.bio,
			profile: profileData,
			lesson_types: (teacherData.teacher_lesson_types || []).map(
				(t: { lesson_type_id: string; lesson_types: { name: string } | { name: string }[] }) => ({
					lesson_type_id: t.lesson_type_id,
					lesson_types: Array.isArray(t.lesson_types) ? (t.lesson_types[0] ?? { name: '' }) : t.lesson_types,
				}),
			),
		});
		setForm({
			bio: teacherData.bio || '',
			phone_number: profileData.phone_number || '',
		});
		setLoading(false);
	}, [isTeacher, teacherUserId, user]);

	useEffect(() => {
		if (!authLoading && isTeacher) {
			loadProfile();
		}
	}, [authLoading, isTeacher, loadProfile]);

	// Redirect if not a teacher
	if (!authLoading && !isTeacher) {
		return <Navigate to="/" replace />;
	}

	const handleSave = async () => {
		if (!teacherUserId || !user) return;

		setSaving(true);

		// Update teacher bio
		const { error: teacherError } = await supabase
			.from('teachers')
			.update({ bio: form.bio || null })
			.eq('user_id', teacherUserId);

		if (teacherError) {
			console.error('Error updating teacher:', teacherError);
			toast.error('Fout bij bijwerken bio', {
				description: teacherError.message,
			});
			setSaving(false);
			return;
		}

		// Update profile phone number
		const { error: profileError } = await supabase
			.from('profiles')
			.update({ phone_number: form.phone_number || null })
			.eq('user_id', user.id);

		if (profileError) {
			console.error('Error updating profile:', profileError);
			toast.error('Fout bij bijwerken telefoonnummer', {
				description: profileError.message,
			});
			setSaving(false);
			return;
		}

		toast.success('Profiel bijgewerkt');
		setSaving(false);
		loadProfile();
	};

	if (authLoading || loading) {
		return <PageSkeleton variant="header-and-cards" />;
	}

	if (!teacherProfile) {
		return <Navigate to="/" replace />;
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Mijn Profiel</h1>
				<p className="text-muted-foreground">Bewerk je profielgegevens</p>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Persoonlijke gegevens</CardTitle>
						<CardDescription>Bio en contactgegevens</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="bio">Bio</Label>
							<Textarea
								id="bio"
								value={form.bio}
								onChange={(e) => setForm({ ...form, bio: e.target.value })}
								placeholder="Korte beschrijving van jezelf..."
								rows={4}
							/>
						</div>
						<PhoneInput
							id="phone-number"
							label="Telefoonnummer"
							value={form.phone_number}
							onChange={(value) => setForm({ ...form, phone_number: value })}
						/>
						<SubmitButton onClick={handleSave} loading={saving} loadingLabel="Opslaan...">
							Opslaan
						</SubmitButton>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Lessoorten</CardTitle>
						<CardDescription>Lessoorten die je geeft (beheerd door admin)</CardDescription>
					</CardHeader>
					<CardContent>
						{teacherProfile.lesson_types.length === 0 ? (
							<p className="text-sm text-muted-foreground">Geen lessoorten toegewezen</p>
						) : (
							<div className="space-y-2">
								{teacherProfile.lesson_types.map((lt) => (
									<div key={lt.lesson_type_id} className="rounded-md border p-2 text-sm">
										{lt.lesson_types.name}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
