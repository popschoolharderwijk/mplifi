import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuLoaderCircle, LuPlus, LuTriangleAlert } from 'react-icons/lu';
import { Navigate } from 'react-router-dom';
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
import { supabase } from '@/integrations/supabase/client';

interface LessonType {
	id: string;
	name: string;
	icon: string;
	color: string;
}

interface TeacherWithProfile {
	id: string;
	user_id: string;
	bio: string | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	profile: {
		email: string;
		first_name: string | null;
		last_name: string | null;
		phone_number: string | null;
		avatar_url: string | null;
	};
	lesson_types: LessonType[];
}

export default function Teachers() {
	const { isAdmin, isSiteAdmin, isLoading: authLoading } = useAuth();
	const [teachers, setTeachers] = useState<TeacherWithProfile[]>([]);
	const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
	const [selectedLessonTypeId, setSelectedLessonTypeId] = useState<string | null>(null);
	const [deleteDialog, setDeleteDialog] = useState<{
		open: boolean;
		teacher: TeacherWithProfile | null;
	} | null>(null);
	const [teacherFormDialog, setTeacherFormDialog] = useState<{
		open: boolean;
		teacher: TeacherWithProfile | null;
	}>({ open: false, teacher: null });
	const [deletingTeacher, setDeletingTeacher] = useState(false);

	// Check access - only admin and site_admin can view this page
	const hasAccess = isAdmin || isSiteAdmin;

	const loadTeachers = useCallback(async () => {
		if (!hasAccess) return;

		setLoading(true);

		// First get teachers
		const { data: teachersData, error: teachersError } = await supabase
			.from('teachers')
			.select('id, user_id, bio, is_active, created_at, updated_at')
			.order('created_at', { ascending: false });

		if (teachersError) {
			console.error('Error loading teachers:', teachersError);
			toast.error('Fout bij laden docenten');
			setLoading(false);
			return;
		}

		if (!teachersData || teachersData.length === 0) {
			setTeachers([]);
			setLoading(false);
			return;
		}

		// Then get profiles for all user_ids
		const userIds = teachersData.map((t) => t.user_id);
		const { data: profilesData, error: profilesError } = await supabase
			.from('profiles')
			.select('user_id, email, first_name, last_name, phone_number, avatar_url')
			.in('user_id', userIds);

		if (profilesError) {
			console.error('Error loading profiles:', profilesError);
			toast.error('Fout bij laden profielen');
			setLoading(false);
			return;
		}

		// Get lesson types for all teachers
		const teacherIds = teachersData.map((t) => t.id);
		const { data: lessonTypeLinks, error: linksError } = await supabase
			.from('teacher_lesson_types')
			.select('teacher_id, lesson_type_id')
			.in('teacher_id', teacherIds);

		if (linksError) {
			console.error('Error loading lesson type links:', linksError);
			toast.error('Fout bij laden lessoorten');
			setLoading(false);
			return;
		}

		// Get all lesson types
		const lessonTypeIds = [...new Set(lessonTypeLinks?.map((link) => link.lesson_type_id) ?? [])];
		const { data: lessonTypesData, error: lessonTypesError } = await supabase
			.from('lesson_types')
			.select('id, name, icon, color')
			.in('id', lessonTypeIds);

		if (lessonTypesError) {
			console.error('Error loading lesson types:', lessonTypesError);
			toast.error('Fout bij laden lessoorten');
			setLoading(false);
			return;
		}

		// Create maps for easy lookup
		const profileMap = new Map(profilesData?.map((p) => [p.user_id, p]) ?? []);
		const lessonTypeMap = new Map(lessonTypesData?.map((lt) => [lt.id, lt]) ?? []);
		const linksByTeacher = new Map<string, string[]>();
		lessonTypeLinks?.forEach((link) => {
			const existing = linksByTeacher.get(link.teacher_id) ?? [];
			linksByTeacher.set(link.teacher_id, [...existing, link.lesson_type_id]);
		});

		// Combine the data
		const transformedData: TeacherWithProfile[] = teachersData.map((teacher) => {
			const lessonTypeIds = linksByTeacher.get(teacher.id) ?? [];
			const lessonTypes = lessonTypeIds
				.map((id) => lessonTypeMap.get(id))
				.filter((lt): lt is LessonType => lt !== undefined);

			return {
				id: teacher.id,
				user_id: teacher.user_id,
				bio: teacher.bio,
				is_active: teacher.is_active,
				created_at: teacher.created_at,
				updated_at: teacher.updated_at,
				profile: profileMap.get(teacher.user_id) ?? {
					email: '',
					first_name: null,
					last_name: null,
					phone_number: null,
					avatar_url: null,
				},
				lesson_types: lessonTypes,
			};
		});

		setTeachers(transformedData);

		// Load all active lesson types for the filter
		const { data: allLessonTypes, error: allLessonTypesError } = await supabase
			.from('lesson_types')
			.select('id, name, icon, color')
			.eq('is_active', true)
			.order('name', { ascending: true });

		if (allLessonTypesError) {
			console.error('Error loading lesson types:', allLessonTypesError);
		} else {
			setLessonTypes(allLessonTypes ?? []);
		}

		setLoading(false);
	}, [hasAccess]);

	useEffect(() => {
		if (!authLoading) {
			loadTeachers();
		}
	}, [authLoading, loadTeachers]);

	// Helper functions
	const getUserInitials = useCallback((t: TeacherWithProfile) => {
		const profile = t.profile;
		if (profile.first_name && profile.last_name) {
			return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
		}
		if (profile.first_name) {
			return profile.first_name.slice(0, 2).toUpperCase();
		}
		return profile.email.slice(0, 2).toUpperCase();
	}, []);

	const getDisplayName = useCallback((t: TeacherWithProfile) => {
		const profile = t.profile;
		if (profile.first_name && profile.last_name) {
			return `${profile.first_name} ${profile.last_name}`;
		}
		if (profile.first_name) {
			return profile.first_name;
		}
		return profile.email;
	}, []);

	// Filter teachers based on active status and lesson type
	const filteredTeachers = useMemo(() => {
		let filtered = teachers;
		if (activeFilter === 'active') {
			filtered = teachers.filter((t) => t.is_active);
		} else if (activeFilter === 'inactive') {
			filtered = teachers.filter((t) => !t.is_active);
		}

		// Filter by lesson type if selected
		if (selectedLessonTypeId) {
			filtered = filtered.filter((t) => t.lesson_types.some((lt) => lt.id === selectedLessonTypeId));
		}

		return filtered;
	}, [teachers, activeFilter, selectedLessonTypeId]);

	// Quick filter groups configuration
	const quickFilterGroups: QuickFilterGroup[] = useMemo(() => {
		const groups: QuickFilterGroup[] = [
			{
				label: 'Status',
				value: activeFilter === 'all' ? null : activeFilter,
				options: [
					{ id: 'active', label: 'Actief' },
					{ id: 'inactive', label: 'Inactief' },
				],
				onChange: (value) => {
					setActiveFilter(value === null ? 'all' : (value as 'active' | 'inactive'));
				},
			},
		];

		if (lessonTypes.length > 0) {
			groups.push({
				label: 'Lessoorten',
				value: selectedLessonTypeId,
				options: lessonTypes.map((lt) => {
					const Icon = lt.icon ? resolveIconFromList(MUSIC_ICONS, lt.icon) : undefined;
					return {
						id: lt.id,
						label: lt.name,
						icon: Icon,
						color: lt.color,
					};
				}),
				onChange: setSelectedLessonTypeId,
			});
		}

		return groups;
	}, [activeFilter, lessonTypes, selectedLessonTypeId]);

	const columns: DataTableColumn<TeacherWithProfile>[] = useMemo(
		() => [
			{
				key: 'teacher',
				label: 'Docent',
				sortable: true,
				sortValue: (t) => getDisplayName(t).toLowerCase(),
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
				sortValue: (t) => t.profile.phone_number?.toLowerCase() ?? '',
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
													<ColorIcon icon={Icon} color={lt.color} size="sm" />
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
				sortValue: (t) => (t.is_active ? 1 : 0),
				render: (t) => (
					<Badge variant={t.is_active ? 'default' : 'secondary'}>{t.is_active ? 'Actief' : 'Inactief'}</Badge>
				),
			},
			{
				key: 'created_at',
				label: 'Aangemaakt',
				sortable: true,
				sortValue: (t) => new Date(t.created_at),
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

	const handleEdit = useCallback((teacher: TeacherWithProfile) => {
		setTeacherFormDialog({ open: true, teacher });
	}, []);

	const handleCreate = useCallback(() => {
		setTeacherFormDialog({ open: true, teacher: null });
	}, []);

	const handleDelete = useCallback((teacher: TeacherWithProfile) => {
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

			// Remove teacher from local state
			setTeachers((prev) => prev.filter((t) => t.id !== deleteDialog.teacher?.id));
			setDeleteDialog(null);
		} catch (error) {
			console.error('Error deleting teacher:', error);
			toast.error('Fout bij verwijderen docent', {
				description: 'Er is een netwerkfout opgetreden. Probeer het later opnieuw.',
			});
		} finally {
			setDeletingTeacher(false);
		}
	}, [deleteDialog, getDisplayName]);

	// Redirect if no access
	if (!hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div>
			<DataTable
				title="Docenten"
				description="Beheer alle docenten en hun profielgegevens"
				data={filteredTeachers}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				searchFields={[
					(t) => t.profile.email,
					(t) => t.profile.first_name ?? undefined,
					(t) => t.profile.last_name ?? undefined,
					(t) => t.profile.phone_number ?? undefined,
				]}
				loading={loading}
				getRowKey={(t) => t.id}
				emptyMessage="Geen docenten gevonden"
				initialSortColumn="teacher"
				initialSortDirection="asc"
				quickFilter={quickFilterGroups}
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
