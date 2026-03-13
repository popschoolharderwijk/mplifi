import { useCallback, useEffect, useState } from 'react';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { supabase } from '@/integrations/supabase/client';
import { PostgresErrorCodes } from '@/integrations/supabase/errorcodes';
import type { ProjectDomain } from '@/types/projects';

interface ProjectDomainsManagerProps {
	/** Called after domains list changed (add/update/delete) so sibling components can refresh */
	onDomainsChange?: () => void;
}

export function ProjectDomainsManager({ onDomainsChange }: ProjectDomainsManagerProps = {}) {
	const [domains, setDomains] = useState<ProjectDomain[]>([]);
	const [loading, setLoading] = useState(true);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<ProjectDomain | null>(null);
	const [name, setName] = useState('');
	const [saving, setSaving] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<ProjectDomain | null>(null);

	const fetchDomains = useCallback(async () => {
		const { data, error } = await supabase.from('project_domains').select('*').order('name');
		if (error) {
			toast.error('Fout bij laden domeinen');
		} else {
			setDomains(data ?? []);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		fetchDomains();
	}, [fetchDomains]);

	const openCreate = () => {
		setEditing(null);
		setName('');
		setDialogOpen(true);
	};

	const openEdit = (domain: ProjectDomain) => {
		setEditing(domain);
		setName(domain.name);
		setDialogOpen(true);
	};

	const handleSave = async () => {
		if (!name.trim()) return;
		setSaving(true);

		if (editing) {
			const { error } = await supabase.from('project_domains').update({ name: name.trim() }).eq('id', editing.id);
			if (error) {
				toast.error('Fout bij bijwerken domein');
			} else {
				toast.success('Domein bijgewerkt');
			}
		} else {
			const { error } = await supabase.from('project_domains').insert({ name: name.trim() });
			if (error) {
				toast.error('Fout bij aanmaken domein');
			} else {
				toast.success('Domein aangemaakt');
			}
		}

		setSaving(false);
		setDialogOpen(false);
		await fetchDomains();
		onDomainsChange?.();
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		const { data, error } = await supabase.from('project_domains').delete().eq('id', deleteTarget.id).select('id');
		if (error) {
			const description =
				error.code === PostgresErrorCodes.FOREIGN_KEY_VIOLATION
					? 'Er zijn nog labels aan dit domein gekoppeld. Verwijder eerst die labels of koppel ze aan een ander domein.'
					: 'Geen rechten om dit domein te verwijderen.';
			toast.error('Domein niet verwijderd', { description });
		} else if (!data?.length) {
			toast.error('Domein niet verwijderd', {
				description: 'Geen rechten om dit domein te verwijderen.',
			});
		} else {
			toast.success('Domein verwijderd');
		}
		setDeleteTarget(null);
		await fetchDomains();
		onDomainsChange?.();
	};

	return (
		<Card className="overflow-hidden">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-2.5 px-4">
				<CardTitle className="text-sm font-semibold">Domeinen</CardTitle>
				<Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={openCreate}>
					<LuPlus className="h-3.5 w-3.5" />
					Toevoegen
				</Button>
			</CardHeader>
			<CardContent className="p-0">
				{loading ? (
					<p className="px-4 py-3 text-muted-foreground text-xs">Laden...</p>
				) : domains.length === 0 ? (
					<p className="px-4 py-3 text-muted-foreground text-xs">Geen domeinen</p>
				) : (
					<ul className="divide-y divide-border">
						{domains.map((domain) => (
							<li
								key={domain.id}
								className="flex items-center justify-between gap-2 px-4 py-1.5 text-sm hover:bg-muted/50"
							>
								<span className="truncate">{domain.name}</span>
								<div className="flex shrink-0 gap-0.5">
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7"
										onClick={() => openEdit(domain)}
										aria-label="Bewerken"
									>
										<LuPencil className="h-3.5 w-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-destructive hover:text-destructive"
										onClick={() => setDeleteTarget(domain)}
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
						<DialogTitle>{editing ? 'Domein bewerken' : 'Nieuw domein'}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="domain-name">Naam</Label>
							<Input
								id="domain-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Bijv. Muziek"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Annuleren
						</Button>
						<SubmitButton onClick={handleSave} loading={saving} disabled={!name.trim()}>
							{editing ? 'Opslaan' : 'Aanmaken'}
						</SubmitButton>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmDeleteDialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
				onConfirm={handleDelete}
				title="Domein verwijderen"
				description={`Weet je zeker dat je "${deleteTarget?.name}" wilt verwijderen? Dit kan alleen als er geen labels aan gekoppeld zijn.`}
			/>
		</Card>
	);
}
