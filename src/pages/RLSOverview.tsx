import { Fragment, useEffect, useState } from 'react';
import { LuCheck, LuChevronDown, LuChevronRight, LuMinus, LuSearch, LuShield, LuUsers, LuX } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
	analyzeRolePermissions,
	CATEGORY_DISPLAY,
	getPermissionDisplay,
	groupPermissionsByCategory,
	type PermissionCategory,
	type PermissionLevel,
} from '@/lib/rls-role-analyzer';
import { fetchTestMapping, type TestInfo } from '@/lib/rls-test-parser';
import { ALL_ROLES, getRoleDisplayName, RoleHeader } from '@/lib/role-icons';

interface RLSPolicy {
	table_name: string;
	policy_name: string;
	command: string;
	roles: string;
	using_expression: string;
	with_check_expression: string;
}

/**
 * Permission cell icon component
 */
function PermissionIcon({ level }: { level: PermissionLevel }) {
	const display = getPermissionDisplay(level);

	if (display.icon === 'check') {
		return <LuCheck className={`h-5 w-5 ${display.color}`} />;
	}
	if (display.icon === 'limited') {
		return <LuMinus className={`h-5 w-5 ${display.color}`} />;
	}
	return <LuX className={`h-5 w-5 ${display.color}`} />;
}

/**
 * Category styling for visual distinction
 */
const CATEGORY_STYLES: Record<PermissionCategory, { bg: string; border: string; icon: string }> = {
	select: {
		bg: 'bg-blue-500/10',
		border: 'border-l-blue-500',
		icon: '👁️',
	},
	update: {
		bg: 'bg-amber-500/10',
		border: 'border-l-amber-500',
		icon: '✏️',
	},
	insert: {
		bg: 'bg-green-500/10',
		border: 'border-l-green-500',
		icon: '➕',
	},
	delete: {
		bg: 'bg-red-500/10',
		border: 'border-l-red-500',
		icon: '🗑️',
	},
};

/**
 * Roles Comparison Matrix Component
 */
function RolesComparisonMatrix({ policies }: { policies: RLSPolicy[] }) {
	const permissions = analyzeRolePermissions(policies);
	const groupedPermissions = groupPermissionsByCategory(permissions);

	// Define category order
	const categoryOrder: PermissionCategory[] = ['select', 'update', 'insert', 'delete'];

	// Track which categories are expanded (all expanded by default)
	const [expandedCategories, setExpandedCategories] = useState<Set<PermissionCategory>>(new Set(categoryOrder));

	// Toggle category expansion
	const toggleCategory = (category: PermissionCategory) => {
		setExpandedCategories((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(category)) {
				newSet.delete(category);
			} else {
				newSet.add(category);
			}
			return newSet;
		});
	};

	// Expand/collapse all
	const expandAll = () => setExpandedCategories(new Set(categoryOrder));
	const collapseAll = () => setExpandedCategories(new Set());

	if (policies.length === 0) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<LuUsers className="h-5 w-5 text-primary" />
						<div>
							<CardTitle>Rollen Vergelijking</CardTitle>
							<CardDescription>Overzicht van rechten per rol, gegroepeerd per operatie</CardDescription>
						</div>
					</div>
					{/* Expand/Collapse buttons */}
					<div className="flex gap-2 text-xs">
						<button
							type="button"
							onClick={expandAll}
							className="px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
						>
							Alles uitklappen
						</button>
						<button
							type="button"
							onClick={collapseAll}
							className="px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
						>
							Alles inklappen
						</button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<TooltipProvider>
					<div className="overflow-auto max-h-[500px]">
						<table className="w-full border-collapse">
							<thead className="sticky top-0 z-20">
								<tr className="border-b bg-muted">
									<th className="sticky left-0 z-30 bg-muted p-3 text-left font-semibold min-w-[200px]">
										Tabel / Recht
									</th>
									{ALL_ROLES.map((role) => (
										<th
											key={role}
											className="p-3 text-center font-semibold whitespace-nowrap bg-muted"
										>
											<RoleHeader role={role} />
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{categoryOrder.map((category) => {
									const categoryPermissions = groupedPermissions.get(category) || [];
									if (categoryPermissions.length === 0) return null;

									const style = CATEGORY_STYLES[category];
									const isExpanded = expandedCategories.has(category);

									return (
										<Fragment key={category}>
											{/* Category header row - clickable */}
											<tr
												className={`${style.bg} cursor-pointer hover:opacity-80 transition-opacity`}
												onClick={() => toggleCategory(category)}
											>
												<td
													colSpan={ALL_ROLES.length + 1}
													className={`p-3 font-bold text-sm border-l-4 ${style.border}`}
												>
													<div className="flex items-center gap-2">
														{isExpanded ? (
															<LuChevronDown className="h-4 w-4" />
														) : (
															<LuChevronRight className="h-4 w-4" />
														)}
														<span>{style.icon}</span>
														<span>{CATEGORY_DISPLAY[category]}</span>
														<span className="text-xs font-normal text-muted-foreground ml-2">
															({categoryPermissions.length})
														</span>
													</div>
												</td>
											</tr>
											{/* Permission rows for this category - only show if expanded */}
											{isExpanded &&
												categoryPermissions.map((permission, idx) => (
													<tr
														key={permission.id}
														className={`border-b hover:bg-muted/30 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
													>
														<td
															className={`sticky left-0 z-10 bg-inherit p-3 text-sm border-l-4 ${style.border}`}
														>
															<div className="flex flex-col pl-6">
																<span className="font-medium">
																	{permission.description}
																</span>
																<span className="text-xs text-muted-foreground">
																	{permission.table}
																</span>
															</div>
														</td>
														{ALL_ROLES.map((role) => {
															const level = permission.permissions.get(role) || 'none';
															const display = getPermissionDisplay(level);

															return (
																<td key={role} className="p-3 text-center">
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<div className="flex items-center justify-center">
																				<PermissionIcon level={level} />
																			</div>
																		</TooltipTrigger>
																		<TooltipContent>
																			<p>
																				{getRoleDisplayName(role)}:{' '}
																				{display.label}
																			</p>
																		</TooltipContent>
																	</Tooltip>
																</td>
															);
														})}
													</tr>
												))}
										</Fragment>
									);
								})}
							</tbody>
						</table>
					</div>
				</TooltipProvider>

				{/* Legend */}
				<div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
					<div className="flex items-center gap-1">
						<LuCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
						<span>Volledige toegang / Eigen data</span>
					</div>
					<div className="flex items-center gap-1">
						<LuMinus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
						<span>Beperkte toegang</span>
					</div>
					<div className="flex items-center gap-1">
						<LuX className="h-4 w-4 text-red-600 dark:text-red-400" />
						<span>Geen toegang</span>
					</div>
				</div>

				{/* Category Legend */}
				<div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-2">
					{categoryOrder.map((category) => (
						<div key={category} className="flex items-center gap-1">
							<span>{CATEGORY_STYLES[category].icon}</span>
							<span>{CATEGORY_DISPLAY[category]}</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

export default function RLSOverview() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [isSiteAdmin, setIsSiteAdmin] = useState(false);
	const [policies, setPolicies] = useState<RLSPolicy[]>([]);
	const [testMapping, setTestMapping] = useState<Map<string, TestInfo[]>>(new Map());
	const [filterTable, setFilterTable] = useState<string>('all');
	const [filterCommand, setFilterCommand] = useState<string>('all');
	const [searchQuery, setSearchQuery] = useState('');

	useEffect(() => {
		async function checkAccessAndLoad() {
			if (!user) {
				navigate('/login');
				return;
			}

			// Check if user is site_admin
			const { data: isAdmin, error: adminError } = await supabase.rpc('is_site_admin', {
				_user_id: user.id,
			});

			if (adminError) {
				console.error('Error checking site_admin status:', adminError);
				toast.error('Fout bij controleren toegang');
				navigate('/');
				return;
			}

			if (!isAdmin) {
				toast.error('Toegang geweigerd. Alleen site_admin kan deze pagina bekijken.');
				navigate('/');
				return;
			}

			setIsSiteAdmin(true);

			// Load RLS policies
			const { data: policiesData, error: policiesError } = await supabase.rpc('get_rls_policies');

			if (policiesError) {
				console.error('Error fetching RLS policies:', policiesError);
				toast.error('Fout bij ophalen RLS policies', {
					description: policiesError.message,
				});
				setLoading(false);
				return;
			}

			setPolicies(policiesData || []);

			// Load test mapping
			const mapping = await fetchTestMapping();
			setTestMapping(mapping);

			setLoading(false);
		}

		checkAccessAndLoad();
	}, [user, navigate]);

	// Get unique tables and commands for filters
	const tables = Array.from(new Set(policies.map((p) => p.table_name))).sort();
	const commands = Array.from(new Set(policies.map((p) => p.command))).sort();

	// Filter policies
	const filteredPolicies = policies.filter((policy) => {
		if (filterTable !== 'all' && policy.table_name !== filterTable) return false;
		if (filterCommand !== 'all' && policy.command !== filterCommand) return false;
		if (searchQuery && !policy.policy_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
		return true;
	});

	// Group policies by table
	const policiesByTable = filteredPolicies.reduce(
		(acc, policy) => {
			if (!acc[policy.table_name]) {
				acc[policy.table_name] = [];
			}
			acc[policy.table_name].push(policy);
			return acc;
		},
		{} as Record<string, RLSPolicy[]>,
	);

	// Get all unique test files for column headers
	const allTestFiles = new Set<string>();
	testMapping.forEach((tests) => {
		tests.forEach((test) => {
			allTestFiles.add(test.filePath);
		});
	});
	const testFiles = Array.from(allTestFiles).sort();

	// Get test coverage for a policy
	const getPolicyTests = (policyName: string): TestInfo[] => {
		return testMapping.get(policyName) || [];
	};

	// Check if policy has tests
	const hasTests = (policyName: string): boolean => {
		return getPolicyTests(policyName).length > 0;
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">RLS Overzicht</h1>
					<p className="text-muted-foreground">Laden...</p>
				</div>
			</div>
		);
	}

	if (!isSiteAdmin) {
		return null;
	}

	return (
		<div className="space-y-6 animate-in">
			{/* Page header */}
			<div className="flex items-center gap-2">
				<LuShield className="h-8 w-8 text-primary" />
				<div>
					<h1 className="text-3xl font-bold tracking-tight">RLS Overzicht</h1>
					<p className="text-muted-foreground">Overzicht van rechten per rol en test coverage</p>
				</div>
			</div>

			{/* Roles Comparison Matrix - at the top */}
			<RolesComparisonMatrix policies={policies} />

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle>Filters</CardTitle>
					<CardDescription>Filter policies op tabel, commando of naam</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="table-filter">Tabel</Label>
							<select
								id="table-filter"
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
								value={filterTable}
								onChange={(e) => setFilterTable(e.target.value)}
							>
								<option value="all">Alle tabellen</option>
								{tables.map((table) => (
									<option key={table} value={table}>
										{table}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="command-filter">Commando</Label>
							<select
								id="command-filter"
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
								value={filterCommand}
								onChange={(e) => setFilterCommand(e.target.value)}
							>
								<option value="all">Alle commando's</option>
								{commands.map((cmd) => (
									<option key={cmd} value={cmd}>
										{cmd}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="search">Zoeken</Label>
							<div className="relative">
								<LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id="search"
									placeholder="Zoek op policy naam..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9"
								/>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Statistics */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Totaal Policies</CardDescription>
						<CardTitle className="text-3xl">{policies.length}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Policies met Tests</CardDescription>
						<CardTitle className="text-3xl">
							{policies.filter((p) => hasTests(p.policy_name)).length}
						</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Policies zonder Tests</CardDescription>
						<CardTitle className="text-3xl text-destructive">
							{policies.filter((p) => !hasTests(p.policy_name)).length}
						</CardTitle>
					</CardHeader>
				</Card>
			</div>

			{/* Policies Matrix */}
			<Card>
				<CardHeader>
					<CardTitle>RLS Policies en Test Coverage</CardTitle>
					<CardDescription>
						Overzicht van alle RLS policies en welke tests deze policies testen
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ScrollArea className="w-full">
						<div className="min-w-full">
							{Object.entries(policiesByTable).map(([tableName, tablePolicies]) => (
								<div key={tableName} className="mb-8">
									<h3 className="mb-4 text-lg font-semibold capitalize">{tableName}</h3>
									<div className="overflow-x-auto">
										<table className="w-full border-collapse">
											<thead>
												<tr className="border-b">
													<th className="sticky left-0 z-10 bg-background p-2 text-left font-semibold">
														Policy
													</th>
													<th className="p-2 text-left font-semibold">Commando</th>
													<th className="p-2 text-left font-semibold">Roles</th>
													<th className="p-2 text-center font-semibold">Tests</th>
													{testFiles.length > 0 && (
														<th className="p-2 text-center font-semibold">
															Test Bestanden
														</th>
													)}
												</tr>
											</thead>
											<tbody>
												{tablePolicies.map((policy) => {
													const tests = getPolicyTests(policy.policy_name);
													const hasTestCoverage = tests.length > 0;

													return (
														<tr
															key={policy.policy_name}
															className="border-b hover:bg-muted/50"
														>
															<td className="sticky left-0 z-10 bg-background p-2 font-mono text-sm">
																{policy.policy_name}
															</td>
															<td className="p-2 text-sm">{policy.command}</td>
															<td className="p-2 text-sm">{policy.roles || 'N/A'}</td>
															<td className="p-2 text-center">
																{hasTestCoverage ? (
																	<div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
																		<LuCheck className="h-5 w-5" />
																		<span className="text-xs">{tests.length}</span>
																	</div>
																) : (
																	<div className="flex items-center justify-center text-red-600 dark:text-red-400">
																		<LuX className="h-5 w-5" />
																	</div>
																)}
															</td>
															{testFiles.length > 0 && (
																<td className="p-2">
																	<div className="flex flex-wrap gap-1">
																		{tests.length > 0 ? (
																			tests.map((test) => (
																				<span
																					key={`${test.filePath}-${test.testName}`}
																					className="rounded bg-primary/10 px-2 py-1 text-xs"
																					title={`${test.filePath}: ${test.testName}`}
																				>
																					{test.filePath
																						.split('/')
																						.pop()
																						?.replace('.test.ts', '')}
																				</span>
																			))
																		) : (
																			<span className="text-xs text-muted-foreground">
																				Geen tests
																			</span>
																		)}
																	</div>
																</td>
															)}
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Policy Details */}
			{filteredPolicies.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Policy Details</CardTitle>
						<CardDescription>Gedetailleerde informatie over de gefilterde policies</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{filteredPolicies.map((policy) => {
								const tests = getPolicyTests(policy.policy_name);

								return (
									<div key={policy.policy_name} className="rounded-lg border p-4">
										<div className="mb-2 flex items-center justify-between">
											<h4 className="font-mono font-semibold">{policy.policy_name}</h4>
											{hasTests(policy.policy_name) ? (
												<span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
													<LuCheck className="h-4 w-4" />
													{tests.length} test(s)
												</span>
											) : (
												<span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
													<LuX className="h-4 w-4" />
													Geen tests
												</span>
											)}
										</div>
										<div className="space-y-2 text-sm">
											<div>
												<span className="font-medium">Tabel:</span> {policy.table_name}
											</div>
											<div>
												<span className="font-medium">Commando:</span> {policy.command}
											</div>
											{policy.roles && (
												<div>
													<span className="font-medium">Roles:</span> {policy.roles}
												</div>
											)}
											{policy.using_expression && (
												<div>
													<span className="font-medium">USING:</span>
													<code className="ml-2 rounded bg-muted px-2 py-1 text-xs">
														{policy.using_expression}
													</code>
												</div>
											)}
											{policy.with_check_expression && (
												<div>
													<span className="font-medium">WITH CHECK:</span>
													<code className="ml-2 rounded bg-muted px-2 py-1 text-xs">
														{policy.with_check_expression}
													</code>
												</div>
											)}
											{tests.length > 0 && (
												<div>
													<span className="font-medium">Tests:</span>
													<ul className="ml-4 mt-1 list-disc space-y-1">
														{tests.map((test) => (
															<li
																key={`${test.filePath}-${test.testName}`}
																className="text-xs"
															>
																<span className="font-mono">{test.filePath}</span>:{' '}
																{test.testName}
															</li>
														))}
													</ul>
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
