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
import { LessonTypeSelector, type LessonTypeOption } from '@/components/ui/lesson-type-selector';
import { PhoneInput } from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

interface TeacherData {
	id: string;
	user_id: string;
	bio: string | null;
	is_active: boolean;
	profile: {
		email: string;
		first_name: string | null;
		last_name: string | null;
		phone_number: string | null;
	};
}


interface TeacherFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	/** Teacher data for edit mode. If undefined, dialog is in create mode. */
	teacher?: TeacherData;
}

interface FormState {
	email: string;
	first_name: string;
	last_name: string;
	phone_number: string;
	bio: string;
	lesson_type_ids: string[];
}

const emptyForm: FormState = {
	email: '',
	first_name: '',
	last_name: '',
	phone_number: '',
	bio: '',
	lesson_type_ids: [],
};

export function TeacherFormDialog({ open, onOpenChange, onSuccess, teacher }: TeacherFormDialogProps) {
	const isEditMode = !!teacher;
	const [form, setForm] = useState<FormState>(emptyForm);
	const [lessonTypes, setLessonTypes] = useState<LessonTypeOption[]>([]);
	const [loadingLessonTypes, setLoadingLessonTypes] = useState(false);
	const [saving, setSaving] = useState(false);

	// Load lesson types
	useEffect(() => {
		if (open) {
			setLoadingLessonTypes(true);
			supabase
				.from('lesson_types')
				.select('id, name, icon, color')
				.eq('is_active', true)
				.order('name', { ascending: true })
				.then(({ data, error }) => {
					if (error) {
						console.error('Error loading lesson types:', error);
						toast.error('Fout bij laden lessoorten');
					} else {
						setLessonTypes(data ?? []);
					}
					setLoadingLessonTypes(false);
				});
		}
	}, [open]);

	// Load teacher lesson types for edit mode
	useEffect(() => {
		if (open && teacher) {
			supabase
				.from('teacher_lesson_types')
				.select('lesson_type_id')
				.eq('teacher_id', teacher.id)
				.then(({ data, error }) => {
					if (error) {
						console.error('Error loading teacher lesson types:', error);
					} else {
						const lessonTypeIds = (data ?? []).map((item) => item.lesson_type_id);
						setForm((prev) => ({ ...prev, lesson_type_ids: lessonTypeIds }));
					}
				});
		}
	}, [open, teacher]);

	// Initialize form when dialog opens or teacher changes
	useEffect(() => {
		if (open) {
			if (teacher) {
				setForm({
					email: teacher.profile.email,
					first_name: teacher.profile.first_name ?? '',
					last_name: teacher.profile.last_name ?? '',
					phone_number: teacher.profile.phone_number ?? '',
					bio: teacher.bio ?? '',
					lesson_type_ids: [],
				});
			} else {
				setForm(emptyForm);
			}
		}
	}, [open, teacher]);

	const handleOpenChange = (newOpen: boolean) => {
		if (!saving) {
			if (!newOpen) {
				setForm(emptyForm);
			}
			onOpenChange(newOpen);
		}
	};

	const handleSubmit = async () => {
		if (!form.email) {
			toast.error('Email is verplicht');
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
		// Create user via Supabase Auth Admin API
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

		const userId = authData.user.id;

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

		// Create teacher record
		const { data: teacherData, error: teacherError } = await supabase
			.from('teachers')
			.insert({
				user_id: userId,
				bio: form.bio || null,
				is_active: true,
			})
			.select('id')
			.single();

		if (teacherError || !teacherData) {
			toast.error('Fout bij aanmaken docent', {
				description: teacherError?.message || 'Onbekende fout',
			});
			return;
		}

		// Link lesson types
		if (form.lesson_type_ids.length > 0) {
			const lessonTypeLinks = form.lesson_type_ids.map((lesson_type_id) => ({
				teacher_id: teacherData.id,
				lesson_type_id,
			}));

			const { error: linkError } = await supabase.from('teacher_lesson_types').insert(lessonTypeLinks);

			if (linkError) {
				console.error('Error linking lesson types:', linkError);
				toast.warning('Docent aangemaakt', {
					description: 'Docent is aangemaakt, maar lessoorten konden niet worden gekoppeld.',
				});
			}
		}

		toast.success('Docent aangemaakt', {
			description: `Docent ${form.email} is succesvol aangemaakt.`,
		});

		setForm(emptyForm);
		onOpenChange(false);
		onSuccess();
	};

	const handleEdit = async () => {
		if (!teacher) return;

		// Update teacher bio
		const { error: teacherError } = await supabase
			.from('teachers')
			.update({
				bio: form.bio || null,
			})
			.eq('id', teacher.id);

		if (teacherError) {
			toast.error('Fout bij bijwerken docent', {
				description: teacherError.message,
			});
			return;
		}

		// Update profile (first_name, last_name, phone_number)
		const { error: profileError } = await supabase
			.from('profiles')
			.update({
				first_name: form.first_name || null,
				last_name: form.last_name || null,
				phone_number: form.phone_number || null,
			})
			.eq('user_id', teacher.user_id);

		if (profileError) {
			toast.error('Fout bij bijwerken profiel', {
				description: profileError.message,
			});
			return;
		}

		// Update lesson types
		// First, get current lesson types
		const { data: currentLinks } = await supabase
			.from('teacher_lesson_types')
			.select('lesson_type_id')
			.eq('teacher_id', teacher.id);

		const currentIds = new Set((currentLinks ?? []).map((link) => link.lesson_type_id));
		const newIds = new Set(form.lesson_type_ids);

		// Find IDs to add
		const toAdd = form.lesson_type_ids.filter((id) => !currentIds.has(id));
		// Find IDs to remove
		const toRemove = Array.from(currentIds).filter((id) => !newIds.has(id));

		// Add new links
		if (toAdd.length > 0) {
			const linksToAdd = toAdd.map((lesson_type_id) => ({
				teacher_id: teacher.id,
				lesson_type_id,
			}));
			const { error: addError } = await supabase.from('teacher_lesson_types').insert(linksToAdd);
			if (addError) {
				toast.error('Fout bij toevoegen lessoorten', {
					description: addError.message,
				});
				return;
			}
		}

		// Remove old links
		if (toRemove.length > 0) {
			const { error: removeError } = await supabase
				.from('teacher_lesson_types')
				.delete()
				.eq('teacher_id', teacher.id)
				.in('lesson_type_id', toRemove);
			if (removeError) {
				toast.error('Fout bij verwijderen lessoorten', {
					description: removeError.message,
				});
				return;
			}
		}

		toast.success('Docent bijgewerkt');
		setForm(emptyForm);
		onOpenChange(false);
		onSuccess();
	};

	const dialogTitle = isEditMode ? 'Docent bewerken' : 'Nieuwe docent toevoegen';
	const dialogDescription = isEditMode
		? `Wijzig de gegevens van ${form.first_name || form.email}.`
		: 'Voeg een nieuwe docent toe aan het systeem.';
	const submitLabel = isEditMode ? 'Opslaan' : 'Toevoegen';
	const savingLabel = isEditMode ? 'Opslaan...' : 'Toevoegen...';

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
				<DialogHeader className="pb-2">
					<DialogTitle className="text-lg">{dialogTitle}</DialogTitle>
					{dialogDescription && (
						<DialogDescription className="text-sm">{dialogDescription}</DialogDescription>
					)}
				</DialogHeader>
				<div className="space-y-3 py-2">
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="teacher-first-name" className="text-sm">
								Voornaam
							</Label>
							<Input
								id="teacher-first-name"
								value={form.first_name}
								onChange={(e) => setForm({ ...form, first_name: e.target.value })}
								className="h-9"
								autoFocus
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="teacher-last-name" className="text-sm">
								Achternaam
							</Label>
							<Input
								id="teacher-last-name"
								value={form.last_name}
								onChange={(e) => setForm({ ...form, last_name: e.target.value })}
								className="h-9"
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="teacher-email" className="text-sm">
								Email *
							</Label>
							<Input
								id="teacher-email"
								type="email"
								value={form.email}
								onChange={(e) => setForm({ ...form, email: e.target.value })}
								placeholder="docent@voorbeeld.nl"
								disabled={isEditMode}
								className="h-9"
							/>
							{isEditMode && (
								<p className="text-xs text-muted-foreground">Email kan niet worden gewijzigd.</p>
							)}
						</div>
						<div className="space-y-1.5">
							<PhoneInput
								id="teacher-phone-number"
								label="Telefoonnummer"
								value={form.phone_number}
								onChange={(value) => setForm({ ...form, phone_number: value })}
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="teacher-bio" className="text-sm">
							Bio
						</Label>
						<Textarea
							id="teacher-bio"
							value={form.bio}
							onChange={(e) => setForm({ ...form, bio: e.target.value })}
							placeholder="Korte beschrijving van de docent..."
							rows={2}
							className="min-h-[50px]"
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-sm">Lessoorten</Label>
						{loadingLessonTypes ? (
							<div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
								<LuLoaderCircle className="h-4 w-4 animate-spin" />
								Lessoorten laden...
							</div>
						) : lessonTypes.length === 0 ? (
							<p className="text-sm text-muted-foreground py-2">Geen actieve lessoorten beschikbaar.</p>
						) : (
							<LessonTypeSelector
								value={form.lesson_type_ids}
								onChange={(selectedIds) => setForm({ ...form, lesson_type_ids: selectedIds })}
								options={lessonTypes}
								placeholder="Selecteer lessoorten..."
								searchPlaceholder="Zoek lessoort..."
							/>
						)}
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
						Annuleren
					</Button>
					<Button variant="default" onClick={handleSubmit} disabled={!form.email || saving}>
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
