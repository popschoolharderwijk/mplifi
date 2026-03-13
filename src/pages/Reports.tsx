import {
	endOfMonth,
	endOfQuarter,
	endOfYear,
	startOfMonth,
	startOfQuarter,
	startOfYear,
	subMonths,
	subQuarters,
} from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuClock, LuTrash2, LuUsers } from 'react-icons/lu';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type DataTableColumn, type QuickFilterGroup } from '@/components/ui/data-table';
import { DatePicker } from '@/components/ui/date-picker';
import { resolveIconFromList } from '@/components/ui/icon-picker';
import { Label } from '@/components/ui/label';
import { LessonTypeBadge } from '@/components/ui/lesson-type-badge';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { UserDisplay } from '@/components/ui/user-display';
import { UserSelectSingle } from '@/components/ui/user-select';
import { NAV_ICONS, NAV_LABELS } from '@/config/nav-labels';
import { MUSIC_ICONS } from '@/constants/icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDateToDb } from '@/lib/date/date-format';
import { formatDurationMinutes } from '@/lib/time/time-format';

// --- Types ---

interface ReportRow {
	teacher_user_id: string;
	teacher_name: string;
	lesson_type_id: string;
	lesson_type_name: string;
	lesson_type_color: string;
	lesson_type_icon: string;
	age_category: 'under_18' | '18_plus' | 'unknown';
	total_minutes: number;
	lesson_count: number;
}

type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom';

// --- Helpers ---

function getPresetDates(preset: PeriodPreset): { start: string; end: string } {
	const now = new Date();
	switch (preset) {
		case 'this_month':
			return { start: formatDateToDb(startOfMonth(now)), end: formatDateToDb(endOfMonth(now)) };
		case 'last_month': {
			const prev = subMonths(now, 1);
			return { start: formatDateToDb(startOfMonth(prev)), end: formatDateToDb(endOfMonth(prev)) };
		}
		case 'this_quarter':
			return { start: formatDateToDb(startOfQuarter(now)), end: formatDateToDb(endOfQuarter(now)) };
		case 'last_quarter': {
			const prevQ = subQuarters(now, 1);
			return { start: formatDateToDb(startOfQuarter(prevQ)), end: formatDateToDb(endOfQuarter(prevQ)) };
		}
		case 'this_year':
			return { start: formatDateToDb(startOfYear(now)), end: formatDateToDb(endOfYear(now)) };
		default:
			return { start: formatDateToDb(startOfMonth(now)), end: formatDateToDb(endOfMonth(now)) };
	}
}

const AGE_LABELS: Record<string, string> = {
	under_18: 'Onder 18',
	'18_plus': '18+',
	unknown: 'Onbekend',
};

const PRESET_LABELS: Record<PeriodPreset, string> = {
	this_month: 'Deze maand',
	last_month: 'Vorige maand',
	this_quarter: 'Dit kwartaal',
	last_quarter: 'Vorig kwartaal',
	this_year: 'Dit jaar',
	custom: 'Aangepast',
};

// --- ReportsDataTable (DataTable with search + quick filter) ---

interface ReportLessonTypeOption {
	id: string;
	label: string;
	icon: string;
	color: string;
}

function ReportsDataTable({
	data,
	isPrivileged,
	loading,
	tableSearchQuery,
	onTableSearchChange,
	tableLessonTypeId,
	onTableLessonTypeChange,
	tableAgeCategory,
	onTableAgeCategoryChange,
	reportLessonTypeOptions,
}: {
	data: ReportRow[];
	isPrivileged: boolean;
	loading: boolean;
	tableSearchQuery: string;
	onTableSearchChange: (q: string) => void;
	tableLessonTypeId: string | null;
	onTableLessonTypeChange: (id: string | null) => void;
	tableAgeCategory: string | null;
	onTableAgeCategoryChange: (cat: string | null) => void;
	reportLessonTypeOptions: ReportLessonTypeOption[];
}) {
	const columns: DataTableColumn<ReportRow>[] = useMemo(() => {
		const cols: DataTableColumn<ReportRow>[] = [];
		if (isPrivileged) {
			cols.push({
				key: 'teacher_name',
				label: 'Docent',
				sortable: true,
				sortValue: (r) => r.teacher_name.toLowerCase(),
				render: (row) => (
					<UserDisplay
						profile={{
							first_name: null,
							last_name: null,
							email: row.teacher_name,
							avatar_url: null,
						}}
					/>
				),
			});
		}
		cols.push(
			{
				key: 'lesson_type_name',
				label: 'Lessoort',
				sortable: true,
				sortValue: (r) => r.lesson_type_name.toLowerCase(),
				render: (row) => (
					<LessonTypeBadge
						lessonType={{
							name: row.lesson_type_name,
							icon: row.lesson_type_icon,
							color: row.lesson_type_color,
						}}
						size="sm"
					/>
				),
			},
			{
				key: 'age_category',
				label: 'Leeftijd',
				sortable: true,
				sortValue: (r) => r.age_category,
				render: (row) => (
					<Badge
						variant={
							row.age_category === 'under_18'
								? 'secondary'
								: row.age_category === '18_plus'
									? 'outline'
									: 'default'
						}
					>
						{AGE_LABELS[row.age_category]}
					</Badge>
				),
			},
			{
				key: 'lesson_count',
				label: 'Lessen',
				sortable: true,
				sortValue: (r) => r.lesson_count,
				className: 'text-right tabular-nums',
				render: (row) => <span className="tabular-nums">{row.lesson_count}</span>,
			},
			{
				key: 'total_minutes',
				label: 'Uren',
				sortable: true,
				sortValue: (r) => r.total_minutes,
				className: 'text-right tabular-nums',
				render: (row) => (
					<span className="font-medium tabular-nums">{formatDurationMinutes(row.total_minutes)}</span>
				),
			},
		);
		return cols;
	}, [isPrivileged]);

	const quickFilter: QuickFilterGroup[] = useMemo(() => {
		const groups: QuickFilterGroup[] = [
			{
				label: 'Lessoort',
				value: tableLessonTypeId,
				options: reportLessonTypeOptions.map((opt) => ({
					id: opt.id,
					label: opt.label,
					icon: opt.icon ? resolveIconFromList(MUSIC_ICONS, opt.icon) : undefined,
					color: opt.color,
				})),
				onChange: onTableLessonTypeChange,
				showAllOption: true,
				allOptionLabel: 'Alle',
			},
			{
				label: 'Leeftijd',
				value: tableAgeCategory,
				options: [
					{ id: 'under_18', label: 'Onder 18' },
					{ id: '18_plus', label: '18+' },
				],
				onChange: onTableAgeCategoryChange,
				showAllOption: true,
				allOptionLabel: 'Alle',
			},
		];
		return groups;
	}, [
		tableLessonTypeId,
		tableAgeCategory,
		reportLessonTypeOptions,
		onTableLessonTypeChange,
		onTableAgeCategoryChange,
	]);

	return (
		<DataTable<ReportRow>
			title=""
			data={data}
			columns={columns}
			searchQuery={tableSearchQuery}
			onSearchChange={onTableSearchChange}
			searchPlaceholder="Zoeken op docent of lessoort..."
			searchFields={[(r) => r.teacher_name, (r) => r.lesson_type_name, (r) => AGE_LABELS[r.age_category]]}
			loading={loading}
			getRowKey={(row) => `${row.teacher_user_id}-${row.lesson_type_id}-${row.age_category}`}
			emptyMessage="Geen gegevens gevonden voor de geselecteerde periode en filters."
			initialSortColumn="total_minutes"
			initialSortDirection="desc"
			quickFilter={quickFilter}
			rowsPerPage={20}
			paginated={true}
		/>
	);
}

// --- Component ---

export default function Reports() {
	const { isPrivileged, isTeacher, isLoading: authLoading } = useAuth();
	const hasAccess = isPrivileged || isTeacher;

	// Period state
	const [preset, setPreset] = useState<PeriodPreset>('this_month');
	const initialDates = getPresetDates('this_month');
	const [startDate, setStartDate] = useState(initialDates.start);
	const [endDate, setEndDate] = useState(initialDates.end);

	// Filter state (API: teacher filter for privileged)
	const [selectedTeacherUserId, setSelectedTeacherUserId] = useState<string>('all');

	// Table: search + quick filters (client-side)
	const [tableSearchQuery, setTableSearchQuery] = useState('');
	const [tableLessonTypeId, setTableLessonTypeId] = useState<string | null>(null);
	const [tableAgeCategory, setTableAgeCategory] = useState<string | null>(null);

	// Data state
	const [data, setData] = useState<ReportRow[]>([]);
	const [loading, setLoading] = useState(true);

	// Handle preset change
	const handlePresetChange = (newPreset: PeriodPreset) => {
		setPreset(newPreset);
		if (newPreset !== 'custom') {
			const dates = getPresetDates(newPreset);
			setStartDate(dates.start);
			setEndDate(dates.end);
		}
	};

	// Load report data
	const loadReport = useCallback(async () => {
		if (!hasAccess || !startDate || !endDate) return;

		setLoading(true);
		const params: { p_start_date: string; p_end_date: string; p_teacher_user_id?: string } = {
			p_start_date: startDate,
			p_end_date: endDate,
		};
		if (isPrivileged && selectedTeacherUserId !== 'all') {
			params.p_teacher_user_id = selectedTeacherUserId;
		}

		const { data: result, error } = await supabase.rpc('get_hours_report', params);

		if (error) {
			console.error('Error loading report:', error);
			toast.error('Fout bij laden rapportage');
			setLoading(false);
			return;
		}

		const parsed = result as unknown as { data: ReportRow[] };
		setData(parsed?.data || []);
		setLoading(false);
	}, [hasAccess, startDate, endDate, isPrivileged, selectedTeacherUserId]);

	useEffect(() => {
		if (!authLoading && hasAccess) {
			loadReport();
		}
	}, [authLoading, hasAccess, loadReport]);

	// Filtered by quick filter only (lesson type + age); DataTable will apply search + sort + pagination
	const filteredData = useMemo(() => {
		return data.filter((row) => {
			if (tableLessonTypeId != null && row.lesson_type_id !== tableLessonTypeId) return false;
			if (tableAgeCategory != null && row.age_category !== tableAgeCategory) return false;
			return true;
		});
	}, [data, tableLessonTypeId, tableAgeCategory]);

	// Same as DataTable: filter by search query so summary matches visible rows
	const dataVisibleInTable = useMemo(() => {
		const query = tableSearchQuery.trim().toLowerCase();
		if (query === '') return filteredData;
		const searchFields = [
			(r: ReportRow) => r.teacher_name,
			(r: ReportRow) => r.lesson_type_name,
			(r: ReportRow) => AGE_LABELS[r.age_category],
		];
		return filteredData.filter((row) =>
			searchFields.some((field) => {
				const value = field(row);
				return value?.toLowerCase().includes(query);
			}),
		);
	}, [filteredData, tableSearchQuery]);

	// Unique lesson types from data for quick filter options
	const reportLessonTypeOptions = useMemo(() => {
		const seen = new Set<string>();
		return data
			.filter((r) => {
				if (seen.has(r.lesson_type_id)) return false;
				seen.add(r.lesson_type_id);
				return true;
			})
			.map((r) => ({
				id: r.lesson_type_id,
				label: r.lesson_type_name,
				icon: r.lesson_type_icon,
				color: r.lesson_type_color,
			}));
	}, [data]);

	// Summary stats: based on rows currently visible in table (quick filter + search)
	const summary = useMemo(() => {
		const totalMinutes = dataVisibleInTable.reduce((sum, r) => sum + r.total_minutes, 0);
		const totalLessons = dataVisibleInTable.reduce((sum, r) => sum + r.lesson_count, 0);
		const under18Minutes = dataVisibleInTable
			.filter((r) => r.age_category === 'under_18')
			.reduce((sum, r) => sum + r.total_minutes, 0);
		const over18Minutes = dataVisibleInTable
			.filter((r) => r.age_category === '18_plus')
			.reduce((sum, r) => sum + r.total_minutes, 0);
		return { totalMinutes, totalLessons, under18Minutes, over18Minutes };
	}, [dataVisibleInTable]);

	// Redirect if no access
	if (!authLoading && !hasAccess) {
		return <Navigate to="/" replace />;
	}

	if (authLoading) {
		return <PageSkeleton variant="header-and-cards" />;
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title={NAV_LABELS.reports}
				subtitle="Urenrapportage per docent, lessoort en leeftijdscategorie"
			/>

			{/* Period presets */}
			<div className="flex flex-wrap gap-2">
				{(Object.keys(PRESET_LABELS) as PeriodPreset[]).map((p) => (
					<Button
						key={p}
						variant={preset === p ? 'default' : 'outline'}
						size="sm"
						onClick={() => handlePresetChange(p)}
					>
						{PRESET_LABELS[p]}
					</Button>
				))}
			</div>

			{/* Custom date range (always shown but disabled unless custom) */}
			{preset === 'custom' && (
				<div className="flex flex-wrap items-end gap-4">
					<div className="space-y-1.5">
						<Label>Startdatum</Label>
						<DatePicker value={startDate} onChange={(v) => setStartDate(v || '')} />
					</div>
					<div className="space-y-1.5">
						<Label>Einddatum</Label>
						<DatePicker value={endDate} onChange={(v) => setEndDate(v || '')} />
					</div>
				</div>
			)}

			{/* Teacher filter (API) - staff/admin only */}
			{isPrivileged && (
				<div className="flex flex-wrap items-end gap-4">
					<div className="space-y-1.5 min-w-[280px]">
						<Label>Docent</Label>
						<div className="flex items-center gap-2">
							<UserSelectSingle
								filter="teachers"
								value={selectedTeacherUserId === 'all' ? null : selectedTeacherUserId}
								onChange={(user) => {
									setSelectedTeacherUserId(user?.user_id ?? 'all');
								}}
								placeholder="Alle docenten"
							/>
							{selectedTeacherUserId !== 'all' && (
								<Button
									type="button"
									variant="outline"
									size="icon"
									onClick={() => setSelectedTeacherUserId('all')}
									className="h-10 w-10 flex-shrink-0"
									title="Selectie wissen"
								>
									<LuTrash2 className="h-4 w-4 text-muted-foreground" />
								</Button>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Summary cards */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<LuClock className="h-4 w-4" />
							Totaal uren
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatDurationMinutes(summary.totalMinutes)}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<NAV_ICONS.reports className="h-4 w-4" />
							Totaal lessen
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{summary.totalLessons}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<LuUsers className="h-4 w-4" />
							Uren onder 18
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatDurationMinutes(summary.under18Minutes)}</div>
						<p className="text-xs text-muted-foreground">Vrijgesteld van BTW</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<LuUsers className="h-4 w-4" />
							Uren 18+
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatDurationMinutes(summary.over18Minutes)}</div>
						<p className="text-xs text-muted-foreground">BTW-plichtig</p>
					</CardContent>
				</Card>
			</div>

			{/* Results: DataTable with search, quick filter (lesson type, age), client-side pagination */}
			{loading ? (
				<PageSkeleton variant="header-and-cards" />
			) : (
				<ReportsDataTable
					data={filteredData}
					isPrivileged={isPrivileged}
					loading={false}
					tableSearchQuery={tableSearchQuery}
					onTableSearchChange={setTableSearchQuery}
					tableLessonTypeId={tableLessonTypeId}
					onTableLessonTypeChange={setTableLessonTypeId}
					tableAgeCategory={tableAgeCategory}
					onTableAgeCategoryChange={setTableAgeCategory}
					reportLessonTypeOptions={reportLessonTypeOptions}
				/>
			)}
		</div>
	);
}
