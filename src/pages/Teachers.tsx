import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuLoaderCircle, LuPlus, LuTriangleAlert } from 'react-icons/lu';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { TeacherFormDialog } from '@/components/teachers/TeacherFormDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColorIcon } from '@/components/ui/color-icon';
import { DataTable, type DataTableColumn, type QuickFilterGroup } from '@/components/ui/data-table';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { resolveIconFromList } from '@/components/ui/icon-picker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MUSIC_ICONS } from '@/constants/icons';
import { useAuth } from '@/hooks/useAuth';
import { useServerTableState } from '@/hooks/useServerTableState';
import { type LessonType, useLessonTypeFilter, useStatusFilter } from '@/hooks/useTableFilters';
import { supabase } from '@/integrations/supabase/client';
import type { PaginatedTeachersResponse, TeacherWithProfileAndLessonTypes } from '@/types/teachers';

export default function Teachers() {
	const { isAdmin, isSiteAdmin, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const [teachers, setTeachers] = useState<TeacherWithProfileAndLessonTypes[]>([]);
	const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
	const [loading, setLoading] = useState(true);
	const [totalCount, setTotalCount] = useState(0);

	// Filter state
	const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
	const statusFilter = activeFilter;
	const setStatusFilter = setActiveFilter;
	const [selectedLessonTypeId, setSelectedLessonTypeId] = useState<string | null>(null);

	// Server-side table state (pagination, sorting, search)
	const {
		searchQuery,
		debouncedSearchQuery,
		handleSearchChange,
		currentPage,
		rowsPerPage,
		handlePageChange,
		handleRowsPerPageChange,
		sortColumn,
		sortDirection,
		handleSortChange,
	} = useServerTableState({
		initialSortColumn: 'teacher',
		initialSortDirection: 'asc',
		additionalFilters: { statusFilter, selectedLessonTypeId },
	});

	const [deleteDialog, setDeleteDialog] = useState<{
		open: boolean;
		teacher: TeacherWithProfileAndLessonTypes | null;
	} | null>(null);
	const [teacherFormDialog, setTeacherFormDialog] = useState<{
		open: boolean;
		teacher: TeacherWithProfileAndLessonTypes | null;
	}>({ open: false, teacher: null });
	const [deletingTeacher, setDeletingTeacher] = useState(false);

	// Check access - only admin and site_admin can view this page
	const hasAccess = isAdmin || isSiteAdmin;

	// Load lesson types (only once)
	useEffect(() => {
		if (!hasAccess) return;

		const loadLessonTypes = async () => {
			const { data, error } = await supabase
				.from('lesson_types')
				.select('id, name, icon, color')
				.eq('is_active', true)
				.order('name', { ascending: true });

			if (error) {
				console.error('Error loading lesson types:', error);
			} else {
				setLessonTypes(data ?? []);
			}
		};

		loadLessonTypes();
	}, [hasAccess]);

	// Load paginated teachers
	const loadTeachers = useCallback(async () => {
		if (!hasAccess) return;

		setLoading(true);

		try {
			const offset = (currentPage - 1) * rowsPerPage;

			// Map DataTable column keys to database sort column names
			const columnMapping: Record<string, string> = {
				teacher: 'name',
				phone_number: 'phone_number',
				is_active: 'status',
				created_at: 'created_at',
			};

			const dbSortColumn = sortColumn ? columnMapping[sortColumn] || 'name' : 'name';

			const { data, error } = await supabase.rpc('get_teachers_paginated', {
				p_limit: rowsPerPage,
				p_offset: offset,
				p_search: debouncedSearchQuery || null,
				p_status: statusFilter,
				p_lesson_type_id: selectedLessonTypeId,
				p_sort_column: dbSortColumn,
				p_sort_direction: sortDirection || 'asc',
			});

			if (error) {
				console.error('Error loading teachers:', error);
				toast.error('Fout bij laden docenten');
				setLoading(false);
				return;
			}

			const result = data as unknown as PaginatedTeachersResponse;
			setTeachers(result.data ?? []);
			setTotalCount(result.total_count ?? 0);
			setLoading(false);
		} catch (error) {
			console.error('Error loading teachers:', error);
			toast.error('Fout bij laden docenten');
			setLoading(false);
		}
	}, [
		hasAccess,
		currentPage,
		rowsPerPage,
		debouncedSearchQuery,
		statusFilter,
		selectedLessonTypeId,
		sortColumn,
		sortDirection,
	]);

	// Load teachers when dependencies change
	useEffect(() => {
		if (!authLoading) {
			loadTeachers();
		}
	}, [authLoading, loadTeachers]);

	// Helper functions
	const getUserInitials = useCallback((t: TeacherWithProfileAndLessonTypes) => {
		const profile = t.profile;
		if (profile.first_name && profile.last_name) {
			return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
		}
		if (profile.first_name) {
			return profile.first_name.slice(0, 2).toUpperCase();
		}
		return profile.email.slice(0, 2).toUpperCase();
	}, []);

	const getDisplayName = useCallback((t: TeacherWithProfileAndLessonTypes) => {
		const profile = t.profile;
		if (profile.first_name && profile.last_name) {
			return `${profile.first_name} ${profile.last_name}`;
		}
		if (profile.first_name) {
			return profile.first_name;
		}
		return profile.email;
	}, []);

	// Quick filter groups configuration
	const statusFilterGroup = useStatusFilter(statusFilter, setStatusFilter);
	const lessonTypeFilterGroup = useLessonTypeFilter(lessonTypes, selectedLessonTypeId, setSelectedLessonTypeId);

	const quickFilterGroups: QuickFilterGroup[] = useMemo(() => {
		const groups: QuickFilterGroup[] = [statusFilterGroup];
		if (lessonTypeFilterGroup) {
			groups.push(lessonTypeFilterGroup);
		}
		return groups;
	}, [statusFilterGroup, lessonTypeFilterGroup]);

	const columns: DataTableColumn<TeacherWithProfileAndLessonTypes>[] = useMemo(
		() => [
			{
				key: 'teacher',
				label: 'Docent',
				sortable: true, // Server-side sorting
				render: (t) => (
					<div className="flex items-center gap-3">
						<Avatar className="h-9 w-9">
							<AvatarImage src={t.profile.avatar_url ?? undefined} alt={getDisplayName(t)} />
							<AvatarFallback className="bg-primary/10 text-primary text-sm">
								{getUserInitials(t)}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-medium">{getDisplayName(t)}</p>
							<p className="text-xs text-muted-foreground">{t.profile.email}</p>
						</div>
					</div>
				),
			},
			{
				key: 'phone_number',
				label: 'Telefoonnummer',
				sortable: true,
				render: (t) => <span className="text-muted-foreground">{t.profile.phone_number || '-'}</span>,
				className: 'text-muted-foreground',
			},
			{
				key: 'lesson_types',
				label: 'Lessoorten',
				sortable: false,
				render: (t) => {
					if (t.lesson_types.length === 0) {
						return <span className="text-muted-foreground text-sm">-</span>;
					}

					return (
						<TooltipProvider>
							<div className="flex items-center gap-1.5">
								{t.lesson_types.map((lt) => {
									const Icon = lt.icon ? resolveIconFromList(MUSIC_ICONS, lt.icon) : undefined;
									return (
										<Tooltip key={lt.id}>
											<TooltipTrigger asChild>
												<div className="cursor-help">
													<ColorIcon icon={Icon} color={lt.color} size="md" />
												</div>
											</TooltipTrigger>
											<TooltipContent>
												<p>{lt.name}</p>
											</TooltipContent>
										</Tooltip>
									);
								})}
							</div>
						</TooltipProvider>
					);
				},
			},
			{
				key: 'is_active',
				label: 'Status',
				sortable: true,
				render: (t) => (
					<Badge variant={t.is_active ? 'default' : 'secondary'}>{t.is_active ? 'Actief' : 'Inactief'}</Badge>
				),
			},
			{
				key: 'created_at',
				label: 'Aangemaakt',
				sortable: true,
				render: (t) => {
					const date = new Date(t.created_at);
					return (
						<span className="text-muted-foreground">
							{date.toLocaleDateString('nl-NL')}{' '}
							{date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
						</span>
					);
				},
				className: 'text-muted-foreground',
			},
		],
		[getUserInitials, getDisplayName],
	);

	const handleEdit = useCallback(
		(teacher: TeacherWithProfileAndLessonTypes) => {
			navigate(`/teachers/${teacher.id}`);
		},
		[navigate],
	);

	const handleCreate = useCallback(() => {
		setTeacherFormDialog({ open: true, teacher: null });
	}, []);

	const handleDelete = useCallback((teacher: TeacherWithProfileAndLessonTypes) => {
		setDeleteDialog({ open: true, teacher });
	}, []);

	const confirmDelete = useCallback(async () => {
		if (!deleteDialog?.teacher) return;

		setDeletingTeacher(true);

		try {
			const { error } = await supabase.from('teachers').delete().eq('id', deleteDialog.teacher.id);

			if (error) {
				console.error('Error deleting teacher:', error);
				toast.error('Fout bij verwijderen docent', {
					description: error.message,
				});
				return;
			}

			toast.success('Docent verwijderd', {
				description: `${getDisplayName(deleteDialog.teacher)} is verwijderd.`,
			});

			// Reload teachers to get updated data
			setDeleteDialog(null);
			loadTeachers();
		} catch (error) {
			console.error('Error deleting teacher:', error);
			toast.error('Fout bij verwijderen docent', {
				description: 'Er is een netwerkfout opgetreden. Probeer het later opnieuw.',
			});
		} finally {
			setDeletingTeacher(false);
		}
	}, [deleteDialog, getDisplayName, loadTeachers]);

	// Redirect if no access
	if (!hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div>
			<DataTable
				title="Docenten"
				description="Beheer alle docenten en hun profielgegevens"
				data={teachers}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={handleSearchChange}
				loading={loading}
				getRowKey={(t) => t.id}
				emptyMessage="Geen docenten gevonden"
				quickFilter={quickFilterGroups}
				serverPagination={{
					totalCount,
					currentPage,
					rowsPerPage,
					onPageChange: handlePageChange,
					onRowsPerPageChange: handleRowsPerPageChange,
				}}
				initialSortColumn={sortColumn || undefined}
				initialSortDirection={sortDirection || undefined}
				onSortChange={handleSortChange}
				headerActions={
					<Button onClick={handleCreate}>
						<LuPlus className="mr-2 h-4 w-4" />
						Docent toevoegen
					</Button>
				}
				rowActions={{
					onEdit: handleEdit,
					onDelete: handleDelete,
				}}
			/>

			{/* Create/Edit Teacher Dialog */}
			<TeacherFormDialog
				open={teacherFormDialog.open}
				onOpenChange={(open) => setTeacherFormDialog({ ...teacherFormDialog, open })}
				onSuccess={loadTeachers}
				teacher={teacherFormDialog.teacher ?? undefined}
			/>

			{/* Delete Teacher Dialog */}
			{deleteDialog && (
				<Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<LuTriangleAlert className="h-5 w-5 text-destructive" />
								Docent verwijderen
							</DialogTitle>
							<DialogDescription>
								Weet je zeker dat je <strong>{getDisplayName(deleteDialog.teacher)}</strong> wilt
								verwijderen? Deze actie kan niet ongedaan worden gemaakt.
							</DialogDescription>
						</DialogHeader>
						<div className="py-4">
							<p className="text-sm text-muted-foreground">
								Alle gegevens van deze docent worden permanent verwijderd, inclusief beschikbaarheid en
								lesovereenkomsten.
							</p>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={deletingTeacher}>
								Annuleren
							</Button>
							<Button variant="destructive" onClick={confirmDelete} disabled={deletingTeacher}>
								{deletingTeacher ? (
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
