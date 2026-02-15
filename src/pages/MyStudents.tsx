import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LuLoaderCircle } from 'react-icons/lu';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type LessonAgreement, LessonAgreementItem } from '@/components/students/LessonAgreementItem';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { NAV_LABELS } from '@/config/nav-labels';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface StudentProfile {
	email: string;
	first_name: string | null;
	last_name: string | null;
	phone_number: string | null;
	avatar_url: string | null;
}

interface StudentWithAgreements {
	id: string;
	user_id: string;
	created_at: string;
	updated_at: string;
	profile: StudentProfile;
	active_agreements_count: number;
	lesson_types: Array<{
		name: string;
		icon: string | null;
		color: string | null;
	}>;
	agreements: LessonAgreement[];
}

interface PaginatedStudentsResponse {
	data: StudentWithAgreements[];
	total_count: number;
	limit: number;
	offset: number;
}

export default function MyStudents() {
	const { isTeacher, teacherId, isLoading: authLoading } = useAuth();
	const [students, setStudents] = useState<StudentWithAgreements[]>([]);
	const [loading, setLoading] = useState(true);
	const [totalCount, setTotalCount] = useState(0);

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const [rowsPerPage, setRowsPerPage] = useState(20);

	// Filter state
	const [searchQuery, setSearchQuery] = useState('');
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

	const loadStudents = useCallback(async () => {
		if (!isTeacher || !teacherId) return;

		setLoading(true);

		try {
			const offset = (currentPage - 1) * rowsPerPage;

			const { data, error } = await supabase.rpc('get_students_paginated', {
				p_limit: rowsPerPage,
				p_offset: offset,
				p_search: debouncedSearchQuery || null,
				p_status: 'all',
				p_lesson_type_id: null,
				p_sort_column: 'name',
				p_sort_direction: 'asc',
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
	}, [isTeacher, teacherId, currentPage, rowsPerPage, debouncedSearchQuery]);

	// Load students when dependencies change
	useEffect(() => {
		if (!authLoading && isTeacher) {
			loadStudents();
		}
	}, [authLoading, isTeacher, loadStudents]);

	// Reset to page 1 when search changes - use a ref to track previous value
	const prevSearchRef = React.useRef(debouncedSearchQuery);
	useEffect(() => {
		if (prevSearchRef.current !== debouncedSearchQuery) {
			setCurrentPage(1);
			prevSearchRef.current = debouncedSearchQuery;
		}
	}, [debouncedSearchQuery]);

	// Handle search query change (debounced)
	const handleSearchChange = useCallback((query: string) => {
		setSearchQuery(query);
	}, []);

	// Debounce search query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchQuery(searchQuery);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Handle page change
	const handlePageChange = useCallback((page: number) => {
		setCurrentPage(page);
	}, []);

	// Handle rows per page change
	const handleRowsPerPageChange = useCallback((newRowsPerPage: number) => {
		setRowsPerPage(newRowsPerPage);
		setCurrentPage(1);
	}, []);

	// Helper functions
	const getUserInitials = useCallback((s: StudentWithAgreements) => {
		const profile = s.profile;
		if (profile.first_name && profile.last_name) {
			return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
		}
		if (profile.first_name) {
			return profile.first_name.slice(0, 2).toUpperCase();
		}
		return profile.email.slice(0, 2).toUpperCase();
	}, []);

	const getDisplayName = useCallback((s: StudentWithAgreements) => {
		const profile = s.profile;
		if (profile.first_name && profile.last_name) {
			return `${profile.first_name} ${profile.last_name}`;
		}
		if (profile.first_name) {
			return profile.first_name;
		}
		return profile.email;
	}, []);

	// Extract lesson types from agreements
	const getLessonTypes = useCallback((s: StudentWithAgreements) => {
		const types = new Map<string, { name: string; icon: string | null; color: string | null }>();
		s.agreements.forEach((agreement) => {
			if (agreement.lesson_type) {
				types.set(agreement.lesson_type.id, {
					name: agreement.lesson_type.name,
					icon: agreement.lesson_type.icon,
					color: agreement.lesson_type.color,
				});
			}
		});
		return Array.from(types.values());
	}, []);

	const columns: DataTableColumn<StudentWithAgreements>[] = useMemo(
		() => [
			{
				key: 'student',
				label: 'Leerling',
				sortable: false, // Server-side sorting
				className: 'w-48',
				render: (s) => (
					<div className="flex items-center gap-3">
						<Avatar className="h-9 w-9 flex-shrink-0">
							<AvatarImage src={s.profile.avatar_url ?? undefined} alt={getDisplayName(s)} />
							<AvatarFallback className="bg-primary/10 text-primary text-sm">
								{getUserInitials(s)}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1">
							<p className="font-medium break-words">{getDisplayName(s)}</p>
							<p className="text-xs text-muted-foreground break-words">{s.profile.email}</p>
						</div>
					</div>
				),
			},
			{
				key: 'phone_number',
				label: 'Telefoon',
				sortable: false,
				render: (s) => <span className="text-muted-foreground">{s.profile.phone_number || '-'}</span>,
				className: 'text-muted-foreground',
			},
			{
				key: 'lesson_types',
				label: 'Lessoorten',
				sortable: false,
				render: (s) => {
					const lessonTypes = getLessonTypes(s);
					if (lessonTypes.length === 0) {
						return <span className="text-muted-foreground text-sm">-</span>;
					}
					return (
						<div className="flex flex-wrap gap-1">
							{lessonTypes.map((lt) => (
								<Badge key={lt.name} variant="secondary" className="text-xs">
									{lt.name}
								</Badge>
							))}
						</div>
					);
				},
			},
			{
				key: 'agreements',
				label: 'Lesovereenkomsten',
				sortable: false,
				className: 'min-w-96',
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
		[getDisplayName, getUserInitials, getLessonTypes],
	);

	// Redirect if not a teacher
	if (!authLoading && !isTeacher) {
		return <Navigate to="/" replace />;
	}

	if (authLoading || loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LuLoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div>
			<DataTable
				title={NAV_LABELS.myStudents}
				description="Overzicht van alle leerlingen met lesovereenkomsten bij jou. Klik op een leerling om de leshistorie te bekijken."
				data={students}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={handleSearchChange}
				loading={loading}
				getRowKey={(s) => s.id}
				emptyMessage="Geen leerlingen gevonden"
				serverPagination={{
					totalCount,
					currentPage,
					rowsPerPage,
					onPageChange: handlePageChange,
					onRowsPerPageChange: handleRowsPerPageChange,
				}}
			/>
		</div>
	);
}
