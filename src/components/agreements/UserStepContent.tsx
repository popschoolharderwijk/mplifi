import { Card, CardContent } from '@/components/ui/card';
import { ExistingOrNewUserSelect } from '@/components/ui/existing-or-new-user-select';
import { Label } from '@/components/ui/label';
import { LessonTypeBadge } from '@/components/ui/lesson-type-badge';
import { type LessonTypeOption, LessonTypeSelect } from '@/components/ui/lesson-type-select';
import { UserDisplay } from '@/components/ui/user-display';
import { frequencyLabels } from '@/lib/frequencies';
import type { LessonFrequency, LessonTypeOptionSnapshot, WizardLessonTypeInfo } from '@/types/lesson-agreements';
import type { User } from '@/types/users';

interface OptionSnapshot {
	duration_minutes: number;
	frequency: LessonFrequency;
	price_per_lesson: number;
}

interface UserStepContentProps {
	isEditMode: boolean;
	selectedStudentUserId: string | null;
	selectedUser: User | null;
	selectedLessonTypeId: string | null;
	selectedLessonType: WizardLessonTypeInfo | undefined;
	lessonTypes: LessonTypeOption[];
	lessonTypeOptions: LessonTypeOptionSnapshot[];
	selectedOptionSnapshot: OptionSnapshot | null;
	onStudentUserIdChange: (userId: string | null) => void;
	onUserChange: (user: User | null) => void;
	onLessonTypeChange: (lessonTypeId: string | null) => void;
	onOptionSnapshotChange: (snap: OptionSnapshot | null) => void;
}

export function UserStepContent({
	isEditMode,
	selectedStudentUserId,
	selectedUser,
	selectedLessonTypeId,
	selectedLessonType,
	lessonTypes,
	lessonTypeOptions,
	selectedOptionSnapshot,
	onStudentUserIdChange,
	onUserChange,
	onLessonTypeChange,
	onOptionSnapshotChange,
}: UserStepContentProps) {
	if (isEditMode) {
		return (
			<div id="wizard-step-user" className="space-y-6 py-6">
				<div className="space-y-3">
					<Label className="text-base">Leerling</Label>
					<div className="opacity-60">
						{selectedUser ? (
							<UserDisplay
								profile={{
									first_name: selectedUser.first_name,
									last_name: selectedUser.last_name,
									email: selectedUser.email,
									avatar_url: selectedUser.avatar_url,
								}}
								showEmail
							/>
						) : (
							<p className="text-muted-foreground">-</p>
						)}
					</div>
				</div>
				<div className="space-y-3">
					<Label className="text-base">Lessoort</Label>
					{selectedLessonType ? (
						<Card className="opacity-60">
							<CardContent className="flex min-w-0 items-center gap-3 p-3">
								<LessonTypeBadge
									lessonType={{
										name: `${selectedLessonType.name} · ${selectedLessonType.duration_minutes} min · ${frequencyLabels[selectedLessonType.frequency]}`,
										icon: selectedLessonType.icon,
										color: selectedLessonType.color,
									}}
								/>
							</CardContent>
						</Card>
					) : (
						<p className="text-muted-foreground">-</p>
					)}
				</div>
			</div>
		);
	}

	return (
		<div id="wizard-step-user" className="space-y-6 py-6">
			<ExistingOrNewUserSelect
				value={selectedStudentUserId}
				onChange={(user) => {
					onStudentUserIdChange(user?.user_id ?? null);
					onUserChange(user);
				}}
				filter="all"
				placeholder="Selecteer bestaande gebruiker..."
				label="Leerling"
			/>
			<div className="space-y-3">
				<Label className="text-base">Lessoort</Label>
				<LessonTypeSelect
					options={lessonTypes}
					value={selectedLessonTypeId}
					onChange={onLessonTypeChange}
					placeholder="Selecteer lessoort..."
				/>
			</div>
			{selectedLessonTypeId && lessonTypeOptions.length > 0 && (
				<div className="space-y-3">
					<Label className="text-base">Optie (duur, frequentie, prijs)</Label>
					<select
						className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						value={
							selectedOptionSnapshot
								? (lessonTypeOptions.find(
										(o) =>
											o.duration_minutes === selectedOptionSnapshot.duration_minutes &&
											o.frequency === selectedOptionSnapshot.frequency &&
											o.price_per_lesson === selectedOptionSnapshot.price_per_lesson,
									)?.id ?? '')
								: ''
						}
						onChange={(e) => {
							const id = e.target.value;
							if (!id) {
								onOptionSnapshotChange(null);
								return;
							}
							const opt = lessonTypeOptions.find((o) => o.id === id);
							if (opt)
								onOptionSnapshotChange({
									duration_minutes: opt.duration_minutes,
									frequency: opt.frequency,
									price_per_lesson: opt.price_per_lesson,
								});
						}}
					>
						<option value="">Selecteer optie...</option>
						{lessonTypeOptions.map((opt) => (
							<option key={opt.id} value={opt.id}>
								{opt.duration_minutes} min · {frequencyLabels[opt.frequency]} · €{opt.price_per_lesson}
							</option>
						))}
					</select>
				</div>
			)}
		</div>
	);
}
