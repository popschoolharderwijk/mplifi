import { useCallback, useEffect, useState } from 'react';
import { LuLoaderCircle } from 'react-icons/lu';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface TeacherProfileSectionProps {
	teacherId: string;
	user_id: string;
	canEdit: boolean;
	onUpdate?: () => void;
	initialBio?: string | null;
	initialFirstName?: string | null;
	initialLastName?: string | null;
	initialPhoneNumber?: string | null;
}

export function TeacherProfileSection({
	teacherId,
	user_id,
	canEdit,
	onUpdate,
	initialBio,
	initialFirstName,
	initialLastName,
	initialPhoneNumber,
}: TeacherProfileSectionProps) {
	const { user } = useAuth();
	const [bio, setBio] = useState<string>(initialBio || '');
	const [firstName, setFirstName] = useState<string>(initialFirstName || '');
	const [lastName, setLastName] = useState<string>(initialLastName || '');
	const [phoneNumber, setPhoneNumber] = useState<string>(initialPhoneNumber || '');
	const [loading, setLoading] = useState(!initialBio && !initialFirstName); // Only show loading if no initial data
	const [saving, setSaving] = useState(false);

	const loadProfile = useCallback(async () => {
		if (!teacherId || !user_id) return;

		setLoading(true);

		// Load bio
		const { data: teacherData, error: teacherError } = await supabase
			.from('teachers')
			.select('bio')
			.eq('id', teacherId)
			.single();

		if (teacherError) {
			console.error('Error loading bio:', teacherError);
			toast.error('Fout bij laden profiel');
			setLoading(false);
			return;
		}

		// Load profile data
		const { data: profileData, error: profileError } = await supabase
			.from('profiles')
			.select('first_name, last_name, phone_number')
			.eq('user_id', user_id)
			.single();

		if (profileError) {
			console.error('Error loading profile:', profileError);
			toast.error('Fout bij laden profiel');
			setLoading(false);
			return;
		}

		setBio(teacherData?.bio || '');
		setFirstName(profileData?.first_name || '');
		setLastName(profileData?.last_name || '');
		setPhoneNumber(profileData?.phone_number || '');
		setLoading(false);
	}, [teacherId, user_id]);

	// Only load profile if no initial data was provided
	useEffect(() => {
		if (!initialBio && !initialFirstName && !initialLastName && !initialPhoneNumber) {
			loadProfile();
		}
	}, [initialBio, initialFirstName, initialLastName, initialPhoneNumber, loadProfile]);

	// Update state when initial props change
	useEffect(() => {
		if (initialBio !== undefined) setBio(initialBio || '');
		if (initialFirstName !== undefined) setFirstName(initialFirstName || '');
		if (initialLastName !== undefined) setLastName(initialLastName || '');
		if (initialPhoneNumber !== undefined) setPhoneNumber(initialPhoneNumber || '');
	}, [initialBio, initialFirstName, initialLastName, initialPhoneNumber]);

	const handleSave = async () => {
		if (!teacherId || !user_id || !canEdit || !user) return;

		setSaving(true);

		// Update bio
		const { error: bioError } = await supabase
			.from('teachers')
			.update({ bio: bio || null })
			.eq('id', teacherId);

		if (bioError) {
			console.error('Error updating bio:', bioError);
			toast.error('Fout bij bijwerken bio', {
				description: bioError.message,
			});
			setSaving(false);
			return;
		}

		// Update profile data (only first_name, last_name, phone_number - email cannot be changed)
		const { error: profileError } = await supabase
			.from('profiles')
			.update({
				first_name: firstName || null,
				last_name: lastName || null,
				phone_number: phoneNumber || null,
			})
			.eq('user_id', user_id);

		if (profileError) {
			console.error('Error updating profile:', profileError);
			toast.error('Fout bij bijwerken profiel', {
				description: profileError.message,
			});
			setSaving(false);
			return;
		}

		toast.success('Profiel bijgewerkt');
		setSaving(false);
		onUpdate?.();
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LuLoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle>Persoonlijke gegevens</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="first-name">Voornaam</Label>
						<Input
							id="first-name"
							value={firstName}
							onChange={(e) => setFirstName(e.target.value)}
							disabled={!canEdit}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="last-name">Achternaam</Label>
						<Input
							id="last-name"
							value={lastName}
							onChange={(e) => setLastName(e.target.value)}
							disabled={!canEdit}
						/>
					</div>
				</div>
				<PhoneInput
					id="phone-number"
					label="Telefoonnummer"
					value={phoneNumber}
					onChange={(value) => setPhoneNumber(value)}
					disabled={!canEdit}
				/>
				<div className="space-y-2">
					<Label htmlFor="bio">Biografie</Label>
					<Textarea
						id="bio"
						value={bio}
						onChange={(e) => setBio(e.target.value)}
						placeholder="Korte beschrijving van jezelf..."
						rows={3}
						disabled={!canEdit}
						className="resize-none"
					/>
				</div>
				{canEdit && (
					<Button onClick={handleSave} disabled={saving} size="sm">
						{saving ? (
							<>
								<LuLoaderCircle className="mr-2 h-4 w-4 animate-spin" />
								Opslaan...
							</>
						) : (
							'Opslaan'
						)}
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
