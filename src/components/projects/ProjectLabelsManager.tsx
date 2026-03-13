import { useCallback, useEffect, useState } from 'react';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubmitButton } from '@/components/ui/submit-button';
import { supabase } from '@/integrations/supabase/client';
import { PostgresErrorCodes } from '@/integrations/supabase/errorcodes';
import type { ProjectDomain, ProjectLabel } from '@/types/projects';

type LabelWithDomain = ProjectLabel & { project_domains: { name: string } | null };

interface ProjectLabelsManagerProps {
	/** Called with the refetch function so the parent can trigger a refresh (e.g. when domains change in a sibling) */
	registerRefetch?: (refetch: () => void) => void;
}

export function ProjectLabelsManager({ registerRefetch }: ProjectLabelsManagerProps = {}) {
	const [labels, setLabels] = useState<LabelWithDomain[]>([]);
	const [domains, setDomains] = useState<ProjectDomain[]>([]);
	const [loading, setLoading] = useState(true);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<LabelWithDomain | null>(null);
	const [name, setName] = useState('');
	const [domainId, setDomainId] = useState('');
	const [saving, setSaving] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<LabelWithDomain | null>(null);

	const fetchData = useCallback(async () => {
		const [labelsRes, domainsRes] = await Promise.all([
			supabase.from('project_labels').select('*, project_domains(name)').order('name'),
			supabase.from('project_domains').select('*').eq('is_active', true).order('name'),
		]);

		if (labelsRes.error) {
			toast.error('Fout bij laden labels');
		} else {
			setLabels(labelsRes.data ?? []);
		}
		setDomains(domainsRes.data ?? []);
		setLoading(false);
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	useEffect(() => {
		registerRefetch?.(fetchData);
	}, [registerRefetch, fetchData]);

	const openCreate = () => {
		setEditing(null);
		setName('');
		setDomainId('');
		setDialogOpen(true);
	};

	const openEdit = (label: LabelWithDomain) => {
		setEditing(label);
		setName(label.name);
		setDomainId(label.domain_id);
		setDialogOpen(true);
	};

	const handleSave = async () => {
		if (!name.trim() || !domainId) return;
		setSaving(true);

		if (editing) {
			const { error } = await supabase
				.from('project_labels')
				.update({ name: name.trim(), domain_id: domainId })
				.eq('id', editing.id);
			if (error) {
				toast.error('Fout bij bijwerken label');
			} else {
				toast.success('Label bijgewerkt');
			}
		} else {
			const { error } = await supabase.from('project_labels').insert({ name: name.trim(), domain_id: domainId });
			if (error) {
				toast.error('Fout bij aanmaken label');
			} else {
				toast.success('Label aangemaakt');
			}
		}

		setSaving(false);
		setDialogOpen(false);
		fetchData();
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		// Pre-check for linked projects so we can show a clear message (otherwise FK/RLS may return 0 rows with no error).
		const { data: linkedProjects } = await supabase
			.from('projects')
			.select('id')
			.eq('label_id', deleteTarget.id)
			.limit(1);
		if (linkedProjects?.length) {
			toast.error('Label niet verwijderd', {
				description: 'Er zijn nog projecten aan dit label gekoppeld.',
			});
			setDeleteTarget(null);
			return;
		}
		const { data, error } = await supabase.from('project_labels').delete().eq('id', deleteTarget.id).select('id');
		if (error) {
			const isForeignKeyViolation = error.code === PostgresErrorCodes.FOREIGN_KEY_VIOLATION;
			toast.error('Fout bij verwijderen label', {
				description: isForeignKeyViolation
					? 'Er zijn nog projecten aan dit label gekoppeld.'
					: 'Geen rechten om dit label te verwijderen.',
			});
		} else if (!data?.length) {
			toast.error('Label niet verwijderd', {
				description: 'Geen rechten om dit label te verwijderen.',
			});
		} else {
			toast.success('Label verwijderd');
		}
		setDeleteTarget(null);
		fetchData();
	};

	return (
		<Card className="overflow-hidden">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-2.5 px-4">
				<CardTitle className="text-sm font-semibold">Labels</CardTitle>
				<Button
					variant="outline"
					size="sm"
					className="h-7 gap-1 text-xs"
					onClick={openCreate}
					disabled={domains.length === 0}
				>
					<LuPlus className="h-3.5 w-3.5" />
					Toevoegen
				</Button>
			</CardHeader>
			<CardContent className="p-0">
				{loading ? (
					<p className="px-4 py-3 text-muted-foreground text-xs">Laden...</p>
				) : labels.length === 0 ? (
					<p className="px-4 py-3 text-muted-foreground text-xs">Geen labels</p>
				) : (
					<ul className="divide-y divide-border">
						{labels.map((label) => (
							<li
								key={label.id}
								className="flex items-center justify-between gap-2 px-4 py-1.5 text-sm hover:bg-muted/50"
							>
								<div className="flex min-w-0 items-center gap-1.5">
									<span className="truncate">{label.name}</span>
									{label.project_domains && (
										<Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
											{label.project_domains.name}
										</Badge>
									)}
								</div>
								<div className="flex shrink-0 gap-0.5">
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7"
										onClick={() => openEdit(label)}
										aria-label="Bewerken"
									>
										<LuPencil className="h-3.5 w-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-destructive hover:text-destructive"
										onClick={() => setDeleteTarget(label)}
										aria-label="Verwijderen"
									>
										<LuTrash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editing ? 'Label bewerken' : 'Nieuw label'}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="label-name">Naam</Label>
							<Input
								id="label-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Bijv. Pianolessen"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="label-domain">Domein</Label>
							<Select value={domainId} onValueChange={setDomainId}>
								<SelectTrigger>
									<SelectValue placeholder="Selecteer een domein" />
								</SelectTrigger>
								<SelectContent>
									{domains.map((d) => (
										<SelectItem key={d.id} value={d.id}>
											{d.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Annuleren
						</Button>
						<SubmitButton onClick={handleSave} loading={saving} disabled={!name.trim() || !domainId}>
							{editing ? 'Opslaan' : 'Aanmaken'}
						</SubmitButton>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmDeleteDialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
				onConfirm={handleDelete}
				title="Label verwijderen"
				description={`Weet je zeker dat je "${deleteTarget?.name}" wilt verwijderen? Dit kan alleen als er geen projecten aan gekoppeld zijn.`}
			/>
		</Card>
	);
}
