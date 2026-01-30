import { useMemo, useState } from 'react';
import { LuArrowDown, LuArrowUp, LuArrowUpDown, LuSearch, LuTrash2 } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface DataTableProps<T> {
	title: string;
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
}

export function DataTable<T>({
	title,
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
}: DataTableProps<T>) {
	const [sortColumn, setSortColumn] = useState<string | null>(initialSortColumn ?? null);
	const [sortDirection, setSortDirection] = useState<SortDirection>(
		initialSortColumn ? (initialSortDirection ?? 'asc') : null,
	);
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

	return (
		<Card>
			<CardHeader>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<CardTitle>{title}</CardTitle>
						{headerActions}
					</div>
					{onSearchChange && (
						<div className="relative">
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
													className={cn('pb-3 font-medium', column.className)}
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
												<td key={column.key} className={cn('py-4', column.className)}>
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
