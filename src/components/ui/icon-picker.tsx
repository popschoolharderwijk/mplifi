import { useMemo, useState } from 'react';
import type { IconType } from 'react-icons';
import { LuCheck, LuSearch } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** Single icon entry with its display label and component */
export interface IconEntry {
	label: string;
	component: IconType;
}

/** Icon list definition: maps icon key to its label and component */
export type IconList = Record<string, IconEntry>;

/** Resolve an icon component from an IconList by key. Returns undefined if not found. */
export function resolveIconFromList(list: IconList, key: string): IconType | undefined {
	return list[key]?.component;
}

interface IconPickerProps {
	/** Currently selected icon key (e.g. "LuGuitar") */
	value?: string;
	/** Callback when an icon is selected */
	onChange: (iconName: string) => void;
	/** Icon list to display */
	icons: IconList;
	/** Placeholder text shown when no icon is selected */
	placeholder?: string;
	/** Search input placeholder */
	searchPlaceholder?: string;
	className?: string;
}

export function IconPicker({
	value,
	onChange,
	icons,
	placeholder = 'Selecteer icoon',
	searchPlaceholder = 'Zoek icoon...',
	className,
}: IconPickerProps) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	// Filter icons based on search query, always sorted alphabetically by label
	const filteredIcons = useMemo(() => {
		const sortByLabel = (a: string, b: string) => icons[a].label.localeCompare(icons[b].label);
		const keys = Object.keys(icons);

		if (!searchQuery.trim()) return keys.sort(sortByLabel);

		const query = searchQuery.toLowerCase();
		return keys
			.filter((key) => {
				const label = icons[key].label.toLowerCase();
				return label.includes(query) || key.toLowerCase().includes(query);
			})
			.sort(sortByLabel);
	}, [searchQuery, icons]);

	// Get the icon component for display
	const SelectedIcon = value ? (icons[value]?.component ?? null) : null;
	const displayLabel = value ? (icons[value]?.label ?? value) : placeholder;

	const handleSelect = (iconName: string) => {
		onChange(iconName);
		setOpen(false);
		setSearchQuery('');
	};

	return (
		<Popover open={open} onOpenChange={setOpen} modal>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn('w-full justify-between', className)}
				>
					<div className="flex items-center gap-2">
						{SelectedIcon ? (
							<SelectedIcon className="h-4 w-4 shrink-0" />
						) : (
							<div className="h-4 w-4 shrink-0" />
						)}
						<span className="truncate">{displayLabel}</span>
					</div>
					<LuSearch className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[350px] p-0" align="start">
				<Command shouldFilter={false}>
					<CommandInput placeholder={searchPlaceholder} value={searchQuery} onValueChange={setSearchQuery} />
					<CommandList className="max-h-[350px] overflow-y-auto">
						<CommandEmpty>Geen icoon gevonden.</CommandEmpty>
						<CommandGroup>
							{filteredIcons.map((iconName) => {
								const { component: IconComponent, label } = icons[iconName];
								const isSelected = value === iconName;

								return (
									<CommandItem
										key={iconName}
										value={iconName}
										onSelect={() => handleSelect(iconName)}
										className="flex items-center gap-2"
									>
										<LuCheck
											className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
										/>
										<IconComponent className="h-4 w-4 shrink-0" />
										<span>{label}</span>
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
