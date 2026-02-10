import { useCallback, useEffect, useRef, useState } from 'react';
import type { SortDirection } from '@/components/ui/data-table';

interface UseServerTableStateOptions {
	initialSortColumn?: string;
	initialSortDirection?: SortDirection;
	searchDebounceMs?: number;
	initialRowsPerPage?: number;
	// Additional filter values to track for page reset
	additionalFilters?: Record<string, unknown>;
}

interface UseServerTableStateReturn {
	// Search state
	searchQuery: string;
	debouncedSearchQuery: string;
	handleSearchChange: (query: string) => void;

	// Pagination state
	currentPage: number;
	rowsPerPage: number;
	handlePageChange: (page: number) => void;
	handleRowsPerPageChange: (newRowsPerPage: number) => void;

	// Sorting state
	sortColumn: string | null;
	sortDirection: SortDirection;
	handleSortChange: (column: string | null, direction: SortDirection) => void;
}

/**
 * Custom hook for managing server-side table state (pagination, sorting, search).
 * Handles debouncing, state synchronization, and automatic page reset on filter/sort changes.
 */
export function useServerTableState(options: UseServerTableStateOptions = {}): UseServerTableStateReturn {
	const {
		initialSortColumn,
		initialSortDirection = 'asc',
		searchDebounceMs = 300,
		initialRowsPerPage = 20,
		additionalFilters = {},
	} = options;

	// Search state
	const [searchQuery, setSearchQuery] = useState('');
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

	// Sorting state
	const [sortColumn, setSortColumn] = useState<string | null>(initialSortColumn ?? null);
	const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortColumn ? initialSortDirection : null);

	// Debounce search query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchQuery(searchQuery);
		}, searchDebounceMs);
		return () => clearTimeout(timer);
	}, [searchQuery, searchDebounceMs]);

	// Handle search query change
	const handleSearchChange = useCallback((query: string) => {
		setSearchQuery(query);
	}, []);

	// Handle page change
	const handlePageChange = useCallback((page: number) => {
		setCurrentPage(page);
	}, []);

	// Handle rows per page change
	const handleRowsPerPageChange = useCallback((newRowsPerPage: number) => {
		setRowsPerPage(newRowsPerPage);
		setCurrentPage(1);
	}, []);

	// Handle sort change
	const handleSortChange = useCallback((column: string | null, direction: SortDirection) => {
		setSortColumn(column);
		setSortDirection(direction);
	}, []);

	// Reset to page 1 when filters/sorting change
	const prevStateRef = useRef({
		debouncedSearchQuery,
		sortColumn,
		sortDirection,
		additionalFiltersString: JSON.stringify(additionalFilters),
	});

	useEffect(() => {
		const prev = prevStateRef.current;
		const currentFiltersString = JSON.stringify(additionalFilters);
		const hasChanged =
			prev.debouncedSearchQuery !== debouncedSearchQuery ||
			prev.sortColumn !== sortColumn ||
			prev.sortDirection !== sortDirection ||
			prev.additionalFiltersString !== currentFiltersString;

		if (hasChanged) {
			setCurrentPage(1);
			prevStateRef.current = {
				debouncedSearchQuery,
				sortColumn,
				sortDirection,
				additionalFiltersString: currentFiltersString,
			};
		}
	}, [debouncedSearchQuery, sortColumn, sortDirection, additionalFilters]);

	return {
		// Search
		searchQuery,
		debouncedSearchQuery,
		handleSearchChange,

		// Pagination
		currentPage,
		rowsPerPage,
		handlePageChange,
		handleRowsPerPageChange,

		// Sorting
		sortColumn,
		sortDirection,
		handleSortChange,
	};
}
