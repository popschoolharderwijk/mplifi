import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LessonTypeBadge } from '@/components/ui/lesson-type-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { SectionSkeleton } from '@/components/ui/page-skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

interface LessonType {
	id: string;
	name: string;
	icon: string | null;
	color: string | null;
}

interface LessonTypeOption {
	id: string;
	name: string;
	icon: string;
	color: string;
}

interface TeacherLessonTypesSectionProps {
	teacherId: string;
	canEdit: boolean;
}

export function TeacherLessonTypesSection({ teacherId, canEdit }: TeacherLessonTypesSectionProps) {
	const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
	const [allLessonTypes, setAllLessonTypes] = useState<LessonTypeOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [addPopoverOpen, setAddPopoverOpen] = useState(false);

	// Load all available lesson types
	const loadAllLessonTypes = useCallback(async () => {
		const { data, error } = await supabase
			.from('lesson_types')
			.select('id, name, icon, color')
			.eq('is_active', true)
			.order('name', { ascending: true });

		if (error) {
			console.error('Error loading all lesson types:', error);
			return;
		}

		setAllLessonTypes(
			(data ?? []).map((lt) => ({
				id: lt.id,
				name: lt.name,
				icon: lt.icon ?? '',
				color: lt.color ?? '#000000',
			})),
		);
	}, []);

	// Load lesson types assigned to this teacher
	const loadLessonTypes = useCallback(async () => {
		if (!teacherId) return;

		setLoading(true);

		const { data, error } = await supabase
			.from('teacher_lesson_types')
			.select('lesson_type_id, lesson_types(id, name, icon, color)')
			.eq('teacher_id', teacherId);

		if (error) {
			console.error('Error loading lesson types:', error);
			setLoading(false);
			return;
		}

		const types: LessonType[] =
			data?.map((item) => {
				const lt = item.lesson_types as unknown as {
					id: string;
					name: string;
					icon: string;
					color: string;
				};
				return {
					id: item.lesson_type_id,
					name: lt.name,
					icon: lt.icon,
					color: lt.color,
				};
			}) ?? [];

		setLessonTypes(types);
		setLoading(false);
	}, [teacherId]);

	// Initial load
	useEffect(() => {
		loadLessonTypes();
		loadAllLessonTypes();
	}, [loadLessonTypes, loadAllLessonTypes]);

	// Get IDs of lesson types already assigned to this teacher
	const assignedLessonTypeIds = useMemo(() => {
		return new Set(lessonTypes.map((lt) => lt.id));
	}, [lessonTypes]);

	// Get available lesson types to add (not yet assigned)
	const availableLessonTypes = useMemo(() => {
		return allLessonTypes.filter((lt) => !assignedLessonTypeIds.has(lt.id));
	}, [allLessonTypes, assignedLessonTypeIds]);

	// Handle adding a lesson type
	const handleAddLessonType = useCallback(
		async (lessonTypeId: string) => {
			if (!canEdit) return;

			setSaving(true);
			setAddPopoverOpen(false);

			const { error } = await supabase.from('teacher_lesson_types').insert({
				teacher_id: teacherId,
				lesson_type_id: lessonTypeId,
			});

			if (error) {
				console.error('Error adding lesson type:', error);
				toast.error('Fout bij toevoegen lessoort');
				setSaving(false);
				return;
			}

			toast.success('Lessoort toegevoegd');
			await loadLessonTypes();
			setSaving(false);
		},
		[canEdit, teacherId, loadLessonTypes],
	);

	// Handle removing a lesson type
	const handleRemoveLessonType = useCallback(
		async (lessonTypeId: string) => {
			if (!canEdit) return;

			setSaving(true);

			const { error } = await supabase
				.from('teacher_lesson_types')
				.delete()
				.eq('teacher_id', teacherId)
				.eq('lesson_type_id', lessonTypeId);

			if (error) {
				console.error('Error removing lesson type:', error);
				// Check if it's the constraint violation
				if (error.message.includes('Cannot remove lesson type from teacher')) {
					toast.error('Kan lessoort niet verwijderen', {
						description: 'Er bestaan nog lesovereenkomsten voor deze docent en lessoort.',
					});
				} else {
					toast.error('Fout bij verwijderen lessoort');
				}
				setSaving(false);
				return;
			}

			toast.success('Lessoort verwijderd');
			await loadLessonTypes();
			setSaving(false);
		},
		[canEdit, teacherId, loadLessonTypes],
	);

	if (loading) {
		return <SectionSkeleton />;
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-lg">Huidige lessoorten</CardTitle>
				{canEdit && availableLessonTypes.length > 0 && (
					<Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm" disabled={saving}>
								{saving ? (
									<LoadingSpinner size="md" label="Toevoegen" />
								) : (
									<>
										<LuPlus className="mr-2 h-4 w-4" />
										Toevoegen
									</>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-64 p-2" align="end">
							<div className="space-y-1">
								{availableLessonTypes.map((lt) => (
									<Button
										key={lt.id}
										variant="ghost"
										className="w-full justify-start font-normal"
										onClick={() => handleAddLessonType(lt.id)}
									>
										<LessonTypeBadge lessonType={lt} size="sm" />
									</Button>
								))}
							</div>
						</PopoverContent>
					</Popover>
				)}
			</CardHeader>
			<CardContent>
				{lessonTypes.length === 0 ? (
					<p className="text-sm text-muted-foreground">Geen lessoorten toegewezen</p>
				) : (
					<div className="flex flex-wrap gap-2">
						{lessonTypes.map((lt) => (
							<div key={lt.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
								<LessonTypeBadge lessonType={lt} />
								{canEdit && (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-5 w-5 text-muted-foreground hover:text-destructive"
										onClick={() => handleRemoveLessonType(lt.id)}
										disabled={saving}
									>
										<LuX className="h-3 w-3" />
									</Button>
								)}
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
