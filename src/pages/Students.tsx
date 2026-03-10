import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LessonAgreementItem } from '@/components/students/LessonAgreementItem';
import { StudentFormDialog } from '@/components/students/StudentFormDialog';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { DataTable, type DataTableColumn, type QuickFilterGroup } from '@/components/ui/data-table';
import { getDisplayName, UserDisplay } from '@/components/ui/user-display';
import { NAV_LABELS } from '@/config/nav-labels';
import { useActiveLessonTypes } from '@/hooks/useActiveLessonTypes';
import { useAuth } from '@/hooks/useAuth';
import { useServerTableState } from '@/hooks/useServerTableState';
import { useLessonTypeFilter, useStatusFilter } from '@/hooks/useTableFilters';
import { supabase } from '@/integrations/supabase/client';
import {
	flattenStudentWithAgreements,
	type PaginatedStudentsResponseRaw,
	type StudentWithAgreements,
} from '@/types/students';

export default function Students() {
	const { isAdmin, isSiteAdmin, isPrivileged, isLoading: authLoading } = useAuth();
	const [students, setStudents] = useState<StudentWithAgreements[]>([]);
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
		storageKey: 'students',
		initialSortColumn: 'student',
		initialSortDirection: 'asc',
		initialFilters: { statusFilter: 'all', selectedLessonTypeId: null },
	});

	const statusFilter = (filters.statusFilter as 'all' | 'active' | 'inactive') ?? 'all';
	const selectedLessonTypeId = (filters.selectedLessonTypeId as string | null) ?? null;

	const [deleteDialog, setDeleteDialog] = useState<{
		open: boolean;
		student: StudentWithAgreements | null;
		deleteUser: boolean;
	} | null>(null);
	const [studentFormDialog, setStudentFormDialog] = useState<{
		open: boolean;
		student: StudentWithAgreements | null;
	}>({ open: false, student: null });

	// Check access - only admin, site_admin and staff can view this page
	const hasAccess = isPrivileged;
	const { lessonTypes } = useActiveLessonTypes(hasAccess);

	// Load paginated students
	const loadStudents = useCallback(async () => {
		if (!hasAccess) return;

		setLoading(true);

		try {
			const offset = (currentPage - 1) * rowsPerPage;

			// Map DataTable column keys to database sort column names
			const columnMapping: Record<string, string> = {
				student: 'name',
				phone_number: 'phone_number',
				status: 'status',
				agreements: 'agreements',
			};

			const dbSortColumn = sortColumn ? columnMapping[sortColumn] || 'name' : 'name';

			const { data, error } = await supabase.rpc('get_students_paginated', {
				p_limit: rowsPerPage,
				p_offset: offset,
				p_search: debouncedSearchQuery || null,
				p_status: statusFilter,
				p_lesson_type_id: selectedLessonTypeId,
				p_sort_column: dbSortColumn,
				p_sort_direction: sortDirection || 'asc',
			});

			if (error) {
				console.error('Error loading students:', error);
				toast.error('Fout bij laden leerlingen');
				setLoading(false);
				return;
			}

			const result = data as unknown as PaginatedStudentsResponseRaw;
			setStudents((result.data ?? []).map(flattenStudentWithAgreements));
			setTotalCount(result.total_count ?? 0);
			setLoading(false);
		} catch (error) {
			console.error('Error loading students:', error);
			toast.error('Fout bij laden leerlingen');
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

	// Load students when dependencies change
	useEffect(() => {
		if (!authLoading) {
			loadStudents();
		}
	}, [authLoading, loadStudents]);

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

	const columns: DataTableColumn<StudentWithAgreements>[] = useMemo(
		() => [
			{
				key: 'student',
				label: 'Leerling',
				sortable: true, // Server-side sorting
				className: 'w-64 max-w-64',
				render: (s) => <UserDisplay profile={s} showEmail />,
			},
			{
				key: 'phone_number',
				label: 'Telefoon',
				sortable: true,
				render: (s) => <span className="text-muted-foreground">{s.phone_number || '-'}</span>,
				className: 'text-muted-foreground w-32',
			},
			{
				key: 'status',
				label: 'Status',
				sortable: true,
				render: (s) => (
					<Badge variant={s.active_agreements_count > 0 ? 'default' : 'secondary'}>
						{s.active_agreements_count > 0 ? 'Actief' : 'Inactief'}
					</Badge>
				),
				className: 'w-24',
			},
			{
				key: 'agreements',
				label: 'Lesovereenkomsten',
				sortable: true,
				className: '',
				render: (s) => {
					if (s.agreements.length === 0) {
						return <span className="text-muted-foreground text-sm">-</span>;
					}
					return (
						<div className="flex flex-wrap gap-2">
							{s.agreements.map((agreement) => (
								<LessonAgreementItem
									key={agreement.id}
									agreement={agreement}
									className="flex-shrink-0"
								/>
							))}
						</div>
					);
				},
			},
		],
		[],
	);

	const handleEdit = useCallback((student: StudentWithAgreements) => {
		setStudentFormDialog({ open: true, student });
	}, []);

	const handleDelete = useCallback((student: StudentWithAgreements) => {
		setDeleteDialog({ open: true, student, deleteUser: false });
	}, []);

	const confirmDelete = useCallback(async () => {
		if (!deleteDialog?.student) return;

		try {
			// If also delete user, call delete-user function which will cascade delete everything
			if (deleteDialog.deleteUser) {
				const { error: userDeleteError } = await supabase.functions.invoke('delete-user', {
					body: { userId: deleteDialog.student.user_id },
				});

				if (userDeleteError) {
					console.error('Error deleting user:', userDeleteError);
					toast.error('Fout bij verwijderen gebruiker', {
						description: userDeleteError.message,
					});
					throw new Error(userDeleteError.message);
				}

				toast.success('Leerling en gebruiker verwijderd');
			} else {
				// Delete all lesson agreements first - this will trigger automatic student deletion
				// Students cannot be deleted directly (no DELETE policy), they are automatically
				// deleted via triggers when all lesson_agreements are removed
				const agreementIds = deleteDialog.student.agreements.map((a) => a.id);

				if (agreementIds.length > 0) {
					const { error: agreementsError } = await supabase
						.from('lesson_agreements')
						.delete()
						.in('id', agreementIds);

					if (agreementsError) {
						console.error('Error deleting lesson agreements:', agreementsError);
						toast.error('Fout bij verwijderen lesovereenkomsten', {
							description: agreementsError.message,
						});
						throw new Error(agreementsError.message);
					}
				}

				// The student will be automatically deleted by the trigger when all agreements are removed
				toast.success('Leerling verwijderd');
			}

			// Reload students to get updated data
			setDeleteDialog(null);
			loadStudents();
		} catch (error) {
			console.error('Error deleting student:', error);
			toast.error('Fout bij verwijderen leerling', {
				description: 'Er is een netwerkfout opgetreden. Probeer het later opnieuw.',
			});
			throw error;
		}
	}, [deleteDialog, loadStudents]);

	// Redirect if no access
	if (!authLoading && !hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div>
			<DataTable
				title={NAV_LABELS.students}
				description="Beheer alle leerlingen en hun gegevens"
				data={students}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={handleSearchChange}
				loading={loading}
				getRowKey={(s) => s.user_id}
				emptyMessage="Geen leerlingen gevonden"
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
				rowActions={{
					onEdit: isPrivileged ? handleEdit : undefined,
					onDelete: isAdmin || isSiteAdmin ? handleDelete : undefined,
				}}
			/>

			{/* Create/Edit Student Dialog */}
			<StudentFormDialog
				open={studentFormDialog.open}
				onOpenChange={(open) => setStudentFormDialog({ ...studentFormDialog, open })}
				onSuccess={loadStudents}
				student={studentFormDialog.student ?? undefined}
			/>

			{/* Delete Student Dialog */}
			{deleteDialog && (
				<ConfirmDeleteDialog
					open={deleteDialog.open}
					onOpenChange={(open) => !open && setDeleteDialog(null)}
					title="Leerling verwijderen"
					description={
						<>
							Weet je zeker dat je{' '}
							<strong>
								{deleteDialog.student ? getDisplayName(deleteDialog.student) : 'deze leerling'}
							</strong>{' '}
							wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
						</>
					}
					onConfirm={confirmDelete}
					extraContent={
						<>
							<p className="text-sm text-muted-foreground">
								Alle gegevens van deze leerling worden permanent verwijderd, inclusief{' '}
								{deleteDialog.student?.agreements.length || 0} lesovereenkomst(en).
							</p>
							{deleteDialog.student && deleteDialog.student.agreements.length > 0 && (
								<div className="space-y-2">
									<p className="text-sm font-medium">
										De volgende lesovereenkomsten worden verwijderd:
									</p>
									<div className="max-h-60 overflow-y-auto rounded-md border p-3 space-y-2">
										{deleteDialog.student.agreements.map((agreement) => (
											<LessonAgreementItem
												key={agreement.id}
												agreement={agreement}
												className="w-full"
												readOnly
											/>
										))}
									</div>
								</div>
							)}
							<div className="flex items-center space-x-2">
								<input
									type="checkbox"
									id="delete-user"
									checked={deleteDialog.deleteUser}
									onChange={(e) => setDeleteDialog({ ...deleteDialog, deleteUser: e.target.checked })}
									className="h-4 w-4 rounded border-gray-300"
								/>
								<label htmlFor="delete-user" className="text-sm font-medium">
									Ook de gebruiker verwijderen
								</label>
							</div>
						</>
					}
				/>
			)}
		</div>
	);
}
