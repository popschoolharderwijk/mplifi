import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type LessonAgreement, LessonAgreementItem } from '@/components/students/LessonAgreementItem';
import { StudentFormDialog } from '@/components/students/StudentFormDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn, type QuickFilterGroup } from '@/components/ui/data-table';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useServerTableState } from '@/hooks/useServerTableState';
import { type LessonType, useLessonTypeFilter, useStatusFilter } from '@/hooks/useTableFilters';
import { supabase } from '@/integrations/supabase/client';

interface StudentProfile {
	email: string;
	first_name: string | null;
	last_name: string | null;
	phone_number: string | null;
	avatar_url: string | null;
}

interface StudentWithProfile {
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
	created_at: string;
	updated_at: string;
	profile: StudentProfile;
	active_agreements_count: number;
	agreements: LessonAgreement[];
}

interface PaginatedStudentsResponse {
	data: StudentWithProfile[];
	total_count: number;
	limit: number;
	offset: number;
}

export default function Students() {
	const { isAdmin, isSiteAdmin, isStaff, isLoading: authLoading } = useAuth();
	const [students, setStudents] = useState<StudentWithProfile[]>([]);
	const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
	const [loading, setLoading] = useState(true);
	const [totalCount, setTotalCount] = useState(0);

	// Filter state
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
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
		initialSortColumn: 'student',
		initialSortDirection: 'asc',
		additionalFilters: { statusFilter, selectedLessonTypeId },
	});

	const [deleteDialog, setDeleteDialog] = useState<{
		open: boolean;
		student: StudentWithProfile | null;
		deleteUser: boolean;
	} | null>(null);
	const [studentFormDialog, setStudentFormDialog] = useState<{
		open: boolean;
		student: StudentWithProfile | null;
	}>({ open: false, student: null });
	const [deletingStudent, setDeletingStudent] = useState(false);

	// Check access - only admin, site_admin and staff can view this page
	const hasAccess = isAdmin || isSiteAdmin || isStaff;

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

			const result = data as unknown as PaginatedStudentsResponse;
			setStudents(result.data ?? []);
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

	// Helper functions
	const getUserInitials = useCallback((s: StudentWithProfile) => {
		const profile = s.profile;
		if (profile.first_name && profile.last_name) {
			return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
		}
		if (profile.first_name) {
			return profile.first_name.slice(0, 2).toUpperCase();
		}
		return profile.email.slice(0, 2).toUpperCase();
	}, []);

	const getDisplayName = useCallback((s: StudentWithProfile) => {
		const profile = s.profile;
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

	const columns: DataTableColumn<StudentWithProfile>[] = useMemo(
		() => [
			{
				key: 'student',
				label: 'Leerling',
				sortable: true, // Server-side sorting
				className: 'w-64 max-w-64',
				render: (s) => {
					const displayName = getDisplayName(s);
					return (
						<div className="flex items-center gap-3">
							<Avatar className="h-9 w-9 flex-shrink-0">
								<AvatarImage src={s.profile.avatar_url ?? undefined} alt={displayName} />
								<AvatarFallback className="bg-primary/10 text-primary text-sm">
									{getUserInitials(s)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1 overflow-hidden">
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<p className="font-medium truncate">{displayName}</p>
										</TooltipTrigger>
										<TooltipContent>
											<p>{displayName}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<p className="text-xs text-muted-foreground truncate">{s.profile.email}</p>
										</TooltipTrigger>
										<TooltipContent>
											<p>{s.profile.email}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
						</div>
					);
				},
			},
			{
				key: 'phone_number',
				label: 'Telefoon',
				sortable: true,
				render: (s) => <span className="text-muted-foreground">{s.profile.phone_number || '-'}</span>,
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
		[getDisplayName, getUserInitials],
	);

	const handleEdit = useCallback((student: StudentWithProfile) => {
		setStudentFormDialog({ open: true, student });
	}, []);

	const handleDelete = useCallback((student: StudentWithProfile) => {
		setDeleteDialog({ open: true, student, deleteUser: false });
	}, []);

	const confirmDelete = useCallback(async () => {
		if (!deleteDialog?.student) return;

		setDeletingStudent(true);

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
					setDeletingStudent(false);
					return;
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
						setDeletingStudent(false);
						return;
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
		} finally {
			setDeletingStudent(false);
		}
	}, [deleteDialog, loadStudents]);

	// Redirect if no access
	if (!authLoading && !hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div>
			<DataTable
				title="Leerlingen"
				description="Beheer alle leerlingen en hun gegevens"
				data={students}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={handleSearchChange}
				loading={loading}
				getRowKey={(s) => s.id}
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
					onEdit: isAdmin || isSiteAdmin || isStaff ? handleEdit : undefined,
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
				<Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<LuTriangleAlert className="h-5 w-5 text-destructive" />
								Leerling verwijderen
							</DialogTitle>
							<DialogDescription>
								Weet je zeker dat je{' '}
								<strong>
									{deleteDialog.student ? getDisplayName(deleteDialog.student) : 'deze leerling'}
								</strong>{' '}
								wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<p className="text-sm text-muted-foreground">
								Alle gegevens van deze leerling worden permanent verwijderd, inclusief{' '}
								{deleteDialog.student?.agreements.length || 0} lesovereenkomst(en).
							</p>

							{/* Show all agreements that will be deleted */}
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
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={deletingStudent}>
								Annuleren
							</Button>
							<Button variant="destructive" onClick={confirmDelete} disabled={deletingStudent}>
								{deletingStudent ? (
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
