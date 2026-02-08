import { useMemo, useState } from 'react';
import type { IconType } from 'react-icons';
import { LuArrowDown, LuArrowUp, LuArrowUpDown, LuFilter, LuSearch, LuTrash2 } from 'react-icons/lu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ColorIcon } from '@/components/ui/color-icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAutofocus } from '@/hooks/useAutofocus';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

export interface DataTableColumn<T> {
	key: string;
	label: string;
	render?: (item: T) => React.ReactNode;
	className?: string;
	sortable?: boolean;
	sortValue?: (item: T) => string | number | Date;
}

export interface DataTableRowActions<T> {
	onEdit?: (item: T) => void;
	onDelete?: (item: T) => void;
	render?: (item: T) => React.ReactNode;
}

export interface QuickFilterOption {
	id: string;
	label: string;
	icon?: IconType;
	color?: string;
}

export interface QuickFilterGroup {
	label: string;
	value: string | null;
	options: QuickFilterOption[];
	onChange: (value: string | null) => void;
	showAllOption?: boolean;
	allOptionLabel?: string;
}

interface DataTableProps<T> {
	title: string;
	description?: React.ReactNode;
	data: T[];
	columns: DataTableColumn<T>[];
	searchQuery?: string;
	onSearchChange?: (query: string) => void;
	searchPlaceholder?: string;
	searchFields?: ((item: T) => string | null | undefined)[];
	loading?: boolean;
	getRowKey: (item: T) => string;
	getRowClassName?: (item: T) => string | undefined;
	emptyMessage?: string;
	headerActions?: React.ReactNode;
	initialSortColumn?: string;
	initialSortDirection?: SortDirection;
	rowActions?: DataTableRowActions<T>;
	quickFilter?: QuickFilterGroup[];
}

export function DataTable<T>({
	title,
	description,
	data,
	columns,
	searchQuery,
	onSearchChange,
	searchPlaceholder = 'Zoeken...',
	searchFields,
	loading = false,
	getRowKey,
	getRowClassName,
	emptyMessage = 'Geen resultaten gevonden',
	headerActions,
	initialSortColumn,
	initialSortDirection = 'asc',
	rowActions,
	quickFilter,
}: DataTableProps<T>) {
	const [sortColumn, setSortColumn] = useState<string | null>(initialSortColumn ?? null);
	const [sortDirection, setSortDirection] = useState<SortDirection>(
		initialSortColumn ? (initialSortDirection ?? 'asc') : null,
	);
	const [filterOpen, setFilterOpen] = useState(false);
	const searchInputRef = useAutofocus<HTMLInputElement>(!!onSearchChange);

	// Filter data based on search query if searchFields are provided
	const filteredData = useMemo(() => {
		if (!searchQuery || !searchFields || searchFields.length === 0) {
			return data;
		}

		const query = searchQuery.toLowerCase();
		return data.filter((item) =>
			searchFields.some((field) => {
				const value = field(item);
				return value?.toLowerCase().includes(query);
			}),
		);
	}, [data, searchQuery, searchFields]);

	const handleSort = (columnKey: string) => {
		const column = columns.find((col) => col.key === columnKey);
		if (!column || column.sortable === false) return;

		if (sortColumn === columnKey) {
			// Cycle: asc -> desc -> null
			if (sortDirection === 'asc') {
				setSortDirection('desc');
			} else if (sortDirection === 'desc') {
				setSortColumn(null);
				setSortDirection(null);
			}
		} else {
			setSortColumn(columnKey);
			setSortDirection('asc');
		}
	};

	const sortedData = useMemo(() => {
		const dataToSort = filteredData;
		if (!sortColumn || !sortDirection) return dataToSort;

		const column = columns.find((col) => col.key === sortColumn);
		if (!column || column.sortable === false) return dataToSort;

		const getValue = (item: T) => {
			if (column.sortValue) {
				return column.sortValue(item);
			}
			const value = item[column.key as keyof T];
			if (value instanceof Date) {
				return value.getTime();
			}
			return String(value ?? '').toLowerCase();
		};

		return [...dataToSort].sort((a, b) => {
			const aValue = getValue(a);
			const bValue = getValue(b);

			if (aValue < bValue) {
				return sortDirection === 'asc' ? -1 : 1;
			}
			if (aValue > bValue) {
				return sortDirection === 'asc' ? 1 : -1;
			}
			return 0;
		});
	}, [filteredData, sortColumn, sortDirection, columns]);

	// Count active filters
	const activeFilterCount = useMemo(() => {
		if (!quickFilter) return 0;
		return quickFilter.filter((group) => group.value !== null).length;
	}, [quickFilter]);

	// Get active filter details for tooltip
	const activeFilters = useMemo(() => {
		if (!quickFilter) return [];
		return quickFilter
			.filter((group) => group.value !== null)
			.map((group) => {
				const selectedOption = group.options.find((opt) => opt.id === group.value);
				return {
					category: group.label,
					value: selectedOption?.label ?? group.value,
				};
			});
	}, [quickFilter]);

	return (
		<Card>
			<CardHeader>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>{title}</CardTitle>
							{description && <CardDescription className="mt-1">{description}</CardDescription>}
						</div>
						{headerActions}
					</div>
					{onSearchChange && (
						<div className="relative flex items-center gap-2">
							<div className="relative flex-1">
								<LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<input
									ref={searchInputRef}
									type="text"
									placeholder={searchPlaceholder}
									value={searchQuery ?? ''}
									onChange={(e) => onSearchChange(e.target.value)}
									className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							{quickFilter && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant={filterOpen ? 'default' : 'outline'}
												size="icon"
												className="relative h-9 w-9 shrink-0"
												onClick={() => setFilterOpen(!filterOpen)}
												aria-label="Toggle filter"
											>
												<LuFilter className="h-4 w-4" />
												{activeFilterCount > 0 && (
													<Badge
														variant="destructive"
														className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
													>
														{activeFilterCount}
													</Badge>
												)}
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<div className="space-y-1">
												<div className="text-sm font-semibold">
													{activeFilters.length > 0 ? 'Actieve filters' : 'Geen actieve filters'}
												</div>
												{activeFilters.length > 0 && (
													<div className="space-y-0.5">
														{activeFilters.map((filter, index) => (
															<div key={index} className="text-sm">
																{filter.category}: {filter.value}
															</div>
														))}
													</div>
												)}
											</div>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
						</div>
					)}
					{quickFilter && quickFilter.length > 0 && (
						<div
							className={cn(
								'overflow-hidden transition-all duration-300 ease-in-out',
								filterOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
							)}
						>
							<div className="pt-2">
								<div className="space-y-2 rounded-md border bg-card p-3">
									{quickFilter.map((group, groupIndex) => (
										<div key={groupIndex} className="space-y-1.5">
											<div className="text-xs font-medium text-muted-foreground">{group.label}</div>
											<div className="flex flex-wrap items-center gap-2">
												{group.showAllOption !== false && (
													<Button
														variant={group.value === null ? 'default' : 'outline'}
														size="sm"
														onClick={() => group.onChange(null)}
														className="h-8 px-3 text-sm"
													>
														{group.allOptionLabel ?? 'Alle'}
													</Button>
												)}
												{group.options.map((option) => {
													const isSelected = group.value === option.id;
													return (
														<Button
															key={option.id}
															variant={isSelected ? 'default' : 'outline'}
															size="sm"
															onClick={() => group.onChange(isSelected ? null : option.id)}
															className={cn(
																'h-8 px-3 text-sm',
																option.icon && 'gap-1',
															)}
														>
															{option.icon && (
																<ColorIcon
																	icon={option.icon}
																	color={option.color}
																	size="sm"
																/>
															)}
															<span>{option.label}</span>
														</Button>
													);
												})}
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-muted-foreground">Laden...</p>
				) : sortedData.length === 0 ? (
					<p className="text-muted-foreground">{emptyMessage}</p>
				) : (
					<>
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr className="border-b text-left text-sm text-muted-foreground">
										{columns.map((column) => {
											const isSortable = column.sortable !== false;
											const isSorted = sortColumn === column.key;
											const SortIcon =
												!isSorted || sortDirection === null
													? LuArrowUpDown
													: sortDirection === 'asc'
														? LuArrowUp
														: LuArrowDown;

											return (
												<th
													key={column.key}
													className={cn(
														'pb-3 pr-4 font-medium first:pl-2 last:pr-2',
														column.className,
													)}
												>
													{isSortable ? (
														<Button
															variant="ghost"
															size="sm"
															className="h-auto p-0 font-medium hover:bg-transparent"
															onClick={() => handleSort(column.key)}
														>
															<div className="flex items-center gap-2">
																<span>{column.label}</span>
																<SortIcon
																	className={cn(
																		'h-3.5 w-3.5 transition-opacity',
																		isSorted ? 'opacity-100' : 'opacity-40',
																	)}
																/>
															</div>
														</Button>
													) : (
														<span>{column.label}</span>
													)}
												</th>
											);
										})}
										{rowActions && <th className="pb-3 font-medium w-12" />}
									</tr>
								</thead>
								<tbody>
									{sortedData.map((item) => (
										<tr
											key={getRowKey(item)}
											className={cn(
												'border-b last:border-0 transition-colors',
												rowActions?.onEdit && 'cursor-pointer hover:bg-muted/50',
												getRowClassName?.(item),
											)}
											onClick={() => rowActions?.onEdit?.(item)}
											onKeyDown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													rowActions?.onEdit?.(item);
												}
											}}
											tabIndex={rowActions?.onEdit ? 0 : undefined}
											role={rowActions?.onEdit ? 'button' : undefined}
										>
											{columns.map((column) => (
												<td
													key={column.key}
													className={cn('py-4 pr-4 first:pl-2 last:pr-2', column.className)}
												>
													{column.render
														? column.render(item)
														: String(item[column.key as keyof T] ?? '')}
												</td>
											))}
											{rowActions && (
												<td
													className="py-4"
													onClick={(e) => {
														e.stopPropagation();
													}}
													onKeyDown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.stopPropagation();
														}
													}}
												>
													{rowActions.render ? (
														rowActions.render(item)
													) : (
														<div className="flex items-center gap-2">
															{rowActions.onDelete && (
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
																	onClick={() => rowActions.onDelete?.(item)}
																>
																	<LuTrash2 className="h-4 w-4" />
																</Button>
															)}
														</div>
													)}
												</td>
											)}
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="mt-4 text-sm text-muted-foreground">{sortedData.length} resultaten</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
