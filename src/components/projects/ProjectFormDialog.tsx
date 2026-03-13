import { useCallback, useEffect, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { UserSelectSingle } from '@/components/ui/user-select';
import { supabase } from '@/integrations/supabase/client';

interface ProjectFormData {
	id?: string;
	name: string;
	label_id: string;
	owner_user_id: string;
	cost_center: string;
	description: string;
	is_active: boolean;
}

interface LabelOption {
	id: string;
	name: string;
	domain_name: string;
}

interface ProjectFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	project: {
		id: string;
		name: string;
		description: string | null;
		cost_center: string | null;
		is_active: boolean;
		owner_user_id: string;
		label_id: string;
	} | null;
	onSaved: () => void;
}

export function ProjectFormDialog({ open, onOpenChange, project, onSaved }: ProjectFormDialogProps) {
	const isEditing = !!project;
	const [form, setForm] = useState<ProjectFormData>({
		name: '',
		label_id: '',
		owner_user_id: '',
		cost_center: '',
		description: '',
		is_active: true,
	});
	const [labels, setLabels] = useState<LabelOption[]>([]);
	const [labelsLoading, setLabelsLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const loadLabels = useCallback(async (currentLabelId?: string) => {
		setLabelsLoading(true);
		try {
			const { data: activeLabelsData } = await supabase
				.from('project_labels')
				.select('id, name, domain_id')
				.eq('is_active', true)
				.order('name');

			let labelsData = activeLabelsData ?? [];
			const hasCurrentLabel = !!currentLabelId && labelsData.some((l) => l.id === currentLabelId);

			// If the project currently points to an inactive label, still include it so edit form can show it.
			if (currentLabelId && !hasCurrentLabel) {
				const { data: currentLabel } = await supabase
					.from('project_labels')
					.select('id, name, domain_id')
					.eq('id', currentLabelId)
					.maybeSingle();
				if (currentLabel) {
					labelsData = [currentLabel, ...labelsData];
				}
			}

			if (labelsData.length === 0) {
				setLabels([]);
				return;
			}

			const domainIds = [...new Set(labelsData.map((l) => l.domain_id))];
			const { data: domains } = await supabase.from('project_domains').select('id, name').in('id', domainIds);
			const domainMap = new Map((domains ?? []).map((d) => [d.id, d.name]));

			setLabels(
				labelsData.map((l) => ({
					id: l.id,
					name: l.name,
					domain_name: domainMap.get(l.domain_id) ?? '—',
				})),
			);
		} finally {
			setLabelsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (open) {
			if (project) {
				setForm({
					id: project.id,
					name: project.name,
					label_id: project.label_id,
					owner_user_id: project.owner_user_id,
					cost_center: project.cost_center ?? '',
					description: project.description ?? '',
					is_active: project.is_active,
				});
			} else {
				setForm({
					name: '',
					label_id: '',
					owner_user_id: '',
					cost_center: '',
					description: '',
					is_active: true,
				});
			}
			void loadLabels(project?.label_id).then(() => {
				// Ensure Select re-syncs with the current project label after async options load.
				if (project?.label_id) {
					setForm((prev) => ({ ...prev, label_id: project.label_id }));
				}
			});
		}
	}, [open, project, loadLabels]);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!form.name.trim() || !form.label_id || !form.owner_user_id) {
				toast.error('Vul alle verplichte velden in');
				return;
			}

			setSaving(true);

			const payload = {
				name: form.name.trim(),
				label_id: form.label_id,
				owner_user_id: form.owner_user_id,
				cost_center: form.cost_center.trim() || null,
				description: form.description.trim() || null,
				is_active: form.is_active,
			};

			if (isEditing && form.id) {
				const { error } = await supabase.from('projects').update(payload).eq('id', form.id);
				if (error) {
					toast.error('Fout bij bijwerken project', { description: error.message });
					setSaving(false);
					return;
				}
				toast.success('Project bijgewerkt');
			} else {
				const { error } = await supabase.from('projects').insert(payload);
				if (error) {
					toast.error('Fout bij aanmaken project', { description: error.message });
					setSaving(false);
					return;
				}
				toast.success('Project aangemaakt');
			}

			setSaving(false);
			onOpenChange(false);
			onSaved();
		},
		[form, isEditing, onOpenChange, onSaved],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>{isEditing ? 'Project bewerken' : 'Nieuw project'}</DialogTitle>
						<DialogDescription>
							{isEditing
								? 'Pas de gegevens van het project aan.'
								: 'Vul de gegevens in voor het nieuwe project.'}
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="project-name">Naam *</Label>
							<Input
								id="project-name"
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								placeholder="Projectnaam"
								required
							/>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="project-label">Label *</Label>
							<Select
								key={`${project?.id ?? 'new'}-${labels.length}-${form.label_id}`}
								value={form.label_id}
								onValueChange={(v) => setForm((f) => ({ ...f, label_id: v }))}
							>
								<SelectTrigger id="project-label">
									<SelectValue
										placeholder={labelsLoading ? 'Labels laden...' : 'Selecteer een label'}
									/>
								</SelectTrigger>
								<SelectContent>
									{labels.map((l) => (
										<SelectItem key={l.id} value={l.id}>
											{l.name} ({l.domain_name})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-2">
							<Label>Eigenaar *</Label>
							<UserSelectSingle
								value={form.owner_user_id || null}
								onChange={(user) => setForm((f) => ({ ...f, owner_user_id: user?.user_id ?? '' }))}
								placeholder="Selecteer een eigenaar"
							/>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="project-cost-center">Kostenplaats</Label>
							<Input
								id="project-cost-center"
								value={form.cost_center}
								onChange={(e) => setForm((f) => ({ ...f, cost_center: e.target.value }))}
								placeholder="bijv. KC-101"
							/>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="project-description">Beschrijving</Label>
							<Textarea
								id="project-description"
								value={form.description}
								onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
								placeholder="Optionele beschrijving"
								rows={3}
							/>
						</div>

						{isEditing && (
							<div className="flex items-center gap-2">
								<input
									id="project-active"
									type="checkbox"
									checked={form.is_active}
									onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
									className="h-4 w-4 rounded border-input"
								/>
								<Label htmlFor="project-active">Actief</Label>
							</div>
						)}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Annuleren
						</Button>
						<SubmitButton type="submit" loading={saving}>
							{isEditing ? 'Opslaan' : 'Aanmaken'}
						</SubmitButton>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
