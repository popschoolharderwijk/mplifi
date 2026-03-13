import { useState } from 'react';
import { LuTrash2, LuUserPlus } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { type UserFilter, UserSelectSingle } from '@/components/ui/user-select';
import { UserFormDialog } from '@/components/users/UserFormDialog';
import { cn } from '@/lib/utils';
import type { User } from '@/types/users';

export interface ExistingOrNewUserSelectProps {
	/** Currently selected user ID */
	value: string | null;
	/** Called when selection changes */
	onChange: (user: User | null) => void;
	/** Filter for user list (default: "all") */
	filter?: UserFilter;
	/** User IDs to exclude from the list */
	excludeUserIds?: string[];
	/** Placeholder for the select */
	placeholder?: string;
	/** Label above the block (default: "Gebruiker") */
	label?: string;
	/** Required marker on label */
	required?: boolean;
	/** Disable the select */
	disabled?: boolean;
	/** Additional class for the wrapper */
	className?: string;
}

/**
 * Reusable block: select an existing user from a searchable dropdown, or create a new user via modal.
 * Used in agreement wizard (step 1 – leerling) and teacher form (add teacher).
 */
export function ExistingOrNewUserSelect({
	value,
	onChange,
	filter = 'all',
	excludeUserIds = [],
	placeholder = 'Selecteer bestaande gebruiker...',
	label = 'Gebruiker',
	required = false,
	disabled = false,
	className,
}: ExistingOrNewUserSelectProps) {
	const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);

	const handleNewUserSuccess = (createdUser?: User) => {
		if (createdUser) {
			onChange(createdUser);
		}
		setNewUserDialogOpen(false);
	};

	return (
		<>
			<div className={cn('space-y-1', className)}>
				<Label className="text-base">
					{label}
					{required && ' *'}
				</Label>
				<div className="flex gap-2 items-start">
					<div className="flex-1">
						<UserSelectSingle
							value={value}
							onChange={onChange}
							filter={filter}
							excludeUserIds={excludeUserIds}
							placeholder={placeholder}
							disabled={disabled}
						/>
					</div>
					{value && (
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={() => onChange(null)}
							className="h-10 w-10 flex-shrink-0 mt-1.5"
							title="Selectie wissen"
							disabled={disabled}
						>
							<LuTrash2 className="h-4 w-4 text-muted-foreground" />
						</Button>
					)}
				</div>
				{!value && (
					<>
						<p className="text-center text-sm text-muted-foreground italic">of</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setNewUserDialogOpen(true)}
							className="w-full"
							disabled={disabled}
						>
							<LuUserPlus className="mr-2 h-4 w-4" />
							Nieuwe gebruiker aanmaken
						</Button>
					</>
				)}
			</div>
			<UserFormDialog
				open={newUserDialogOpen}
				onOpenChange={setNewUserDialogOpen}
				onSuccess={handleNewUserSuccess}
			/>
		</>
	);
}
