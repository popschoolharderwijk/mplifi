import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuPlus } from 'react-icons/lu';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { TeacherFormDialog } from '@/components/teachers/TeacherFormDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { DataTable, type DataTableColumn, type QuickFilterGroup } from '@/components/ui/data-table';
import { LessonTypeBadge } from '@/components/ui/lesson-type-badge';
import { getDisplayName, UserDisplay } from '@/components/ui/user-display';
import { NAV_LABELS } from '@/config/nav-labels';
import { useActiveLessonTypes } from '@/hooks/useActiveLessonTypes';
import { useAuth } from '@/hooks/useAuth';
import { useServerTableState } from '@/hooks/useServerTableState';
import { useLessonTypeFilter, useStatusFilter } from '@/hooks/useTableFilters';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTimeShort } from '@/lib/date/date-format';
import {
	flattenTeacherWithLessonTypes,
	type PaginatedTeachersResponseRaw,
	type TeacherWithLessonTypes,
} from '@/types/teachers';

export default function Teachers() {
	const { isAdmin, isSiteAdmin, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const [teachers, setTeachers] = useState<TeacherWithLessonTypes[]>([]);
	const [loading, setLoading] = useState(true);
	const [totalCount, setTotalCount] = useState(0);

	// Server-side table state (pagination, sorting, search, filters)
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
		filters,
		setFilters,
	} = useServerTableState({
		storageKey: 'teachers',
		initialSortColumn: 'teacher',
		initialSortDirection: 'asc',
		initialFilters: { statusFilter: 'all', selectedLessonTypeId: null },
	});

	const statusFilter = (filters.statusFilter as 'all' | 'active' | 'inactive') ?? 'all';
	const selectedLessonTypeId = (filters.selectedLessonTypeId as string | null) ?? null;

	const [deleteDialog, setDeleteDialog] = useState<{
		open: boolean;
		teacher: TeacherWithLessonTypes | null;
	} | null>(null);
	const [teacherFormDialog, setTeacherFormDialog] = useState<{
		open: boolean;
		teacher: TeacherWithLessonTypes | null;
	}>({ open: false, teacher: null });

	// Check access - only admin and site_admin can view this page
	const hasAccess = isAdmin || isSiteAdmin;
	const { lessonTypes } = useActiveLessonTypes(hasAccess);

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

			const result = data as unknown as PaginatedTeachersResponseRaw;
			setTeachers((result.data ?? []).map(flattenTeacherWithLessonTypes));
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

	// Quick filter groups configuration
	const statusFilterGroup = useStatusFilter(statusFilter, (v) =>
		setFilters((prev) => ({ ...prev, statusFilter: v })),
	);
	const lessonTypeFilterGroup = useLessonTypeFilter(lessonTypes, selectedLessonTypeId, (v) =>
		setFilters((prev) => ({ ...prev, selectedLessonTypeId: v })),
	);

	const quickFilterGroups: QuickFilterGroup[] = useMemo(() => {
		const groups: QuickFilterGroup[] = [statusFilterGroup];
		if (lessonTypeFilterGroup) {
			groups.push(lessonTypeFilterGroup);
		}
		return groups;
	}, [statusFilterGroup, lessonTypeFilterGroup]);

	const columns: DataTableColumn<TeacherWithLessonTypes>[] = useMemo(
		() => [
			{
				key: 'teacher',
				label: 'Docent',
				sortable: true, // Server-side sorting
				render: (t) => <UserDisplay profile={t} showEmail />,
			},
			{
				key: 'phone_number',
				label: 'Telefoonnummer',
				sortable: true,
				render: (t) => <span className="text-muted-foreground">{t.phone_number || '-'}</span>,
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
						<div className="flex items-center gap-1.5">
							{t.lesson_types.map((lt) => (
								<LessonTypeBadge key={lt.id} lessonType={lt} showName={false} />
							))}
						</div>
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
				render: (t) => (
					<span className="text-muted-foreground">{formatDateTimeShort(new Date(t.created_at))}</span>
				),
				className: 'text-muted-foreground',
			},
		],
		[],
	);

	const handleEdit = useCallback(
		(teacher: TeacherWithLessonTypes) => {
			navigate(`/teachers/${teacher.user_id}`);
		},
		[navigate],
	);

	const handleCreate = useCallback(() => {
		setTeacherFormDialog({ open: true, teacher: null });
	}, []);

	const handleDelete = useCallback((teacher: TeacherWithLessonTypes) => {
		setDeleteDialog({ open: true, teacher });
	}, []);

	const confirmDelete = useCallback(async () => {
		if (!deleteDialog?.teacher) return;

		try {
			const { error } = await supabase.from('teachers').delete().eq('user_id', deleteDialog.teacher.user_id);

			if (error) {
				console.error('Error deleting teacher:', error);
				toast.error('Fout bij verwijderen docent', {
					description: error.message,
				});
				throw new Error(error.message);
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
			throw error;
		}
	}, [deleteDialog, loadTeachers]);

	// Redirect if no access
	if (!hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div>
			<DataTable
				title={NAV_LABELS.teachers}
				description="Beheer alle docenten en hun profielgegevens"
				data={teachers}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={handleSearchChange}
				loading={loading}
				getRowKey={(t) => t.user_id}
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
				onSuccess={(teacherUserId) => {
					loadTeachers();
					if (teacherUserId) {
						navigate(`/teachers/${teacherUserId}`);
					}
				}}
				teacher={teacherFormDialog.teacher ?? undefined}
			/>

			{/* Delete Teacher Dialog */}
			{deleteDialog && (
				<ConfirmDeleteDialog
					open={deleteDialog.open}
					onOpenChange={(open) => !open && setDeleteDialog(null)}
					title="Docent verwijderen"
					description={
						<>
							Weet je zeker dat je <strong>{getDisplayName(deleteDialog.teacher)}</strong> wilt
							verwijderen? Deze actie kan niet ongedaan worden gemaakt.
							<p className="mt-2 text-muted-foreground">
								Alle gegevens van deze docent worden permanent verwijderd, inclusief beschikbaarheid en
								lesovereenkomsten.
							</p>
						</>
					}
					onConfirm={confirmDelete}
				/>
			)}
		</div>
	);
}
