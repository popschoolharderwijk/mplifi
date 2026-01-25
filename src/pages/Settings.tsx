import { useEffect, useState } from 'react';
import { LuMonitor, LuMoon, LuSun, LuTrash2, LuUpload } from 'react-icons/lu';
import { toast } from 'sonner';
import { useTheme } from '@/components/ThemeProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export default function Settings() {
	const { theme, setTheme } = useTheme();
	const { user } = useAuth();
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [profile, setProfile] = useState<{
		first_name: string | null;
		last_name: string | null;
		phone_number: string | null;
		avatar_url: string | null;
	} | null>(null);

	const [formData, setFormData] = useState({
		first_name: '',
		last_name: '',
		phone_number: '',
	});

	const [errors, setErrors] = useState<{
		first_name?: string;
		last_name?: string;
		phone_number?: string;
	}>({});

	// Load profile data
	useEffect(() => {
		async function loadProfile() {
			if (!user) return;
			setLoading(true);

			const { data, error } = await supabase
				.from('profiles')
				.select('first_name, last_name, phone_number, avatar_url')
				.eq('user_id', user.id)
				.single();

			if (error) {
				console.error('Error loading profile:', error);
			} else if (data) {
				setProfile(data);
				setFormData({
					first_name: data.first_name || '',
					last_name: data.last_name || '',
					phone_number: data.phone_number || '',
				});
			}
			setLoading(false);
		}

		loadProfile();
	}, [user]);

	// Validate phone number (10 digits only)
	const validatePhoneNumber = (phone: string): boolean => {
		if (!phone) return true; // Empty is allowed (NULL)
		const digitsOnly = phone.replace(/\D/g, '');
		return digitsOnly.length === 10;
	};

	// Normalize phone number (remove non-digits)
	const normalizePhoneNumber = (phone: string): string => {
		return phone.replace(/\D/g, '');
	};

	const handlePhoneNumberChange = (value: string) => {
		const normalized = normalizePhoneNumber(value);
		setFormData({ ...formData, phone_number: normalized });

		if (normalized && !validatePhoneNumber(normalized)) {
			setErrors({ ...errors, phone_number: 'Telefoonnummer moet exact 10 cijfers zijn' });
		} else {
			setErrors({ ...errors, phone_number: undefined });
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;

		// Validate
		const newErrors: typeof errors = {};
		if (formData.phone_number && !validatePhoneNumber(formData.phone_number)) {
			newErrors.phone_number = 'Telefoonnummer moet exact 10 cijfers zijn';
		}
		setErrors(newErrors);

		if (Object.keys(newErrors).length > 0) return;

		setSaving(true);

		const normalizedPhone = formData.phone_number || null;

		const { error } = await supabase
			.from('profiles')
			.update({
				first_name: formData.first_name || null,
				last_name: formData.last_name || null,
				phone_number: normalizedPhone,
			})
			.eq('user_id', user.id);

		if (error) {
			console.error('Error updating profile:', error);
			toast.error('Fout bij opslaan', {
				description: error.message,
			});
		} else {
			// Update local state
			setProfile({
				...profile!,
				first_name: formData.first_name || null,
				last_name: formData.last_name || null,
				phone_number: normalizedPhone,
			});
			toast.success('Profiel opgeslagen!');
			// Notify TopNav to refresh profile data
			window.dispatchEvent(new Event('profile-updated'));
		}

		setSaving(false);
	};

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!user || !e.target.files || e.target.files.length === 0) return;

		const file = e.target.files[0];
		const fileExt = file.name.split('.').pop();
		// Use consistent filename to overwrite previous avatar
		const fileName = `${user.id}.${fileExt}`;
		const filePath = fileName;

		setSaving(true);

		// Delete any existing avatar files for this user (handles extension changes)
		const { data: existingFiles } = await supabase.storage.from('avatars').list('', {
			search: user.id,
		});

		if (existingFiles && existingFiles.length > 0) {
			const filesToDelete = existingFiles.filter((f) => f.name.startsWith(user.id)).map((f) => f.name);
			if (filesToDelete.length > 0) {
				await supabase.storage.from('avatars').remove(filesToDelete);
			}
		}

		// Upload new file
		const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });

		if (uploadError) {
			console.error('Error uploading avatar:', uploadError);
			toast.error('Fout bij uploaden avatar', {
				description: uploadError.message,
			});
			setSaving(false);
			return;
		}

		// Get public URL with cache-busting parameter
		const {
			data: { publicUrl },
		} = supabase.storage.from('avatars').getPublicUrl(filePath);

		// Add cache-busting timestamp to prevent browser caching old avatar
		const avatarUrlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

		// Update profile
		const { error: updateError } = await supabase
			.from('profiles')
			.update({ avatar_url: avatarUrlWithCacheBust })
			.eq('user_id', user.id);

		if (updateError) {
			console.error('Error updating avatar URL:', updateError);
			toast.error('Fout bij opslaan avatar', {
				description: updateError.message,
			});
		} else {
			setProfile({ ...profile!, avatar_url: avatarUrlWithCacheBust });
			toast.success('Avatar opgeslagen!');
			// Notify TopNav to refresh profile data
			window.dispatchEvent(new Event('profile-updated'));
		}

		setSaving(false);
	};

	const handleAvatarDelete = async () => {
		if (!user) return;

		setSaving(true);

		// Delete avatar files from storage
		const { data: existingFiles } = await supabase.storage.from('avatars').list('', {
			search: user.id,
		});

		if (existingFiles && existingFiles.length > 0) {
			const filesToDelete = existingFiles.filter((f) => f.name.startsWith(user.id)).map((f) => f.name);
			if (filesToDelete.length > 0) {
				const { error: deleteError } = await supabase.storage.from('avatars').remove(filesToDelete);
				if (deleteError) {
					console.error('Error deleting avatar files:', deleteError);
					toast.error('Fout bij verwijderen avatar', {
						description: deleteError.message,
					});
					setSaving(false);
					return;
				}
			}
		}

		// Clear avatar_url in profile
		const { error: updateError } = await supabase
			.from('profiles')
			.update({ avatar_url: null })
			.eq('user_id', user.id);

		if (updateError) {
			console.error('Error clearing avatar URL:', updateError);
			toast.error('Fout bij verwijderen avatar', {
				description: updateError.message,
			});
		} else {
			setProfile({ ...profile!, avatar_url: null });
			toast.success('Avatar verwijderd!');
			// Notify TopNav to refresh profile data
			window.dispatchEvent(new Event('profile-updated'));
		}

		setSaving(false);
	};

	const userInitials =
		profile?.first_name && profile?.last_name
			? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
			: profile?.first_name
				? profile.first_name.slice(0, 2).toUpperCase()
				: user?.email?.slice(0, 2).toUpperCase() || 'U';

	if (loading) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Instellingen</h1>
					<p className="text-muted-foreground">Beheer je voorkeuren en accountinstellingen</p>
				</div>
				<p>Laden...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Instellingen</h1>
				<p className="text-muted-foreground">Beheer je voorkeuren en accountinstellingen</p>
			</div>

			{/* Profile Information */}
			<Card>
				<CardHeader>
					<CardTitle>Profiel</CardTitle>
					<CardDescription>Wijzig je persoonlijke informatie</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Avatar */}
					<div className="flex items-center gap-4">
						<Avatar className="h-20 w-20">
							<AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
							<AvatarFallback className="bg-primary text-primary-foreground text-lg">
								{userInitials}
							</AvatarFallback>
						</Avatar>
						<div className="space-y-2">
							<Label htmlFor="avatar-upload">Avatar</Label>
							<div className="flex items-center gap-2">
								<Input
									id="avatar-upload"
									type="file"
									accept="image/*"
									onChange={handleAvatarUpload}
									disabled={saving}
									className="hidden"
								/>
								<Button
									type="button"
									variant="outline"
									onClick={() => document.getElementById('avatar-upload')?.click()}
									disabled={saving}
								>
									<LuUpload className="mr-2 h-4 w-4" />
									Upload avatar
								</Button>
								{profile?.avatar_url && (
									<Button
										type="button"
										variant="outline"
										onClick={handleAvatarDelete}
										disabled={saving}
										className="text-destructive hover:text-destructive"
									>
										<LuTrash2 className="mr-2 h-4 w-4" />
										Verwijderen
									</Button>
								)}
							</div>
							<p className="text-xs text-muted-foreground">JPG, PNG of GIF. Max 5MB.</p>
						</div>
					</div>

					{/* Profile Form */}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="first_name">Voornaam</Label>
								<Input
									id="first_name"
									value={formData.first_name}
									onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
									disabled={saving}
								/>
								{errors.first_name && <p className="text-xs text-destructive">{errors.first_name}</p>}
							</div>

							<div className="space-y-2">
								<Label htmlFor="last_name">Achternaam</Label>
								<Input
									id="last_name"
									value={formData.last_name}
									onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
									disabled={saving}
								/>
								{errors.last_name && <p className="text-xs text-destructive">{errors.last_name}</p>}
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="phone_number">Telefoonnummer</Label>
							<Input
								id="phone_number"
								type="tel"
								value={formData.phone_number}
								onChange={(e) => handlePhoneNumberChange(e.target.value)}
								placeholder="0612345678"
								maxLength={10}
								disabled={saving}
							/>
							{errors.phone_number && <p className="text-xs text-destructive">{errors.phone_number}</p>}
							<p className="text-xs text-muted-foreground">
								Voer 10 cijfers in (bijv. 0612345678). Laat leeg om te verwijderen.
							</p>
						</div>

						<Button type="submit" disabled={saving}>
							{saving ? 'Opslaan...' : 'Opslaan'}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Theme Settings */}
			<Card>
				<CardHeader>
					<CardTitle>Thema</CardTitle>
					<CardDescription>Kies je voorkeur voor licht of donker thema</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex gap-2">
						<Button
							variant="outline"
							className={cn('flex-1', theme === 'light' && 'border-primary bg-primary/10')}
							onClick={() => setTheme('light')}
						>
							<LuSun className="mr-2 h-4 w-4" />
							Licht
						</Button>
						<Button
							variant="outline"
							className={cn('flex-1', theme === 'dark' && 'border-primary bg-primary/10')}
							onClick={() => setTheme('dark')}
						>
							<LuMoon className="mr-2 h-4 w-4" />
							Donker
						</Button>
						<Button
							variant="outline"
							className={cn('flex-1', theme === 'system' && 'border-primary bg-primary/10')}
							onClick={() => setTheme('system')}
						>
							<LuMonitor className="mr-2 h-4 w-4" />
							Systeem
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
