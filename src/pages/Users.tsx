import { FunctionsHttpError } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IconType } from 'react-icons';
import { LuLoaderCircle, LuPlus, LuTrash2, LuTriangleAlert } from 'react-icons/lu';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn, type QuickFilterGroup } from '@/components/ui/data-table';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { RoleBadge } from '@/components/ui/role-badge';
import { UserFormDialog } from '@/components/users/UserFormDialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { type AppRole, allRoles, getIcon, roleLabels, rolePriority } from '@/lib/roles';

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

export default function Users() {
	const { user, isAdmin, isSiteAdmin, isLoading: authLoading } = useAuth();
	const [users, setUsers] = useState<UserWithRole[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedRole, setSelectedRole] = useState<AppRole | null | 'none'>(null);
	const [deleteDialog, setDeleteDialog] = useState<{
		open: boolean;
		user: UserWithRole | null;
	} | null>(null);
	const [userFormDialog, setUserFormDialog] = useState<{
		open: boolean;
		user: UserWithRole | null;
	}>({ open: false, user: null });
	const [deletingUser, setDeletingUser] = useState(false);

	// Check access - only admin and site_admin can view this page
	const hasAccess = isAdmin || isSiteAdmin;

	const loadUsers = useCallback(async () => {
		if (!hasAccess) return;

		setLoading(true);

		const { data: profiles, error: profilesError } = await supabase
			.from('profiles')
			.select('user_id, email, first_name, last_name, phone_number, avatar_url, created_at')
			.order('created_at', { ascending: false });

		if (profilesError) {
			console.error('Error loading profiles:', profilesError);
			toast.error('Fout bij laden gebruikers');
			setLoading(false);
			return;
		}

		const { data: roles, error: rolesError } = await supabase.from('user_roles').select('user_id, role');

		if (rolesError) {
			console.error('Error loading roles:', rolesError);
			toast.error('Fout bij laden rollen');
			setLoading(false);
			return;
		}

		const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) ?? []);

		const usersWithRoles: UserWithRole[] =
			profiles?.map((profile) => ({
				...profile,
				role: roleMap.get(profile.user_id) ?? null,
			})) ?? [];

		setUsers(usersWithRoles);
		setLoading(false);
	}, [hasAccess]);

	useEffect(() => {
		if (!authLoading) {
			loadUsers();
		}
	}, [authLoading, loadUsers]);

	// Helper functions
	const getUserInitials = useCallback((u: UserWithRole) => {
		if (u.first_name && u.last_name) {
			return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
		}
		if (u.first_name) {
			return u.first_name.slice(0, 2).toUpperCase();
		}
		return u.email.slice(0, 2).toUpperCase();
	}, []);

	const getDisplayName = useCallback((u: UserWithRole) => {
		if (u.first_name && u.last_name) {
			return `${u.first_name} ${u.last_name}`;
		}
		if (u.first_name) {
			return u.first_name;
		}
		return u.email;
	}, []);

	// Filter users based on selected role
	const filteredUsers = useMemo(() => {
		if (selectedRole === null) {
			return users;
		}
		if (selectedRole === 'none') {
			return users.filter((u) => u.role === null);
		}
		return users.filter((u) => u.role === selectedRole);
	}, [users, selectedRole]);

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
					setSelectedRole(value === null ? null : (value as AppRole | 'none'));
				},
			},
		];
	}, [selectedRole]);

	const columns: DataTableColumn<UserWithRole>[] = useMemo(
		() => [
			{
				key: 'user',
				label: 'Gebruiker',
				sortable: true,
				sortValue: (u) => getDisplayName(u).toLowerCase(),
				render: (u) => (
					<div className="flex items-center gap-3">
						<Avatar className="h-9 w-9">
							<AvatarImage src={u.avatar_url ?? undefined} alt={getDisplayName(u)} />
							<AvatarFallback className="bg-primary/10 text-primary text-sm">
								{getUserInitials(u)}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-medium">
								{getDisplayName(u)}
								{u.user_id === user?.id && (
									<span className="text-muted-foreground font-normal"> (jij)</span>
								)}
							</p>
						</div>
					</div>
				),
			},
			{
				key: 'email',
				label: 'Email',
				sortable: true,
				sortValue: (u) => u.email.toLowerCase(),
				render: (u) => <span className="text-muted-foreground">{u.email}</span>,
				className: 'text-muted-foreground',
			},
			{
				key: 'phone_number',
				label: 'Telefoonnummer',
				sortable: true,
				sortValue: (u) => u.phone_number?.toLowerCase() ?? '',
				render: (u) => <span className="text-muted-foreground">{u.phone_number || '-'}</span>,
				className: 'text-muted-foreground',
			},
			{
				key: 'role',
				label: 'Rol',
				sortable: true,
				sortValue: (u) => (u.role ? rolePriority[u.role] : 0),
				render: (u) => <RoleBadge role={u.role} />,
			},
			{
				key: 'created_at',
				label: 'Aangemaakt',
				sortable: true,
				sortValue: (u) => new Date(u.created_at),
				render: (u) => {
					const date = new Date(u.created_at);
					return (
						<span className="text-muted-foreground">
							{date.toLocaleDateString('nl-NL')}{' '}
							{date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
						</span>
					);
				},
				className: 'text-muted-foreground',
			},
		],
		[user?.id, getUserInitials, getDisplayName],
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

		setDeletingUser(true);

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
				return;
			}

			if (data?.error) {
				toast.error('Fout bij verwijderen gebruiker', {
					description: data.error,
				});
				return;
			}

			toast.success('Gebruiker verwijderd', {
				description: `${getDisplayName(deleteDialog.user)} is verwijderd.`,
			});

			// Remove user from local state
			setUsers((prev) => prev.filter((u) => u.user_id !== deleteDialog.user?.user_id));
			setDeleteDialog(null);
		} catch (error) {
			console.error('Error deleting user:', error);
			toast.error('Fout bij verwijderen gebruiker', {
				description: 'Er is een netwerkfout opgetreden. Probeer het later opnieuw.',
			});
		} finally {
			setDeletingUser(false);
		}
	}, [deleteDialog, getDisplayName, isSiteAdmin]);

	// Redirect if no access
	if (!hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div>
			<DataTable
				title="Gebruikers"
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
				data={filteredUsers}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				searchFields={[
					(u) => u.email,
					(u) => u.first_name ?? undefined,
					(u) => u.last_name ?? undefined,
					(u) => u.phone_number ?? undefined,
					(u) => (u.role ? roleLabels[u.role].label : undefined),
				]}
				loading={loading}
				getRowKey={(u) => u.user_id}
				getRowClassName={(u) => (u.user_id === user?.id ? 'bg-primary/15 hover:bg-primary/20' : undefined)}
				emptyMessage="Geen gebruikers gevonden"
				initialSortColumn="user"
				initialSortDirection="asc"
				quickFilter={quickFilterGroups}
				headerActions={
					isAdmin || isSiteAdmin ? (
						<Button onClick={handleCreate}>
							<LuPlus className="mr-2 h-4 w-4" />
							Gebruiker toevoegen
						</Button>
					) : undefined
				}
				rowActions={
					isSiteAdmin
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
				isSiteAdmin={isSiteAdmin}
				user={userFormDialog.user ?? undefined}
			/>

			{/* Delete User Dialog */}
			{deleteDialog && (
				<Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<LuTriangleAlert className="h-5 w-5 text-destructive" />
								Gebruiker verwijderen
							</DialogTitle>
							<DialogDescription>
								Weet je zeker dat je <strong>{getDisplayName(deleteDialog.user)}</strong> wilt
								verwijderen? Deze actie kan niet ongedaan worden gemaakt.
							</DialogDescription>
						</DialogHeader>
						<div className="py-4">
							<p className="text-sm text-muted-foreground">
								Alle gegevens van deze gebruiker worden permanent verwijderd, inclusief rollen en
								gerelateerde data.
							</p>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={deletingUser}>
								Annuleren
							</Button>
							<Button variant="destructive" onClick={confirmDelete} disabled={deletingUser}>
								{deletingUser ? (
									<>
										<LuLoaderCircle className="mr-2 h-4 w-4 animate-spin" />
										Verwijderen...
									</>
								) : (
									'Verwijderen'
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
