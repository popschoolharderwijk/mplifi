import { useEffect, useMemo, useRef, useState } from 'react';
import type { IconType } from 'react-icons';
import {
	LuArrowDown,
	LuArrowUp,
	LuArrowUpDown,
	LuChevronLeft,
	LuChevronRight,
	LuFilter,
	LuSearch,
	LuTrash2,
} from 'react-icons/lu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ColorIcon } from '@/components/ui/color-icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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

// Server-side pagination props (controlled mode)
export interface ServerPaginationProps {
	totalCount: number;
	currentPage: number;
	rowsPerPage: number;
	onPageChange: (page: number) => void;
	onRowsPerPageChange: (rowsPerPage: number) => void;
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
	rowsPerPage?: number;
	// Server-side pagination (controlled mode)
	serverPagination?: ServerPaginationProps;
	// Debounce delay for search input (useful for server-side search)
	searchDebounceMs?: number;
	// Callback for server-side sorting (called when sort changes)
	onSortChange?: (column: string | null, direction: SortDirection) => void;
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
	rowsPerPage: initialRowsPerPage = 20,
	serverPagination,
	searchDebounceMs = 0,
	onSortChange,
}: DataTableProps<T>) {
	const [sortColumn, setSortColumn] = useState<string | null>(initialSortColumn ?? null);
	const [sortDirection, setSortDirection] = useState<SortDirection>(
		initialSortColumn ? (initialSortDirection ?? 'asc') : null,
	);
	const [filterOpen, setFilterOpen] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
	const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery ?? '');
	const searchInputRef = useAutofocus<HTMLInputElement>(!!onSearchChange);
	const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Determine if we're in server-side pagination mode
	const isServerPagination = !!serverPagination;

	// Handle debounced search
	const handleSearchChange = (value: string) => {
		setLocalSearchQuery(value);

		if (searchDebounceMs > 0 && onSearchChange) {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
			searchTimeoutRef.current = setTimeout(() => {
				onSearchChange(value);
			}, searchDebounceMs);
		} else if (onSearchChange) {
			onSearchChange(value);
		}
	};

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
		};
	}, []);

	// Sync local search query with prop (for controlled mode)
	useEffect(() => {
		if (searchQuery !== undefined && searchQuery !== localSearchQuery) {
			setLocalSearchQuery(searchQuery);
		}
	}, [searchQuery, localSearchQuery]);

	// Sync sort state with initial props (for server-side pagination)
	useEffect(() => {
		if (isServerPagination && initialSortColumn !== undefined) {
			setSortColumn(initialSortColumn ?? null);
			setSortDirection(initialSortColumn ? (initialSortDirection ?? 'asc') : null);
		}
	}, [isServerPagination, initialSortColumn, initialSortDirection]);

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

	const previousDataLengthRef = useRef(filteredData.length);

	const handleSort = (columnKey: string) => {
		const column = columns.find((col) => col.key === columnKey);
		if (!column || column.sortable === false) return;

		let newSortColumn: string | null;
		let newSortDirection: SortDirection;

		if (sortColumn === columnKey) {
			// Cycle: asc -> desc -> asc (no null state)
			if (sortDirection === 'asc') {
				newSortColumn = columnKey;
				newSortDirection = 'desc';
			} else {
				// desc or null -> asc
				newSortColumn = columnKey;
				newSortDirection = 'asc';
			}
		} else {
			// Different column: set to asc, previous column becomes null
			newSortColumn = columnKey;
			newSortDirection = 'asc';
		}

		setSortColumn(newSortColumn);
		setSortDirection(newSortDirection);

		// Call server-side sort callback if provided
		if (onSortChange) {
			onSortChange(newSortColumn, newSortDirection);
		}
	};

	const sortedData = useMemo(() => {
		const dataToSort = filteredData;

		// For server-side pagination, don't sort locally - server handles it
		if (isServerPagination) {
			return dataToSort;
		}

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
	}, [filteredData, sortColumn, sortDirection, columns, isServerPagination]);

	// Pagination calculations - use server-side values if available
	const effectiveRowsPerPage = isServerPagination ? serverPagination.rowsPerPage : rowsPerPage;
	const effectiveCurrentPage = isServerPagination ? serverPagination.currentPage : currentPage;
	const effectiveTotalCount = isServerPagination ? serverPagination.totalCount : sortedData.length;

	const totalPages = Math.max(1, Math.ceil(effectiveTotalCount / effectiveRowsPerPage));
	const startIndex = (effectiveCurrentPage - 1) * effectiveRowsPerPage;
	const endIndex = startIndex + effectiveRowsPerPage;

	// For client-side pagination, slice the data; for server-side, use data as-is
	const paginatedData = isServerPagination ? data : sortedData.slice(startIndex, endIndex);

	// Track previous rows per page for client-side pagination reset
	const previousRowsPerPageRef = useRef(rowsPerPage);
	useEffect(() => {
		if (!isServerPagination && previousRowsPerPageRef.current !== rowsPerPage) {
			setCurrentPage(1);
			previousRowsPerPageRef.current = rowsPerPage;
		}
	}, [isServerPagination, rowsPerPage]);

	// Reset to page 1 when search/filter changes (client-side only)
	useEffect(() => {
		if (!isServerPagination && previousDataLengthRef.current !== filteredData.length) {
			setCurrentPage(1);
			previousDataLengthRef.current = filteredData.length;
		}
	}, [filteredData.length, isServerPagination]);

	// Ensure current page is valid when data changes (client-side only)
	useEffect(() => {
		if (!isServerPagination && currentPage > totalPages) {
			setCurrentPage(Math.max(1, totalPages));
		}
	}, [currentPage, totalPages, isServerPagination]);

	// Page change handlers
	const handlePageChange = (page: number) => {
		if (isServerPagination) {
			serverPagination.onPageChange(page);
		} else {
			setCurrentPage(page);
		}
	};

	const handleRowsPerPageChange = (newRowsPerPage: number) => {
		if (isServerPagination) {
			serverPagination.onRowsPerPageChange(newRowsPerPage);
		} else {
			setRowsPerPage(newRowsPerPage);
			setCurrentPage(1);
		}
	};

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
									value={localSearchQuery}
									onChange={(e) => handleSearchChange(e.target.value)}
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
													{activeFilters.length > 0
														? 'Actieve filters'
														: 'Geen actieve filters'}
												</div>
												{activeFilters.length > 0 && (
													<div className="space-y-0.5">
														{activeFilters.map((filter) => (
															<div
																key={`${filter.category}-${filter.value}`}
																className="text-sm"
															>
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
									{quickFilter.map((group) => (
										<div key={group.label} className="space-y-1.5">
											<div className="text-xs font-medium text-muted-foreground">
												{group.label}
											</div>
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
															onClick={() =>
																group.onChange(isSelected ? null : option.id)
															}
															className={cn('h-8 px-3 text-sm', option.icon && 'gap-1')}
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
				<div className="overflow-x-auto">
					<table className="w-full table-fixed">
						<thead className="bg-muted/30">
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
													className="h-auto p-0 font-medium text-muted-foreground hover:bg-transparent hover:text-muted-foreground focus-visible:bg-transparent focus-visible:text-muted-foreground"
													onClick={() => !loading && handleSort(column.key)}
													style={{ pointerEvents: loading ? 'none' : 'auto' }}
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
							{loading && paginatedData.length === 0 ? (
								// Show skeleton loaders when loading and no data
								Array.from({ length: effectiveRowsPerPage }, () => (
									<tr
										key={`skeleton-${Math.random().toString(36).substring(2, 9)}`}
										className="border-b last:border-0"
									>
										{columns.map((column) => (
											<td
												key={column.key}
												className={cn('py-4 pr-4 first:pl-2 last:pr-2', column.className)}
											>
												<Skeleton className="h-4 w-full" />
											</td>
										))}
										{rowActions && <td className="py-4" />}
									</tr>
								))
							) : paginatedData.length === 0 ? (
								// Show empty message
								<tr>
									<td
										colSpan={columns.length + (rowActions ? 1 : 0)}
										className="py-12 text-center text-muted-foreground"
									>
										{emptyMessage}
									</td>
								</tr>
							) : (
								// Show actual data
								paginatedData.map((item) => (
									<tr
										key={getRowKey(item)}
										className={cn(
											'border-b last:border-0 transition-colors',
											rowActions?.onEdit && 'cursor-pointer hover:bg-muted/50',
											getRowClassName?.(item),
											loading && 'opacity-50',
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
								))
							)}
						</tbody>
					</table>
				</div>
				<div className="mt-4 flex items-center justify-between">
					<div className="text-sm text-muted-foreground">
						{effectiveTotalCount === 0
							? 'Geen resultaten'
							: effectiveTotalCount === 1
								? '1 resultaat'
								: `${startIndex + 1}-${Math.min(endIndex, effectiveTotalCount)} van ${effectiveTotalCount} resultaten`}
					</div>
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">Rijen per pagina:</span>
							<Select
								value={String(effectiveRowsPerPage)}
								onValueChange={(value) => handleRowsPerPageChange(Number.parseInt(value, 10))}
							>
								<SelectTrigger className="h-8 w-[70px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="10">10</SelectItem>
									<SelectItem value="20">20</SelectItem>
									<SelectItem value="50">50</SelectItem>
									<SelectItem value="100">100</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8"
								onClick={() => handlePageChange(Math.max(1, effectiveCurrentPage - 1))}
								disabled={effectiveCurrentPage === 1 || loading}
							>
								<LuChevronLeft className="h-4 w-4" />
							</Button>
							<span className="text-sm text-muted-foreground">
								Pagina {effectiveCurrentPage} van {totalPages}
							</span>
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8"
								onClick={() => handlePageChange(Math.min(totalPages, effectiveCurrentPage + 1))}
								disabled={effectiveCurrentPage === totalPages || loading}
							>
								<LuChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
