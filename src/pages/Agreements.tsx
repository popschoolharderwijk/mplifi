import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuPlus } from 'react-icons/lu';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { DataTable, type DataTableColumn, type QuickFilterGroup } from '@/components/ui/data-table';
import { LessonTypeBadge } from '@/components/ui/lesson-type-badge';
import { UserDisplay } from '@/components/ui/user-display';
import { NAV_LABELS } from '@/config/nav-labels';
import { useActiveLessonTypes } from '@/hooks/useActiveLessonTypes';
import { useAuth } from '@/hooks/useAuth';
import { useServerTableState } from '@/hooks/useServerTableState';
import { useLessonTypeFilter, useStatusFilter } from '@/hooks/useTableFilters';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTimeShort } from '@/lib/date/date-format';
import { DAY_NAMES } from '@/lib/date/day-index';
import { getDisplayName } from '@/lib/display-name';
import { frequencyLabels } from '@/lib/frequencies';
import { formatTime } from '@/lib/time/time-format';
import type { AgreementTableRow, LessonFrequency } from '@/types/lesson-agreements';

export default function Agreements() {
	const { isPrivileged, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const [agreements, setAgreements] = useState<AgreementTableRow[]>([]);
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
		storageKey: 'agreements',
		initialSortColumn: 'created_at',
		initialSortDirection: 'desc',
		initialFilters: { statusFilter: 'all', selectedLessonTypeId: null },
	});

	const statusFilter = (filters.statusFilter as 'all' | 'active' | 'inactive') ?? 'all';
	const selectedLessonTypeId = (filters.selectedLessonTypeId as string | null) ?? null;

	const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; agreement: AgreementTableRow | null } | null>(
		null,
	);

	const hasAccess = isPrivileged;
	const { lessonTypes } = useActiveLessonTypes(hasAccess);

	const loadAgreements = useCallback(async () => {
		if (!hasAccess) return;

		setLoading(true);

		try {
			let query = supabase
				.from('lesson_agreements')
				.select(
					'id, created_at, day_of_week, start_time, start_date, end_date, is_active, notes, student_user_id, teacher_user_id, lesson_type_id, duration_minutes, frequency, price_per_lesson, lesson_types(id, name, icon, color), teachers(user_id)',
					{ count: 'exact' },
				);

			// Apply status filter
			if (statusFilter === 'active') {
				query = query.eq('is_active', true);
			} else if (statusFilter === 'inactive') {
				query = query.eq('is_active', false);
			}

			// Apply lesson type filter
			if (selectedLessonTypeId) {
				query = query.eq('lesson_type_id', selectedLessonTypeId);
			}

			// Apply sorting
			const sortAsc = sortDirection === 'asc';
			if (sortColumn === 'student' || sortColumn === 'teacher') {
				// For student/teacher sorting, we sort after fetching (need profile data)
				query = query.order('start_date', { ascending: false });
			} else if (sortColumn === 'created_at') {
				query = query.order('created_at', { ascending: sortAsc });
			} else if (sortColumn === 'dayAndTime') {
				query = query.order('day_of_week', { ascending: sortAsc }).order('start_time', { ascending: sortAsc });
			} else if (sortColumn === 'end_date') {
				query = query.order('end_date', { ascending: sortAsc, nullsFirst: false });
			} else if (sortColumn === 'duration_minutes') {
				query = query.order('duration_minutes', { ascending: sortAsc });
			} else if (sortColumn === 'status') {
				query = query.order('is_active', { ascending: sortAsc });
			} else {
				query = query.order('start_date', { ascending: false });
			}

			const { data: agreementsData, error: agreementsError, count } = await query;

			if (agreementsError) {
				console.error('Error loading agreements:', agreementsError);
				toast.error('Fout bij laden overeenkomsten');
				setLoading(false);
				return;
			}

			type RawRow = {
				id: string;
				created_at: string;
				day_of_week: number;
				start_time: string;
				start_date: string;
				end_date: string | null;
				is_active: boolean;
				notes: string | null;
				student_user_id: string;
				teacher_user_id: string;
				lesson_type_id: string;
				duration_minutes: number;
				frequency: LessonFrequency;
				price_per_lesson: number;
				lesson_types: {
					id: string;
					name: string;
					icon: string;
					color: string;
				};
				teachers: { user_id: string } | null;
			};
			const raw = (agreementsData ?? []) as unknown as RawRow[];

			const getTeachers = (a: RawRow) => (Array.isArray(a.teachers) ? a.teachers[0] : a.teachers);
			const getLessonTypes = (a: RawRow) => (Array.isArray(a.lesson_types) ? a.lesson_types[0] : a.lesson_types);

			// Collect all user IDs for profile lookup
			const studentUserIds = [...new Set(raw.map((a) => a.student_user_id))];
			const teacherUserIds = [...new Set(raw.map((a) => getTeachers(a)?.user_id).filter(Boolean) as string[])];
			const allUserIds = [...new Set([...studentUserIds, ...teacherUserIds])];

			// Default empty profiles
			const emptyStudent = { first_name: null, last_name: null, avatar_url: null, email: '' };
			const emptyTeacher = { first_name: null, last_name: null, avatar_url: null, email: '' };

			if (allUserIds.length === 0) {
				setAgreements(
					raw.map((a) => {
						const lt = getLessonTypes(a);
						return {
							id: a.id,
							created_at: a.created_at,
							day_of_week: a.day_of_week,
							start_time: a.start_time,
							start_date: a.start_date,
							end_date: a.end_date,
							is_active: a.is_active,
							notes: a.notes,
							student_user_id: a.student_user_id,
							teacher_user_id: a.teacher_user_id,
							lesson_type_id: a.lesson_type_id,
							duration_minutes: a.duration_minutes,
							frequency: a.frequency,
							price_per_lesson: a.price_per_lesson,
							student: emptyStudent,
							teacher: emptyTeacher,
							lesson_type: {
								id: lt.id,
								name: lt.name,
								icon: lt.icon,
								color: lt.color,
							},
						};
					}),
				);
				setTotalCount(0);
				setLoading(false);
				return;
			}

			// Load profiles for students and teachers
			const { data: profilesData, error: profilesError } = await supabase
				.from('profiles')
				.select('user_id, first_name, last_name, avatar_url, email')
				.in('user_id', allUserIds);

			if (profilesError) {
				console.error('Error loading profiles:', profilesError);
				toast.error('Fout bij laden profielen');
				setLoading(false);
				return;
			}

			const profileMap = new Map(
				(profilesData ?? []).map((p) => [
					p.user_id,
					{
						first_name: p.first_name,
						last_name: p.last_name,
						avatar_url: p.avatar_url ?? null,
						email: p.email ?? '',
					},
				]),
			);

			let rows: AgreementTableRow[] = raw.map((a) => {
				const teacherRef = getTeachers(a);
				const lt = getLessonTypes(a);
				const studentProfile = profileMap.get(a.student_user_id);
				const teacherProfile = profileMap.get(teacherRef?.user_id ?? '');

				return {
					id: a.id,
					created_at: a.created_at,
					day_of_week: a.day_of_week,
					start_time: a.start_time,
					start_date: a.start_date,
					end_date: a.end_date,
					is_active: a.is_active,
					notes: a.notes,
					student_user_id: a.student_user_id,
					teacher_user_id: a.teacher_user_id,
					lesson_type_id: a.lesson_type_id,
					duration_minutes: a.duration_minutes,
					frequency: a.frequency,
					price_per_lesson: a.price_per_lesson,
					student: studentProfile ?? emptyStudent,
					teacher: teacherProfile ?? emptyTeacher,
					lesson_type: {
						id: lt.id,
						name: lt.name,
						icon: lt.icon,
						color: lt.color,
					},
				};
			});

			// Apply search filter (client-side since we need profile data)
			if (debouncedSearchQuery) {
				const query = debouncedSearchQuery.toLowerCase();
				rows = rows.filter((row) => {
					const studentName = `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.toLowerCase();
					const teacherName = `${row.teacher.first_name ?? ''} ${row.teacher.last_name ?? ''}`.toLowerCase();
					const lessonType = row.lesson_type.name.toLowerCase();
					const email = (row.student.email ?? '').toLowerCase();
					return (
						studentName.includes(query) ||
						teacherName.includes(query) ||
						lessonType.includes(query) ||
						email.includes(query)
					);
				});
			}

			// Apply client-side sorting for student/teacher columns
			if (sortColumn === 'student') {
				rows.sort((a, b) => {
					const aName = `${a.student.first_name ?? ''} ${a.student.last_name ?? ''}`.toLowerCase();
					const bName = `${b.student.first_name ?? ''} ${b.student.last_name ?? ''}`.toLowerCase();
					return sortDirection === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
				});
			} else if (sortColumn === 'teacher') {
				rows.sort((a, b) => {
					const aName = `${a.teacher.first_name ?? ''} ${a.teacher.last_name ?? ''}`.toLowerCase();
					const bName = `${b.teacher.first_name ?? ''} ${b.teacher.last_name ?? ''}`.toLowerCase();
					return sortDirection === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
				});
			}

			// Apply pagination (client-side)
			const startIndex = (currentPage - 1) * rowsPerPage;
			const paginatedRows = rows.slice(startIndex, startIndex + rowsPerPage);

			setAgreements(paginatedRows);
			setTotalCount(debouncedSearchQuery ? rows.length : (count ?? rows.length));
			setLoading(false);
		} catch (error) {
			console.error('Error loading agreements:', error);
			toast.error('Fout bij laden overeenkomsten');
			setLoading(false);
		}
	}, [
		hasAccess,
		statusFilter,
		selectedLessonTypeId,
		debouncedSearchQuery,
		sortColumn,
		sortDirection,
		currentPage,
		rowsPerPage,
	]);

	useEffect(() => {
		if (!authLoading) {
			loadAgreements();
		}
	}, [authLoading, loadAgreements]);

	const handleEdit = useCallback(
		(agreement: AgreementTableRow) => {
			navigate(`/agreements/${agreement.id}`);
		},
		[navigate],
	);

	const handleDelete = useCallback((agreement: AgreementTableRow) => {
		setDeleteDialog({ open: true, agreement });
	}, []);

	const confirmDelete = useCallback(async () => {
		if (!deleteDialog?.agreement) return;
		const { error } = await supabase.from('lesson_agreements').delete().eq('id', deleteDialog.agreement.id);
		if (error) {
			toast.error('Fout bij verwijderen overeenkomst', { description: error.message });
			throw new Error(error.message);
		}
		toast.success('Overeenkomst verwijderd');
		setDeleteDialog(null);
		loadAgreements();
	}, [deleteDialog, loadAgreements]);

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

	const columns: DataTableColumn<AgreementTableRow>[] = useMemo(
		() => [
			{
				key: 'student',
				label: 'Leerling',
				sortable: true,
				render: (r) => <UserDisplay profile={r.student} showEmail />,
			},
			{
				key: 'teacher',
				label: 'Docent',
				sortable: true,
				render: (r) => <UserDisplay profile={r.teacher} />,
			},
			{
				key: 'lesson',
				label: 'Les',
				sortable: true,
				className: 'w-32',
				render: (r) => (
					<div className="flex items-center gap-2">
						<LessonTypeBadge lessonType={r.lesson_type} size="sm" showName={false} />
						<div>
							<div>
								<span>{DAY_NAMES[r.day_of_week]?.slice(0, 2)}</span>
								<span className="text-muted-foreground"> {formatTime(r.start_time)}</span>
							</div>
							<p className="text-xs text-muted-foreground">{frequencyLabels[r.frequency]}</p>
						</div>
					</div>
				),
			},
			{
				key: 'duration_minutes',
				label: 'Duur',
				sortable: true,
				sortValue: (r) => r.duration_minutes,
				className: 'w-24',
				render: (r) => `${r.duration_minutes} min`,
			},
			{
				key: 'end_date',
				label: 'Einddatum',
				sortable: true,
				className: 'w-36',
				render: (r) => {
					const end = r.end_date
						? new Date(r.end_date).toLocaleDateString('nl-NL', {
								day: 'numeric',
								month: 'short',
								year: 'numeric',
							})
						: '∞';
					return (
						<div className="flex items-center gap-1.5">
							{!r.is_active && (
								<span
									className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50"
									title="Inactief"
								/>
							)}
							<span className="text-muted-foreground">{end}</span>
						</div>
					);
				},
			},
			{
				key: 'created_at',
				label: 'Aangemaakt',
				sortable: true,
				className: 'w-36',
				render: (r) => (
					<span className="text-muted-foreground">{formatDateTimeShort(new Date(r.created_at))}</span>
				),
			},
		],
		[],
	);

	// Redirect if no access
	if (!authLoading && !hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div>
			<DataTable
				title={NAV_LABELS.agreements}
				description="Beheer lesovereenkomsten tussen leerlingen en docenten"
				data={agreements}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={handleSearchChange}
				loading={loading}
				getRowKey={(r) => r.id}
				emptyMessage="Geen overeenkomsten gevonden"
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
					<Button onClick={() => navigate('/agreements/new')}>
						<LuPlus className="mr-2 h-4 w-4" />
						Overeenkomst toevoegen
					</Button>
				}
				rowActions={{
					onEdit: handleEdit,
					onDelete: handleDelete,
				}}
			/>

			{/* Delete Agreement Dialog */}
			{deleteDialog && (
				<ConfirmDeleteDialog
					open={deleteDialog.open}
					onOpenChange={(open) => !open && setDeleteDialog(null)}
					title="Overeenkomst verwijderen"
					description={
						<>
							Weet je zeker dat je de lesovereenkomst van{' '}
							<strong>
								{getDisplayName(
									deleteDialog.agreement?.student ?? { first_name: null, last_name: null },
								)}
							</strong>{' '}
							wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
							<p className="mt-2 text-muted-foreground">
								Alle gegevens van deze overeenkomst worden permanent verwijderd.
							</p>
						</>
					}
					onConfirm={confirmDelete}
				/>
			)}
		</div>
	);
}
