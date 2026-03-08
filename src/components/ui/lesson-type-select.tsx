import { useState } from 'react';
import { LuCheck, LuChevronsUpDown } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { LessonTypeBadge } from '@/components/ui/lesson-type-badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface LessonTypeOption {
	id: string;
	name: string;
	icon: string | null;
	color: string | null;
	description?: string | null;
}

interface LessonTypeSelectProps {
	/** Available lesson types */
	options: LessonTypeOption[];
	/** Currently selected lesson type ID */
	value: string | null;
	/** Called when selection changes */
	onChange: (value: string | null) => void;
	/** Placeholder when nothing selected */
	placeholder?: string;
	/** Disable the select */
	disabled?: boolean;
	/** Additional className for the trigger button */
	className?: string;
}

/**
 * A searchable dropdown for selecting lesson types with icons.
 */
export function LessonTypeSelect({
	options,
	value,
	onChange,
	placeholder = 'Selecteer lessoort...',
	disabled = false,
	className,
}: LessonTypeSelectProps) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const selectedOption = options.find((o) => o.id === value);

	// Filter options based on search query
	const filteredOptions = options.filter((option) => {
		if (!searchQuery.trim()) return true;
		return option.name.toLowerCase().includes(searchQuery.toLowerCase());
	});

	return (
		<Popover open={open} onOpenChange={setOpen} modal>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn('w-full justify-between font-normal', className)}
				>
					{selectedOption ? (
						<div className="flex items-center gap-2">
							<LessonTypeBadge lessonType={selectedOption} size="sm" />
						</div>
					) : (
						<span className="text-muted-foreground">{placeholder}</span>
					)}
					<LuChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
				<Command shouldFilter={false}>
					<CommandInput placeholder="Zoek lessoort..." value={searchQuery} onValueChange={setSearchQuery} />
					<CommandList className="max-h-[350px] overflow-y-auto">
						<CommandEmpty>Geen lessoorten gevonden.</CommandEmpty>
						<CommandGroup>
							{filteredOptions.map((option) => (
								<CommandItem
									key={option.id}
									value={option.id}
									onSelect={() => {
										onChange(option.id === value ? null : option.id);
										setSearchQuery('');
										setOpen(false);
									}}
								>
									<LuCheck
										className={cn(
											'mr-2 h-4 w-4',
											value === option.id ? 'opacity-100' : 'opacity-0',
										)}
									/>
									<div className="flex items-center gap-2 flex-1">
										<LessonTypeBadge lessonType={option} size="sm" />
									</div>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
