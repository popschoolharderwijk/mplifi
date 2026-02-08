import { FunctionsHttpError } from '@supabase/supabase-js';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { type AppRole, allRoles, roleLabels } from '@/lib/roles';

interface UserData {
	user_id: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
	phone_number: string | null;
	role: AppRole | null;
}

interface UserFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	isSiteAdmin: boolean;
	/** User data for edit mode. If undefined, dialog is in create mode. */
	user?: UserData;
}

interface FormState {
	email: string;
	first_name: string;
	last_name: string;
	phone_number: string;
	role: AppRole | null;
}

const emptyForm: FormState = {
	email: '',
	first_name: '',
	last_name: '',
	phone_number: '',
	role: null,
};

export function UserFormDialog({ open, onOpenChange, onSuccess, isSiteAdmin, user }: UserFormDialogProps) {
	const isEditMode = !!user;
	const [form, setForm] = useState<FormState>(emptyForm);
	const [saving, setSaving] = useState(false);

	// Initialize form when dialog opens or user changes
	useEffect(() => {
		if (open) {
			if (user) {
				setForm({
					email: user.email,
					first_name: user.first_name ?? '',
					last_name: user.last_name ?? '',
					phone_number: user.phone_number ?? '',
					role: user.role,
				});
			} else {
				setForm(emptyForm);
			}
		}
	}, [open, user]);

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

		// Defense-in-depth: prevent non-site_admins from assigning site_admin role
		if (form.role === 'site_admin' && !isSiteAdmin) {
			toast.error('Geen toegang', {
				description: 'Admins kunnen geen site_admin rollen toewijzen.',
			});
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
		const { data, error: invokeError } = await supabase.functions.invoke('create-user', {
			body: {
				email: form.email,
				first_name: form.first_name || undefined,
				last_name: form.last_name || undefined,
				phone_number: form.phone_number || undefined,
				role: form.role || undefined,
			},
		});

		if (invokeError) {
			let errorMessage = isSiteAdmin ? invokeError.message : 'Er is een onbekende fout opgetreden.';

			if (invokeError instanceof FunctionsHttpError) {
				try {
					const errorBody = await invokeError.context.json();
					errorMessage = errorBody?.error || errorMessage;
				} catch {
					// Could not parse error body - for site_admin show raw message
					if (isSiteAdmin) {
						errorMessage = invokeError.message || String(invokeError);
					}
				}
			} else if (isSiteAdmin) {
				errorMessage = invokeError.message || String(invokeError);
			}

			toast.error('Fout bij aanmaken gebruiker', {
				description: errorMessage,
			});
			return;
		}

		if (data?.error) {
			toast.error('Fout bij aanmaken gebruiker', {
				description: data.error,
			});
			return;
		}

		if (data?.warning) {
			toast.warning('Gebruiker aangemaakt', {
				description: data.warning,
			});
		} else {
			toast.success('Gebruiker aangemaakt', {
				description: `Gebruiker ${form.email} is succesvol aangemaakt.`,
			});
		}

		setForm(emptyForm);
		onOpenChange(false);
		onSuccess();
	};

	const handleEdit = async () => {
		if (!user) return;

		// Update profile
		const { error: profileError } = await supabase
			.from('profiles')
			.update({
				email: form.email,
				first_name: form.first_name || null,
				last_name: form.last_name || null,
				phone_number: form.phone_number || null,
			})
			.eq('user_id', user.user_id);

		if (profileError) {
			toast.error('Fout bij bijwerken gebruiker', {
				description: profileError.message,
			});
			return;
		}

		// Update role if changed
		if (form.role !== user.role) {
			if (form.role === null) {
				// Delete role
				const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', user.user_id);

				if (deleteError) {
					toast.error('Fout bij bijwerken rol', {
						description: deleteError.message,
					});
					return;
				}
			} else if (user.role === null) {
				// Insert new role
				const { error: insertError } = await supabase
					.from('user_roles')
					.insert({ user_id: user.user_id, role: form.role });

				if (insertError) {
					toast.error('Fout bij toewijzen rol', {
						description: insertError.message,
					});
					return;
				}
			} else {
				// Update existing role
				const { error: updateError } = await supabase
					.from('user_roles')
					.update({ role: form.role })
					.eq('user_id', user.user_id);

				if (updateError) {
					toast.error('Fout bij bijwerken rol', {
						description: updateError.message,
					});
					return;
				}
			}
		}

		toast.success('Gebruiker bijgewerkt');
		setForm(emptyForm);
		onOpenChange(false);
		onSuccess();
	};

	const dialogTitle = isEditMode ? 'Gebruiker bewerken' : 'Nieuwe gebruiker toevoegen';
	const dialogDescription = isEditMode
		? `Wijzig de gegevens van ${form.first_name || form.email}.`
		: 'Voeg een nieuwe gebruiker toe aan het systeem.';
	const submitLabel = isEditMode ? 'Opslaan' : 'Toevoegen';
	const savingLabel = isEditMode ? 'Opslaan...' : 'Toevoegen...';

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{dialogTitle}</DialogTitle>
					<DialogDescription>{dialogDescription}</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="user-first-name">Voornaam</Label>
							<Input
								id="user-first-name"
								value={form.first_name}
								onChange={(e) => setForm({ ...form, first_name: e.target.value })}
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="user-last-name">Achternaam</Label>
							<Input
								id="user-last-name"
								value={form.last_name}
								onChange={(e) => setForm({ ...form, last_name: e.target.value })}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="user-email">Email *</Label>
							<Input
								id="user-email"
								type="email"
								value={form.email}
								onChange={(e) => setForm({ ...form, email: e.target.value })}
								placeholder="gebruiker@voorbeeld.nl"
								disabled={isEditMode}
							/>
							{isEditMode && (
								<p className="text-xs text-muted-foreground">Email kan niet worden gewijzigd.</p>
							)}
						</div>
						<div className="space-y-2">
							<PhoneInput
								id="user-phone-number"
								label="Telefoonnummer"
								value={form.phone_number}
								onChange={(value) => setForm({ ...form, phone_number: value })}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="user-role">Rol</Label>
						<Select
							value={form.role ?? 'none'}
							onValueChange={(value) =>
								setForm({ ...form, role: value === 'none' ? null : (value as AppRole) })
							}
						>
							<SelectTrigger id="user-role">
								<SelectValue placeholder="Geen rol" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Geen rol</SelectItem>
								{allRoles.map((role) => {
									const config = roleLabels[role];
									const Icon = config.icon;
									return (
										<SelectItem key={role} value={role}>
											<span className="flex items-center gap-2">
												<Icon className="h-4 w-4" />
												{config.label}
											</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
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
