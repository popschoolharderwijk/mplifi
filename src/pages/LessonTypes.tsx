import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuLoaderCircle, LuPlus, LuTriangleAlert } from 'react-icons/lu';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LessonTypeFormDialog } from '@/components/lesson-types/LessonTypeFormDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColorIcon } from '@/components/ui/color-icon';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { resolveIconFromList } from '@/components/ui/icon-picker';
import { MUSIC_ICONS } from '@/constants/icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type LessonFrequency = 'weekly' | 'biweekly' | 'monthly';

interface LessonType {
	id: string;
	name: string;
	description: string | null;
	icon: string;
	color: string;
	duration_minutes: number;
	frequency: LessonFrequency;
	price_per_lesson: number;
	cost_center: string | null;
	is_group_lesson: boolean;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

const frequencyLabels: Record<LessonFrequency, string> = {
	weekly: 'Wekelijks',
	biweekly: 'Tweewekelijks',
	monthly: 'Maandelijks',
};

export default function LessonTypes() {
	const { isAdmin, isSiteAdmin, isLoading: authLoading } = useAuth();
	const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [deleteDialog, setDeleteDialog] = useState<{
		open: boolean;
		lessonType: LessonType | null;
	} | null>(null);
	const [lessonTypeFormDialog, setLessonTypeFormDialog] = useState<{
		open: boolean;
		lessonType: LessonType | null;
	}>({ open: false, lessonType: null });
	const [deletingLessonType, setDeletingLessonType] = useState(false);

	// Check access - only admin and site_admin can view this page
	const hasAccess = isAdmin || isSiteAdmin;

	const loadLessonTypes = useCallback(async () => {
		if (!hasAccess) return;

		setLoading(true);

		const { data, error } = await supabase.from('lesson_types').select('*').order('name', { ascending: true });

		if (error) {
			console.error('Error loading lesson types:', error);
			toast.error('Fout bij laden lessoorten');
			setLoading(false);
			return;
		}

		setLessonTypes(data ?? []);
		setLoading(false);
	}, [hasAccess]);

	useEffect(() => {
		if (!authLoading) {
			loadLessonTypes();
		}
	}, [authLoading, loadLessonTypes]);

	const columns: DataTableColumn<LessonType>[] = useMemo(
		() => [
			{
				key: 'name',
				label: 'Naam',
				sortable: true,
				sortValue: (lt) => lt.name.toLowerCase(),
				render: (lt) => {
					const Icon = lt.icon ? resolveIconFromList(MUSIC_ICONS, lt.icon) : undefined;
					return (
						<div className="flex items-center gap-3">
							<ColorIcon icon={Icon} color={lt.color} />
							<div>
								<p className="font-medium">{lt.name}</p>
								{lt.description && <p className="text-xs text-muted-foreground">{lt.description}</p>}
							</div>
						</div>
					);
				},
			},
			{
				key: 'duration',
				label: 'Duur',
				sortable: true,
				sortValue: (lt) => lt.duration_minutes,
				render: (lt) => <span className="text-muted-foreground">{lt.duration_minutes} min</span>,
				className: 'text-muted-foreground',
			},
			{
				key: 'frequency',
				label: 'Frequentie',
				sortable: true,
				sortValue: (lt) => lt.frequency,
				render: (lt) => <span className="text-muted-foreground">{frequencyLabels[lt.frequency]}</span>,
				className: 'text-muted-foreground',
			},
			{
				key: 'price',
				label: 'Prijs / les',
				sortable: true,
				sortValue: (lt) => lt.price_per_lesson,
				render: (lt) => <span className="text-muted-foreground">€{lt.price_per_lesson.toFixed(2)}</span>,
				className: 'text-muted-foreground',
			},
			{
				key: 'type',
				label: 'Type',
				sortable: true,
				sortValue: (lt) => (lt.is_group_lesson ? 1 : 0),
				render: (lt) => (
					<Badge variant={lt.is_group_lesson ? 'default' : 'secondary'}>
						{lt.is_group_lesson ? 'Groepsles' : 'Individueel'}
					</Badge>
				),
			},
			{
				key: 'status',
				label: 'Status',
				sortable: true,
				sortValue: (lt) => (lt.is_active ? 1 : 0),
				render: (lt) => (
					<Badge variant={lt.is_active ? 'default' : 'secondary'}>
						{lt.is_active ? 'Actief' : 'Inactief'}
					</Badge>
				),
			},
		],
		[],
	);

	const handleEdit = useCallback((lessonType: LessonType) => {
		setLessonTypeFormDialog({ open: true, lessonType });
	}, []);

	const handleCreate = useCallback(() => {
		setLessonTypeFormDialog({ open: true, lessonType: null });
	}, []);

	const handleDelete = useCallback((lessonType: LessonType) => {
		setDeleteDialog({ open: true, lessonType });
	}, []);

	const confirmDelete = useCallback(async () => {
		if (!deleteDialog?.lessonType) return;

		setDeletingLessonType(true);

		try {
			const { error } = await supabase.from('lesson_types').delete().eq('id', deleteDialog.lessonType.id);

			if (error) {
				toast.error('Fout bij verwijderen lessoort', {
					description: error.message,
				});
				return;
			}

			toast.success('Lessoort verwijderd', {
				description: `${deleteDialog.lessonType.name} is verwijderd.`,
			});

			// Remove from local state
			setLessonTypes((prev) => prev.filter((lt) => lt.id !== deleteDialog.lessonType?.id));
			setDeleteDialog(null);
		} catch (error) {
			console.error('Error deleting lesson type:', error);
			toast.error('Fout bij verwijderen lessoort', {
				description: 'Er is een netwerkfout opgetreden. Probeer het later opnieuw.',
			});
		} finally {
			setDeletingLessonType(false);
		}
	}, [deleteDialog]);

	// Redirect if no access
	if (!hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div>
			<DataTable
				title="Lessoorten"
				description="Beheer alle lessoorten en hun configuratie"
				data={lessonTypes}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				searchFields={[
					(lt) => lt.name,
					(lt) => lt.description ?? undefined,
					(lt) => lt.cost_center ?? undefined,
				]}
				loading={loading}
				getRowKey={(lt) => lt.id}
				emptyMessage="Geen lessoorten gevonden"
				initialSortColumn="name"
				initialSortDirection="asc"
				headerActions={
					<Button onClick={handleCreate}>
						<LuPlus className="mr-2 h-4 w-4" />
						Lessoort toevoegen
					</Button>
				}
				rowActions={{
					onEdit: handleEdit,
					onDelete: handleDelete,
				}}
			/>

			{/* Create/Edit Lesson Type Dialog */}
			<LessonTypeFormDialog
				open={lessonTypeFormDialog.open}
				onOpenChange={(open) => setLessonTypeFormDialog({ ...lessonTypeFormDialog, open })}
				onSuccess={loadLessonTypes}
				lessonType={lessonTypeFormDialog.lessonType ?? undefined}
			/>

			{/* Delete Lesson Type Dialog */}
			{deleteDialog && (
				<Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<LuTriangleAlert className="h-5 w-5 text-destructive" />
								Lessoort verwijderen
							</DialogTitle>
							<DialogDescription>
								Weet je zeker dat je <strong>{deleteDialog.lessonType?.name}</strong> wilt verwijderen?
								Deze actie kan niet ongedaan worden gemaakt.
							</DialogDescription>
						</DialogHeader>
						<div className="py-4">
							<p className="text-sm text-muted-foreground">
								Alle gegevens van deze lessoort worden permanent verwijderd.
							</p>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setDeleteDialog(null)}
								disabled={deletingLessonType}
							>
								Annuleren
							</Button>
							<Button variant="destructive" onClick={confirmDelete} disabled={deletingLessonType}>
								{deletingLessonType ? (
									<>
										<LuLoaderCircle className="mr-2 h-4 w-4 animate-spin" />
										Verwijderen...
									</>
								) : (
									'Verwijderen'
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
