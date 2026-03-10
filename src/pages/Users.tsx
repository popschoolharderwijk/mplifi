import { FunctionsHttpError } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IconType } from 'react-icons';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { DataTable, type DataTableColumn, type QuickFilterGroup } from '@/components/ui/data-table';
import { RoleBadge } from '@/components/ui/role-badge';
import { UserDisplay } from '@/components/ui/user-display';
import { UserFormDialog } from '@/components/users/UserFormDialog';
import { NAV_LABELS } from '@/config/nav-labels';
import { useAuth } from '@/hooks/useAuth';
import { useServerTableState } from '@/hooks/useServerTableState';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTimeShort } from '@/lib/date/date-format';
import { getDisplayName } from '@/lib/display-name';
import { type AppRole, allRoles, getIcon, roleLabels } from '@/lib/roles';

interface UserWithRole {
	user_id: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
	phone_number: string | null;
	avatar_url: string | null;
	created_at: string;
	role: AppRole | null;
}

interface PaginatedUsersResponse {
	data: UserWithRole[];
	total_count: number;
	limit: number;
	offset: number;
}

export default function Users() {
	const { user, isAdmin, isSiteAdmin, isLoading: authLoading } = useAuth();
	const [users, setUsers] = useState<UserWithRole[]>([]);
	const [loading, setLoading] = useState(true);
	const [totalCount, setTotalCount] = useState(0);

	// Server-side table state (pagination, sorting, search, filters)
	const {
		searchQuery,
		debouncedSearchQuery,
		handleSearchChange,
		currentPage,
		rowsPerPage,
		handlePageChange,
		handleRowsPerPageChange,
		sortColumn,
		sortDirection,
		handleSortChange,
		filters,
		setFilters,
	} = useServerTableState({
		storageKey: 'users',
		initialSortColumn: 'created_at',
		initialSortDirection: 'desc',
		initialFilters: { selectedRole: null },
	});

	const selectedRole = (filters.selectedRole as AppRole | null | 'none') ?? null;

	const [deleteDialog, setDeleteDialog] = useState<{
		open: boolean;
		user: UserWithRole | null;
	} | null>(null);
	const [userFormDialog, setUserFormDialog] = useState<{
		open: boolean;
		user: UserWithRole | null;
	}>({ open: false, user: null });

	// Check access - only admin and site_admin can view this page
	const hasAccess = isAdmin || isSiteAdmin;

	// Load paginated users
	const loadUsers = useCallback(async () => {
		if (!hasAccess) return;

		setLoading(true);

		try {
			const offset = (currentPage - 1) * rowsPerPage;

			// Map DataTable column keys to database sort column names
			const columnMapping: Record<string, string> = {
				user: 'name',
				email: 'email',
				phone_number: 'phone_number',
				role: 'role',
				created_at: 'created_at',
			};

			const dbSortColumn = sortColumn ? columnMapping[sortColumn] || 'name' : 'name';

			const { data, error } = await supabase.rpc('get_users_paginated', {
				p_limit: rowsPerPage,
				p_offset: offset,
				p_search: debouncedSearchQuery || null,
				p_role: selectedRole === null ? null : selectedRole,
				p_sort_column: dbSortColumn,
				p_sort_direction: sortDirection || 'asc',
			});

			if (error) {
				console.error('Error loading users:', error);
				toast.error('Fout bij laden gebruikers');
				setLoading(false);
				return;
			}

			const result = data as unknown as PaginatedUsersResponse;
			setUsers(result.data ?? []);
			setTotalCount(result.total_count ?? 0);
			setLoading(false);
		} catch (error) {
			console.error('Error loading users:', error);
			toast.error('Fout bij laden gebruikers');
			setLoading(false);
		}
	}, [hasAccess, currentPage, rowsPerPage, debouncedSearchQuery, selectedRole, sortColumn, sortDirection]);

	// Load users when dependencies change
	useEffect(() => {
		if (!authLoading) {
			loadUsers();
		}
	}, [authLoading, loadUsers]);

	// Quick filter groups configuration
	const quickFilterGroups: QuickFilterGroup[] = useMemo(() => {
		const roleOptions: Array<{ id: string; label: string; icon?: IconType }> = allRoles.map((role) => {
			const config = roleLabels[role];
			const Icon = config.icon;
			return {
				id: role,
				label: config.label,
				icon: Icon as IconType,
			};
		});

		// Add option for users without role
		roleOptions.push({
			id: 'none',
			label: 'Geen rol',
		});

		return [
			{
				label: 'Rol',
				value: selectedRole === null ? null : selectedRole,
				options: roleOptions,
				onChange: (value) => {
					setFilters((prev) => ({
						...prev,
						selectedRole: value === null ? null : (value as AppRole | 'none'),
					}));
				},
			},
		];
	}, [selectedRole, setFilters]);

	const columns: DataTableColumn<UserWithRole>[] = useMemo(
		() => [
			{
				key: 'user',
				label: 'Gebruiker',
				sortable: true, // Server-side sorting
				render: (u) => (
					<UserDisplay
						profile={u}
						showEmail
						nameSuffix={
							u.user_id === user?.id ? (
								<span className="text-muted-foreground font-normal"> (jij)</span>
							) : undefined
						}
					/>
				),
			},
			{
				key: 'phone_number',
				label: 'Telefoonnummer',
				sortable: true, // Server-side sorting
				render: (u) => <span className="text-muted-foreground">{u.phone_number || '-'}</span>,
				className: 'text-muted-foreground',
			},
			{
				key: 'role',
				label: 'Rol',
				sortable: true, // Server-side sorting
				render: (u) => <RoleBadge role={u.role} />,
			},
			{
				key: 'created_at',
				label: 'Aangemaakt',
				sortable: true, // Server-side sorting
				render: (u) => (
					<span className="text-muted-foreground">{formatDateTimeShort(new Date(u.created_at))}</span>
				),
				className: 'text-muted-foreground',
			},
		],
		[user?.id],
	);

	const SiteAdminIcon = getIcon('site_admin');

	const handleEdit = useCallback((targetUser: UserWithRole) => {
		setUserFormDialog({ open: true, user: targetUser });
	}, []);

	const handleCreate = useCallback(() => {
		setUserFormDialog({ open: true, user: null });
	}, []);

	const handleDelete = useCallback(
		(targetUser: UserWithRole) => {
			// Prevent users from deleting themselves - they should use the settings flow
			if (targetUser.user_id === user?.id) {
				toast.error('Niet toegestaan', {
					description: 'Je kunt jezelf niet verwijderen via dit menu. Gebruik de instellingen pagina.',
				});
				return;
			}
			setDeleteDialog({ open: true, user: targetUser });
		},
		[user?.id],
	);

	const confirmDelete = useCallback(async () => {
		if (!deleteDialog?.user) return;

		try {
			const { data, error: invokeError } = await supabase.functions.invoke('delete-user', {
				body: { userId: deleteDialog.user.user_id },
			});

			if (invokeError) {
				let errorMessage = isSiteAdmin ? invokeError.message : 'Er is een onbekende fout opgetreden.';

				if (invokeError instanceof FunctionsHttpError) {
					try {
						const errorBody = await invokeError.context.json();
						errorMessage = errorBody?.error || errorMessage;
					} catch {
						// Could not parse error body - for site_admin show raw message
						if (isSiteAdmin) {
							errorMessage = invokeError.message || String(invokeError);
						}
					}
				} else if (isSiteAdmin) {
					errorMessage = invokeError.message || String(invokeError);
				}

				toast.error('Fout bij verwijderen gebruiker', {
					description: errorMessage,
				});
				throw new Error(errorMessage);
			}

			if (data?.error) {
				toast.error('Fout bij verwijderen gebruiker', {
					description: data.error,
				});
				throw new Error(data.error);
			}

			toast.success('Gebruiker verwijderd', {
				description: `${getDisplayName(deleteDialog.user)} is verwijderd.`,
			});

			// Reload users to get updated data
			setDeleteDialog(null);
			loadUsers();
		} catch (error) {
			console.error('Error deleting user:', error);
			toast.error('Fout bij verwijderen gebruiker', {
				description: 'Er is een netwerkfout opgetreden. Probeer het later opnieuw.',
			});
			throw error;
		}
	}, [deleteDialog, isSiteAdmin, loadUsers]);

	// Redirect if no access
	if (!hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div>
			<DataTable
				title={NAV_LABELS.users}
				description={
					<>
						Beheer alle gebruikers en hun rollen
						{isSiteAdmin && (
							<span className="ml-2 inline-flex items-center gap-1 text-primary">
								<SiteAdminIcon className="h-4 w-4" />
								Je kunt rollen wijzigen
							</span>
						)}
					</>
				}
				data={users}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={handleSearchChange}
				loading={loading}
				getRowKey={(u) => u.user_id}
				getRowClassName={(u) => (u.user_id === user?.id ? 'bg-primary/15 hover:bg-primary/20' : undefined)}
				emptyMessage="Geen gebruikers gevonden"
				quickFilter={quickFilterGroups}
				serverPagination={{
					totalCount,
					currentPage,
					rowsPerPage,
					onPageChange: handlePageChange,
					onRowsPerPageChange: handleRowsPerPageChange,
				}}
				initialSortColumn={sortColumn || undefined}
				initialSortDirection={sortDirection || undefined}
				onSortChange={handleSortChange}
				headerActions={
					isAdmin || isSiteAdmin ? (
						<Button onClick={handleCreate}>
							<LuPlus className="mr-2 h-4 w-4" />
							Gebruiker toevoegen
						</Button>
					) : undefined
				}
				rowActions={
					isAdmin || isSiteAdmin
						? {
								onEdit: handleEdit,
								onDelete: (u) => {
									// Prevent deleting yourself - use settings flow instead
									if (u.user_id === user?.id) {
										return;
									}
									handleDelete(u);
								},
								render: (u) => {
									// Hide delete button for current user
									if (u.user_id === user?.id) {
										return null;
									}
									return (
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
											onClick={(e) => {
												e.stopPropagation();
												handleDelete(u);
											}}
										>
											<LuTrash2 className="h-4 w-4" />
										</Button>
									);
								},
							}
						: undefined
				}
			/>

			{/* Create/Edit User Dialog */}
			<UserFormDialog
				open={userFormDialog.open}
				onOpenChange={(open) => setUserFormDialog({ ...userFormDialog, open })}
				onSuccess={loadUsers}
				user={userFormDialog.user ?? undefined}
			/>

			{/* Delete User Dialog */}
			{deleteDialog && (
				<ConfirmDeleteDialog
					open={deleteDialog.open}
					onOpenChange={(open) => !open && setDeleteDialog(null)}
					title="Gebruiker verwijderen"
					description={
						<>
							Weet je zeker dat je <strong>{getDisplayName(deleteDialog.user)}</strong> wilt verwijderen?
							Deze actie kan niet ongedaan worden gemaakt.
							<p className="mt-2 text-muted-foreground">
								Alle gegevens van deze gebruiker worden permanent verwijderd, inclusief rollen en
								gerelateerde data.
							</p>
						</>
					}
					onConfirm={confirmDelete}
				/>
			)}
		</div>
	);
}
