import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuLoaderCircle, LuPlus, LuTriangleAlert } from 'react-icons/lu';
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
import { useAuth } from '@/hooks/useAuth';
import { type LessonType, useLessonTypeFilter, useStatusFilter } from '@/hooks/useTableFilters';
import { supabase } from '@/integrations/supabase/client';

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
	profile: {
		email: string;
		first_name: string | null;
		last_name: string | null;
		phone_number: string | null;
		avatar_url: string | null;
	};
	active_agreements_count: number;
	agreements: LessonAgreement[];
}

export default function Students() {
	const { isAdmin, isSiteAdmin, isStaff, isLoading: authLoading } = useAuth();
	const [students, setStudents] = useState<StudentWithProfile[]>([]);
	const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
	const [selectedLessonTypeId, setSelectedLessonTypeId] = useState<string | null>(null);
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

	const loadStudents = useCallback(async () => {
		if (!hasAccess) return;

		setLoading(true);

		try {
			// First get students
			const { data: studentsData, error: studentsError } = await supabase
				.from('students')
				.select(
					'id, user_id, parent_name, parent_email, parent_phone_number, debtor_info_same_as_student, debtor_name, debtor_address, debtor_postal_code, debtor_city, created_at, updated_at',
				)
				.order('created_at', { ascending: false });

			if (studentsError) {
				console.error('Error loading students:', studentsError);
				toast.error('Fout bij laden leerlingen');
				setLoading(false);
				return;
			}

			if (!studentsData || studentsData.length === 0) {
				setStudents([]);
				setLoading(false);
				return;
			}

			// Extract user IDs for parallel queries
			const userIds = studentsData.map((s) => s.user_id);

			// Run queries in parallel - first get agreements to extract teacher user IDs
			const agreementsResult = await supabase
				.from('lesson_agreements')
				.select(
					`
					id,
					student_user_id,
					day_of_week,
					start_time,
					start_date,
					end_date,
					is_active,
					notes,
					teachers!inner (
						user_id
					),
					lesson_types!inner (
						id,
						name,
						icon,
						color
					)
				`,
				)
				.in('student_user_id', userIds)
				.order('day_of_week', { ascending: true })
				.order('start_time', { ascending: true });

			if (agreementsResult.error) {
				console.error('Error loading agreements:', agreementsResult.error);
				toast.error('Fout bij laden lesovereenkomsten');
				setLoading(false);
				return;
			}

			// Extract teacher user IDs from agreements
			const teacherUserIds = Array.from(
				new Set(
					agreementsResult.data?.map((a) => a.teachers?.user_id).filter((id): id is string => !!id) || [],
				),
			);

			// Get profiles for students and teachers, and lesson types
			const [profilesResult, teacherProfilesResult, lessonTypesResult] = await Promise.all([
				// Get profiles for all user_ids
				supabase
					.from('profiles')
					.select('user_id, email, first_name, last_name, phone_number, avatar_url')
					.in('user_id', userIds),
				// Get teacher profiles
				supabase
					.from('profiles')
					.select('user_id, first_name, last_name, avatar_url')
					.in('user_id', teacherUserIds),
				// Get all active lesson types for filter
				supabase
					.from('lesson_types')
					.select('id, name, icon, color')
					.eq('is_active', true)
					.order('name', { ascending: true }),
			]);

			if (profilesResult.error) {
				console.error('Error loading profiles:', profilesResult.error);
				toast.error('Fout bij laden profielen');
				setLoading(false);
				return;
			}

			if (teacherProfilesResult.error) {
				console.error('Error loading teacher profiles:', teacherProfilesResult.error);
				toast.error('Fout bij laden docent profielen');
				setLoading(false);
				return;
			}

			if (lessonTypesResult.error) {
				console.error('Error loading lesson types:', lessonTypesResult.error);
			} else {
				setLessonTypes(lessonTypesResult.data ?? []);
			}

			// Create maps of user_id -> profile
			const profilesMap = new Map(profilesResult.data?.map((profile) => [profile.user_id, profile]) || []);
			const teacherProfilesMap = new Map(
				teacherProfilesResult.data?.map((profile) => [profile.user_id, profile]) || [],
			);

			// Count active agreements and group agreements per student
			const agreementCounts = new Map<string, number>();
			const agreementsMap = new Map<string, LessonAgreement[]>();
			(agreementsResult.data || []).forEach((agreement) => {
				const studentUserId = agreement.student_user_id;
				if (agreement.is_active) {
					const count = agreementCounts.get(studentUserId) || 0;
					agreementCounts.set(studentUserId, count + 1);
				}

				// Group agreements per student
				if (!agreementsMap.has(studentUserId)) {
					agreementsMap.set(studentUserId, []);
				}
				const studentAgreements = agreementsMap.get(studentUserId);
				if (studentAgreements) {
					const teacherUserId = agreement.teachers?.user_id;
					const teacherProfile = teacherUserId ? teacherProfilesMap.get(teacherUserId) : null;
					studentAgreements.push({
						id: agreement.id,
						day_of_week: agreement.day_of_week,
						start_time: agreement.start_time,
						start_date: agreement.start_date,
						end_date: agreement.end_date,
						is_active: agreement.is_active,
						notes: agreement.notes,
						teacher: {
							first_name: teacherProfile?.first_name ?? null,
							last_name: teacherProfile?.last_name ?? null,
							avatar_url: teacherProfile?.avatar_url ?? null,
						},
						lesson_type: {
							id: agreement.lesson_types?.id ?? '',
							name: agreement.lesson_types?.name ?? '',
							icon: agreement.lesson_types?.icon ?? null,
							color: agreement.lesson_types?.color ?? null,
						},
					});
				}
			});

			// Combine data
			const studentsWithCounts: StudentWithProfile[] = studentsData
				.map((student) => {
					const profile = profilesMap.get(student.user_id);
					if (!profile) {
						// Skip students without profiles (shouldn't happen, but handle gracefully)
						return null;
					}
					return {
						...student,
						profile: {
							email: profile.email,
							first_name: profile.first_name,
							last_name: profile.last_name,
							phone_number: profile.phone_number,
							avatar_url: profile.avatar_url,
						},
						active_agreements_count: agreementCounts.get(student.user_id) || 0,
						agreements: agreementsMap.get(student.user_id) || [],
					};
				})
				.filter((s): s is StudentWithProfile => s !== null);

			setStudents(studentsWithCounts);
			setLoading(false);
		} catch (error) {
			console.error('Error loading students:', error);
			toast.error('Fout bij laden leerlingen');
			setLoading(false);
		}
	}, [hasAccess]);

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

	// Filter students based on status and lesson type
	const filteredStudents = useMemo(() => {
		let filtered = students;
		if (statusFilter === 'active') {
			filtered = students.filter((s) => s.active_agreements_count > 0);
		} else if (statusFilter === 'inactive') {
			filtered = students.filter((s) => s.active_agreements_count === 0);
		}

		// Filter by lesson type if selected
		if (selectedLessonTypeId) {
			filtered = filtered.filter((s) => s.agreements.some((a) => a.lesson_type.id === selectedLessonTypeId));
		}

		return filtered;
	}, [students, statusFilter, selectedLessonTypeId]);

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
				sortable: true,
				sortValue: (s) => getDisplayName(s).toLowerCase(),
				render: (s) => (
					<div className="flex items-center gap-3">
						<Avatar className="h-9 w-9">
							<AvatarImage src={s.profile.avatar_url ?? undefined} alt={getDisplayName(s)} />
							<AvatarFallback className="bg-primary/10 text-primary text-sm">
								{getUserInitials(s)}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-medium">{getDisplayName(s)}</p>
							<p className="text-xs text-muted-foreground">{s.profile.email}</p>
						</div>
					</div>
				),
			},
			{
				key: 'phone_number',
				label: 'Telefoon',
				sortable: true,
				sortValue: (s) => s.profile.phone_number ?? '',
				render: (s) => <span className="text-muted-foreground">{s.profile.phone_number || '-'}</span>,
				className: 'text-muted-foreground',
			},
			{
				key: 'status',
				label: 'Status',
				sortable: true,
				sortValue: (s) => (s.active_agreements_count > 0 ? 1 : 0),
				render: (s) => (
					<Badge variant={s.active_agreements_count > 0 ? 'default' : 'secondary'}>
						{s.active_agreements_count > 0 ? 'Actief' : 'Inactief'}
					</Badge>
				),
			},
			{
				key: 'agreements',
				label: 'Lesovereenkomsten',
				sortable: true,
				sortValue: (s) => s.active_agreements_count,
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

	const handleCreate = useCallback(() => {
		setStudentFormDialog({ open: true, student: null });
	}, []);

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

			// Remove student from local state
			setStudents((prev) => prev.filter((s) => s.id !== deleteDialog.student?.id));
			setDeleteDialog(null);
		} catch (error) {
			console.error('Error deleting student:', error);
			toast.error('Fout bij verwijderen leerling', {
				description: 'Er is een netwerkfout opgetreden. Probeer het later opnieuw.',
			});
		} finally {
			setDeletingStudent(false);
		}
	}, [deleteDialog]);

	// Redirect if no access
	if (!authLoading && !hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div>
			<DataTable
				title="Leerlingen"
				description="Beheer alle leerlingen en hun gegevens"
				data={filteredStudents}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				searchFields={[
					(s) => s.profile.email,
					(s) => s.profile.first_name ?? undefined,
					(s) => s.profile.last_name ?? undefined,
					(s) => s.profile.phone_number ?? undefined,
				]}
				loading={loading}
				getRowKey={(s) => s.id}
				emptyMessage="Geen leerlingen gevonden"
				initialSortColumn="student"
				initialSortDirection="asc"
				quickFilter={quickFilterGroups}
				headerActions={
					(isAdmin || isSiteAdmin || isStaff) && (
						<Button onClick={handleCreate}>
							<LuPlus className="mr-2 h-4 w-4" />
							Leerling toevoegen
						</Button>
					)
				}
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
