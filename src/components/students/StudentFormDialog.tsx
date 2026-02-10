import { useEffect, useState } from 'react';
import { LuLoaderCircle } from 'react-icons/lu';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { PhoneInput } from '@/components/ui/phone-input';
import { UserSelector } from '@/components/ui/user-selector';
import { supabase } from '@/integrations/supabase/client';

interface StudentData {
	id: string;
	user_id: string;
	parent_name: string | null;
	parent_email: string | null;
	parent_phone_number: string | null;
	debtor_info_same_as_student: boolean;
	debtor_name: string | null;
	debtor_address: string | null;
	debtor_postal_code: string | null;
	debtor_city: string | null;
	profile: {
		email: string;
		first_name: string | null;
		last_name: string | null;
		phone_number: string | null;
	};
}

interface StudentFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	/** Student data for edit mode. If undefined, dialog is in create mode. */
	student?: StudentData;
}

interface FormState {
	email: string;
	first_name: string;
	last_name: string;
	phone_number: string;
	parent_name: string;
	parent_email: string;
	parent_phone_number: string;
	debtor_info_same_as_student: boolean;
	debtor_name: string;
	debtor_address: string;
	debtor_postal_code: string;
	debtor_city: string;
}

const emptyForm: FormState = {
	email: '',
	first_name: '',
	last_name: '',
	phone_number: '',
	parent_name: '',
	parent_email: '',
	parent_phone_number: '',
	debtor_info_same_as_student: true,
	debtor_name: '',
	debtor_address: '',
	debtor_postal_code: '',
	debtor_city: '',
};

type StudentFormMode = 'new-user' | 'existing-user';

export function StudentFormDialog({ open, onOpenChange, onSuccess, student }: StudentFormDialogProps) {
	const isEditMode = !!student;
	const [form, setForm] = useState<FormState>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [mode, setMode] = useState<StudentFormMode>('new-user');
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

	// Initialize form when dialog opens or student changes
	useEffect(() => {
		if (open) {
			if (student) {
				setForm({
					email: student.profile.email,
					first_name: student.profile.first_name ?? '',
					last_name: student.profile.last_name ?? '',
					phone_number: student.profile.phone_number ?? '',
					parent_name: student.parent_name ?? '',
					parent_email: student.parent_email ?? '',
					parent_phone_number: student.parent_phone_number ?? '',
					debtor_info_same_as_student: student.debtor_info_same_as_student,
					debtor_name: student.debtor_name ?? '',
					debtor_address: student.debtor_address ?? '',
					debtor_postal_code: student.debtor_postal_code ?? '',
					debtor_city: student.debtor_city ?? '',
				});
				setMode('new-user');
				setSelectedUserId(null);
			} else {
				setForm(emptyForm);
				setMode('new-user');
				setSelectedUserId(null);
			}
		}
	}, [open, student]);

	// Load user data when existing user is selected (only for email, not for form fields)
	const loadUserData = async (userId: string) => {
		const { data: profile, error } = await supabase
			.from('profiles')
			.select('email, first_name, last_name, phone_number')
			.eq('user_id', userId)
			.single();

		if (error) {
			console.error('Error loading user data:', error);
			toast.error('Fout bij laden gebruikersgegevens');
			return;
		}

		if (profile) {
			// Only set email for validation, keep other fields empty for existing users
			setForm({
				...emptyForm,
				email: profile.email,
			});
		}
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (!saving) {
			if (!newOpen) {
				setForm(emptyForm);
				setMode('new-user');
				setSelectedUserId(null);
			}
			onOpenChange(newOpen);
		}
	};

	const validateForm = (): boolean => {
		if (!isEditMode) {
			if (mode === 'existing-user' && !selectedUserId) {
				toast.error('Selecteer een gebruiker');
				return false;
			}
			if (mode === 'new-user' && !form.email) {
				toast.error('Email is verplicht');
				return false;
			}
		}

		// Validate email format
		if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
			toast.error('Ongeldig emailadres');
			return false;
		}

		// Validate phone numbers (10 digits)
		if (form.phone_number && !/^[0-9]{10}$/.test(form.phone_number.replace(/\s/g, ''))) {
			toast.error('Telefoonnummer moet 10 cijfers bevatten');
			return false;
		}
		if (form.parent_phone_number && !/^[0-9]{10}$/.test(form.parent_phone_number.replace(/\s/g, ''))) {
			toast.error('Ouder telefoonnummer moet 10 cijfers bevatten');
			return false;
		}

		// If debtor info is not same as student, validate debtor fields
		if (!form.debtor_info_same_as_student) {
			if (!form.debtor_name || !form.debtor_address || !form.debtor_postal_code || !form.debtor_city) {
				toast.error(
					'Alle debiteur NAW velden zijn verplicht als debiteurinformatie niet gelijk is aan leerlinginformatie',
				);
				return false;
			}
		}

		return true;
	};

	const handleSubmit = async () => {
		if (!validateForm()) {
			return;
		}

		setSaving(true);

		try {
			if (isEditMode) {
				await handleEdit();
			} else {
				await handleCreate();
			}
		} finally {
			setSaving(false);
		}
	};

	const handleCreate = async () => {
		let userId: string;

		if (mode === 'existing-user' && selectedUserId) {
			// Use existing user - no need to update profile, just use the user_id
			userId = selectedUserId;
		} else {
			// Create new user via Supabase Auth Admin API
			const { data: authData, error: authError } = await supabase.auth.admin.createUser({
				email: form.email,
				email_confirm: true,
				user_metadata: {
					first_name: form.first_name || undefined,
					last_name: form.last_name || undefined,
				},
			});

			if (authError || !authData.user) {
				toast.error('Fout bij aanmaken gebruiker', {
					description: authError?.message || 'Onbekende fout',
				});
				return;
			}

			userId = authData.user.id;

			// Update profile with phone number
			if (form.first_name || form.last_name || form.phone_number) {
				const { error: profileError } = await supabase
					.from('profiles')
					.update({
						first_name: form.first_name || null,
						last_name: form.last_name || null,
						phone_number: form.phone_number || null,
					})
					.eq('user_id', userId);

				if (profileError) {
					console.error('Error updating profile:', profileError);
					toast.error('Fout bij bijwerken profiel', {
						description: profileError.message,
					});
					return;
				}
			}
		}

		// Create student record
		const { data: studentData, error: studentError } = await supabase
			.from('students')
			.insert({
				user_id: userId,
				parent_name: form.parent_name || null,
				parent_email: form.parent_email || null,
				parent_phone_number: form.parent_phone_number || null,
				debtor_info_same_as_student: form.debtor_info_same_as_student,
				debtor_name: form.debtor_info_same_as_student ? null : form.debtor_name || null,
				debtor_address: form.debtor_info_same_as_student ? null : form.debtor_address || null,
				debtor_postal_code: form.debtor_info_same_as_student ? null : form.debtor_postal_code || null,
				debtor_city: form.debtor_info_same_as_student ? null : form.debtor_city || null,
			})
			.select('id')
			.single();

		if (studentError || !studentData) {
			toast.error('Fout bij aanmaken leerling', {
				description: studentError?.message || 'Onbekende fout',
			});
			return;
		}

		toast.success('Leerling aangemaakt', {
			description: `Leerling ${form.email} is succesvol aangemaakt.`,
		});

		setForm(emptyForm);
		setMode('new-user');
		setSelectedUserId(null);
		onOpenChange(false);
		onSuccess();
	};

	const handleEdit = async () => {
		if (!student) return;

		// Update profile (first_name, last_name, phone_number)
		const { error: profileError } = await supabase
			.from('profiles')
			.update({
				first_name: form.first_name || null,
				last_name: form.last_name || null,
				phone_number: form.phone_number || null,
			})
			.eq('user_id', student.user_id);

		if (profileError) {
			toast.error('Fout bij bijwerken profiel', {
				description: profileError.message,
			});
			return;
		}

		// Update student record
		const { error: studentError } = await supabase
			.from('students')
			.update({
				parent_name: form.parent_name || null,
				parent_email: form.parent_email || null,
				parent_phone_number: form.parent_phone_number || null,
				debtor_info_same_as_student: form.debtor_info_same_as_student,
				debtor_name: form.debtor_info_same_as_student ? null : form.debtor_name || null,
				debtor_address: form.debtor_info_same_as_student ? null : form.debtor_address || null,
				debtor_postal_code: form.debtor_info_same_as_student ? null : form.debtor_postal_code || null,
				debtor_city: form.debtor_info_same_as_student ? null : form.debtor_city || null,
			})
			.eq('id', student.id);

		if (studentError) {
			toast.error('Fout bij bijwerken leerling', {
				description: studentError.message,
			});
			return;
		}

		toast.success('Leerling bijgewerkt');
		setForm(emptyForm);
		onOpenChange(false);
		onSuccess();
	};

	const dialogTitle = isEditMode ? 'Leerling bewerken' : 'Nieuwe leerling toevoegen';
	const dialogDescription = isEditMode
		? `Wijzig de gegevens van ${form.first_name || form.email}.`
		: 'Voeg een nieuwe leerling toe aan het systeem.';
	const submitLabel = isEditMode ? 'Opslaan' : 'Toevoegen';
	const savingLabel = isEditMode ? 'Opslaan...' : 'Toevoegen...';

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
				<DialogHeader className="pb-2">
					<DialogTitle className="text-lg">{dialogTitle}</DialogTitle>
					{dialogDescription && (
						<DialogDescription className="text-sm">{dialogDescription}</DialogDescription>
					)}
				</DialogHeader>
				<div className="space-y-4 py-2">
					{/* Mode selector for new students */}
					{!isEditMode && (
						<div className="space-y-1.5">
							<Label className="text-sm">Type leerling</Label>
							<div className="flex gap-2">
								<Button
									type="button"
									variant={mode === 'new-user' ? 'default' : 'outline'}
									onClick={() => {
										setMode('new-user');
										setSelectedUserId(null);
										setForm({ ...form, email: '' });
									}}
									className="flex-1"
								>
									Nieuwe gebruiker
								</Button>
								<Button
									type="button"
									variant={mode === 'existing-user' ? 'default' : 'outline'}
									onClick={() => {
										setMode('existing-user');
										setForm({ ...form, email: '' });
									}}
									className="flex-1"
								>
									Bestaande gebruiker
								</Button>
							</div>
						</div>
					)}

					{/* User selector for existing users */}
					{!isEditMode && mode === 'existing-user' && (
						<div className="space-y-1.5">
							<Label className="text-sm">Selecteer gebruiker *</Label>
							<UserSelector
								value={selectedUserId}
								onChange={async (userId) => {
									setSelectedUserId(userId);
									if (userId) {
										await loadUserData(userId);
									}
								}}
							/>
						</div>
					)}

					{/* Personal information */}
					<div className="space-y-3 border-t pt-3">
						<h3 className="text-sm font-semibold">Persoonsgegevens</h3>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<Label htmlFor="student-first-name">Voornaam</Label>
								<Input
									id="student-first-name"
									value={form.first_name}
									onChange={(e) => setForm({ ...form, first_name: e.target.value })}
									disabled={isEditMode && mode === 'existing-user'}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="student-last-name">Achternaam</Label>
								<Input
									id="student-last-name"
									value={form.last_name}
									onChange={(e) => setForm({ ...form, last_name: e.target.value })}
									disabled={isEditMode && mode === 'existing-user'}
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<Label htmlFor="student-email">
									Email <span className="text-destructive">*</span>
								</Label>
								<Input
									id="student-email"
									type="email"
									value={form.email}
									onChange={(e) => setForm({ ...form, email: e.target.value })}
									placeholder="leerling@voorbeeld.nl"
									disabled={isEditMode || mode === 'existing-user'}
								/>
								{isEditMode && (
									<p className="text-xs text-muted-foreground">Email kan niet worden gewijzigd.</p>
								)}
							</div>
							<div className="space-y-1.5">
								<PhoneInput
									id="student-phone-number"
									label="Telefoonnummer"
									value={form.phone_number}
									onChange={(value) => setForm({ ...form, phone_number: value })}
								/>
							</div>
						</div>
					</div>

					{/* Parent/guardian information */}
					<div className="space-y-3 border-t pt-3">
						<h3 className="text-sm font-semibold">Ouder/voogd gegevens (optioneel)</h3>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<Label htmlFor="parent-name">Naam</Label>
								<Input
									id="parent-name"
									value={form.parent_name}
									onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="parent-email">Email</Label>
								<Input
									id="parent-email"
									type="email"
									value={form.parent_email}
									onChange={(e) => setForm({ ...form, parent_email: e.target.value })}
									placeholder="ouder@voorbeeld.nl"
								/>
							</div>
						</div>
						<div className="space-y-1.5">
							<PhoneInput
								id="parent-phone-number"
								label="Telefoonnummer"
								value={form.parent_phone_number}
								onChange={(value) => setForm({ ...form, parent_phone_number: value })}
							/>
						</div>
					</div>

					{/* Debtor information */}
					<div className="space-y-3 border-t pt-3">
						<h3 className="text-sm font-semibold">Debiteurgegevens</h3>
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								id="debtor-same-as-student"
								checked={form.debtor_info_same_as_student}
								onChange={(e) => {
									setForm({
										...form,
										debtor_info_same_as_student: e.target.checked,
										// Clear debtor fields when checked
										debtor_name: e.target.checked ? '' : form.debtor_name,
										debtor_address: e.target.checked ? '' : form.debtor_address,
										debtor_postal_code: e.target.checked ? '' : form.debtor_postal_code,
										debtor_city: e.target.checked ? '' : form.debtor_city,
									});
								}}
								className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
							/>
							<span className="text-sm font-medium">
								Debiteurinformatie gelijk aan leerlinginformatie
							</span>
						</label>
						{!form.debtor_info_same_as_student && (
							<div className="space-y-3 pl-6 border-l-2">
								<div className="space-y-1.5">
									<Label htmlFor="debtor-name">
										Naam <span className="text-destructive">*</span>
									</Label>
									<Input
										id="debtor-name"
										value={form.debtor_name}
										onChange={(e) => setForm({ ...form, debtor_name: e.target.value })}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="debtor-address">
										Adres <span className="text-destructive">*</span>
									</Label>
									<Input
										id="debtor-address"
										value={form.debtor_address}
										onChange={(e) => setForm({ ...form, debtor_address: e.target.value })}
									/>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<Label htmlFor="debtor-postal-code">
											Postcode <span className="text-destructive">*</span>
										</Label>
										<Input
											id="debtor-postal-code"
											value={form.debtor_postal_code}
											onChange={(e) => setForm({ ...form, debtor_postal_code: e.target.value })}
										/>
									</div>
									<div className="space-y-1.5">
										<Label htmlFor="debtor-city">
											Woonplaats <span className="text-destructive">*</span>
										</Label>
										<Input
											id="debtor-city"
											value={form.debtor_city}
											onChange={(e) => setForm({ ...form, debtor_city: e.target.value })}
										/>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
						Annuleren
					</Button>
					<Button onClick={handleSubmit} disabled={saving}>
						{saving ? (
							<>
								<LuLoaderCircle className="mr-2 h-4 w-4 animate-spin" />
								{savingLabel}
							</>
						) : (
							submitLabel
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
