import { useMemo, useState } from 'react';
import { LuSearch, LuX } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { ColorIcon } from '@/components/ui/color-icon';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { resolveIconFromList } from '@/components/ui/icon-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MUSIC_ICONS } from '@/constants/icons';
import { cn } from '@/lib/utils';

export interface LessonTypeOption {
	id: string;
	name: string;
	icon: string;
	color: string;
}

interface LessonTypeSelectorProps {
	/** Array of selected lesson type IDs */
	value: string[];
	/** Callback when selection changes */
	onChange: (selectedIds: string[]) => void;
	/** Available lesson types to choose from */
	options: LessonTypeOption[];
	/** Placeholder text for the dropdown button */
	placeholder?: string;
	/** Search input placeholder */
	searchPlaceholder?: string;
	/** Additional className */
	className?: string;
	/** Whether the selector is disabled */
	disabled?: boolean;
}

export function LessonTypeSelector({
	value,
	onChange,
	options,
	placeholder = 'Selecteer lessoorten...',
	searchPlaceholder = 'Zoek lessoort...',
	className,
	disabled = false,
}: LessonTypeSelectorProps) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	// Get selected lesson types
	const selectedOptions = useMemo(() => {
		return options.filter((option) => value.includes(option.id));
	}, [options, value]);

	// Filter options based on search query and exclude already selected ones
	const filteredOptions = useMemo(() => {
		const availableOptions = options.filter((option) => !value.includes(option.id));

		if (!searchQuery.trim()) {
			return availableOptions.sort((a, b) => a.name.localeCompare(b.name));
		}

		const query = searchQuery.toLowerCase();
		return availableOptions
			.filter((option) => {
				return option.name.toLowerCase().includes(query);
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [searchQuery, options, value]);

	const handleSelect = (lessonTypeId: string) => {
		onChange([...value, lessonTypeId]);
		setSearchQuery('');
		setOpen(false);
	};

	const handleRemove = (lessonTypeId: string) => {
		onChange(value.filter((id) => id !== lessonTypeId));
	};

	return (
		<div className={cn('space-y-2', className)}>
			{/* Dropdown to add more lesson types */}
			{!disabled && (
				<Popover open={open} onOpenChange={setOpen} modal>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							role="combobox"
							aria-expanded={open}
							className="w-full justify-between"
							disabled={filteredOptions.length === 0}
						>
							<span className="truncate">{placeholder}</span>
							<LuSearch className="ml-2 h-4 w-4 shrink-0 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[350px] p-0" align="start">
						<Command shouldFilter={false}>
							<CommandInput
								placeholder={searchPlaceholder}
								value={searchQuery}
								onValueChange={setSearchQuery}
							/>
							<CommandList className="max-h-[350px] overflow-y-auto">
								<CommandEmpty>Geen lessoort gevonden.</CommandEmpty>
								<CommandGroup>
									{filteredOptions.map((option) => {
										const Icon = option.icon
											? resolveIconFromList(MUSIC_ICONS, option.icon)
											: undefined;

										return (
											<CommandItem
												key={option.id}
												value={option.id}
												onSelect={() => handleSelect(option.id)}
												className="flex items-center gap-2"
											>
												<ColorIcon icon={Icon} color={option.color} size="sm" />
												<span>{option.name}</span>
											</CommandItem>
										);
									})}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			)}

			{/* Selected lesson types as tags */}
			{selectedOptions.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{selectedOptions.map((option) => {
						const Icon = option.icon ? resolveIconFromList(MUSIC_ICONS, option.icon) : undefined;
						return (
							<div
								key={option.id}
								className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-sm"
							>
								<ColorIcon icon={Icon} color={option.color} size="sm" />
								<span>{option.name}</span>
								{!disabled && (
									<button
										type="button"
										onClick={() => handleRemove(option.id)}
										className="ml-1 rounded-sm hover:bg-accent p-0.5 transition-colors"
										aria-label={`Verwijder ${option.name}`}
									>
										<LuX className="h-3 w-3" />
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
