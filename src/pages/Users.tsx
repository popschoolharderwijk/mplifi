import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuPlus, LuTriangleAlert } from 'react-icons/lu';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { type AppRole, allRoles, getIcon, roleLabels, rolePriority } from '@/lib/roles';

interface UserWithRole {
	user_id: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
	avatar_url: string | null;
	created_at: string;
	role: AppRole | null;
}

export default function Users() {
	const { user, isAdmin, isSiteAdmin, isLoading: authLoading } = useAuth();
	const [users, setUsers] = useState<UserWithRole[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
	const [confirmDialog, setConfirmDialog] = useState<{
		open: boolean;
		userId: string;
		userName: string;
		oldRole: AppRole | null;
		newRole: AppRole;
	} | null>(null);
	const [editDialog, setEditDialog] = useState<{
		open: boolean;
		user: UserWithRole | null;
	} | null>(null);
	const [deleteDialog, setDeleteDialog] = useState<{
		open: boolean;
		user: UserWithRole | null;
	} | null>(null);
	const [createDialog, setCreateDialog] = useState(false);
	const [editForm, setEditForm] = useState({
		email: '',
		first_name: '',
		last_name: '',
	});
	const [createForm, setCreateForm] = useState({
		email: '',
		first_name: '',
		last_name: '',
		role: null as AppRole | null,
	});

	// Check access - only admin and site_admin can view this page
	const hasAccess = isAdmin || isSiteAdmin;

	useEffect(() => {
		async function loadUsers() {
			if (!hasAccess) return;

			setLoading(true);

			// Fetch profiles and roles separately, then combine
			const { data: profiles, error: profilesError } = await supabase
				.from('profiles')
				.select('user_id, email, first_name, last_name, avatar_url, created_at')
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

			// Create a map of user_id to role
			const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) ?? []);

			// Combine profiles with roles
			const usersWithRoles: UserWithRole[] =
				profiles?.map((profile) => ({
					...profile,
					role: roleMap.get(profile.user_id) ?? null,
				})) ?? [];

			setUsers(usersWithRoles);
			setLoading(false);
		}

		if (!authLoading) {
			loadUsers();
		}
	}, [hasAccess, authLoading]);

	const applyRoleChange = useCallback(
		async (userId: string, newRole: AppRole) => {
			setUpdatingUserId(userId);

			// Check if user already has a role
			const currentUser = users.find((u) => u.user_id === userId);
			const hasRole = currentUser?.role !== null;

			let error: { message: string } | null;
			if (hasRole) {
				// Update existing role
				const result = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId);
				error = result.error;
			} else {
				// Insert new role
				const result = await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
				error = result.error;
			}

			if (error) {
				console.error('Error updating role:', error);
				toast.error('Fout bij wijzigen rol', {
					description: error.message,
				});
			} else {
				// Update local state
				setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u)));
				toast.success('Rol gewijzigd');
			}

			setUpdatingUserId(null);
			setConfirmDialog(null);
		},
		[users],
	);

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

	const handleRoleChange = useCallback(
		(userId: string, newRole: AppRole) => {
			if (!isSiteAdmin) {
				toast.error('Geen toegang', {
					description: 'Alleen site admins kunnen rollen wijzigen.',
				});
				return;
			}

			if (userId === user?.id) {
				toast.error('Niet toegestaan', {
					description: 'Je kunt je eigen rol niet wijzigen.',
				});
				return;
			}

			const currentUser = users.find((u) => u.user_id === userId);
			if (!currentUser) return;
			const oldRole = currentUser.role ?? null;
			const userName = getDisplayName(currentUser);

			// Check if this is a promotion/demotion to/from admin or site_admin
			const isAdminChange =
				(oldRole === 'admin' || oldRole === 'site_admin' || newRole === 'admin' || newRole === 'site_admin') &&
				oldRole !== newRole;

			if (isAdminChange) {
				// Show confirmation dialog
				setConfirmDialog({
					open: true,
					userId,
					userName,
					oldRole,
					newRole,
				});
			} else {
				// Directly apply the change
				applyRoleChange(userId, newRole);
			}
		},
		[isSiteAdmin, user?.id, users, getDisplayName, applyRoleChange],
	);

	const filteredUsers = useMemo(
		() =>
			users.filter(
				(u) =>
					u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
					u.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					u.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					(u.role && roleLabels[u.role].label.toLowerCase().includes(searchQuery.toLowerCase())),
			),
		[users, searchQuery],
	);

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
							<p className="font-medium">{getDisplayName(u)}</p>
							<p className="text-sm text-muted-foreground">{u.email}</p>
						</div>
					</div>
				),
			},
			{
				key: 'role',
				label: 'Rol',
				sortable: true,
				sortValue: (u) => (u.role ? rolePriority[u.role] : 0),
				render: (u) =>
					isSiteAdmin && u.user_id !== user?.id ? (
						<Select
							value={u.role ?? undefined}
							onValueChange={(value: AppRole) => handleRoleChange(u.user_id, value)}
							disabled={updatingUserId === u.user_id}
						>
							<SelectTrigger className="w-40">
								<SelectValue placeholder="Geen rol" />
							</SelectTrigger>
							<SelectContent>
								{allRoles.map((role) => (
									<SelectItem key={role} value={role}>
										{roleLabels[role].label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : u.role ? (
						<Badge variant={roleLabels[u.role].variant}>
							{roleLabels[u.role].label}
							{u.user_id === user?.id && ' (jij)'}
						</Badge>
					) : (
						<Badge variant="outline">Geen rol</Badge>
					),
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
		[isSiteAdmin, user?.id, updatingUserId, getUserInitials, getDisplayName, handleRoleChange],
	);

	const SiteAdminIcon = getIcon('site_admin');

	const handleEdit = useCallback((user: UserWithRole) => {
		setEditForm({
			email: user.email,
			first_name: user.first_name ?? '',
			last_name: user.last_name ?? '',
		});
		setEditDialog({ open: true, user });
	}, []);

	const handleDelete = useCallback((user: UserWithRole) => {
		setDeleteDialog({ open: true, user });
	}, []);

	const handleCreate = useCallback(() => {
		setCreateForm({
			email: '',
			first_name: '',
			last_name: '',
			role: null,
		});
		setCreateDialog(true);
	}, []);

	const saveEdit = useCallback(async () => {
		if (!editDialog?.user) return;

		const { error } = await supabase
			.from('profiles')
			.update({
				email: editForm.email,
				first_name: editForm.first_name || null,
				last_name: editForm.last_name || null,
			})
			.eq('user_id', editDialog.user.user_id);

		if (error) {
			toast.error('Fout bij bijwerken gebruiker', {
				description: error.message,
			});
			return;
		}

		// Update local state
		setUsers((prev) =>
			prev.map((u) =>
				u.user_id === (editDialog.user?.user_id ?? '')
					? {
							...u,
							email: editForm.email,
							first_name: editForm.first_name || null,
							last_name: editForm.last_name || null,
						}
					: u,
			),
		);

		toast.success('Gebruiker bijgewerkt');
		setEditDialog(null);
	}, [editDialog, editForm]);

	const saveCreate = useCallback(async () => {
		// TODO: Implement via Edge Function or Admin API
		// For now, show a message that this needs to be implemented
		toast.error('Nog niet geïmplementeerd', {
			description: 'Gebruiker aanmaken vereist een Edge Function of Admin API.',
		});
		setCreateDialog(false);
	}, []);

	const confirmDelete = useCallback(async () => {
		if (!deleteDialog?.user) return;

		// TODO: Implement via Edge Function or Admin API
		// For now, show a message that this needs to be implemented
		toast.error('Nog niet geïmplementeerd', {
			description: 'Gebruiker verwijderen vereist een Edge Function of Admin API.',
		});
		setDeleteDialog(null);
	}, [deleteDialog]);

	// Redirect if no access
	if (!hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Gebruikers</h1>
					<p className="text-muted-foreground">
						Beheer alle gebruikers en hun rollen
						{isSiteAdmin && (
							<span className="ml-2 inline-flex items-center gap-1 text-primary">
								<SiteAdminIcon className="h-4 w-4" />
								Je kunt rollen wijzigen
							</span>
						)}
					</p>
				</div>
				{isSiteAdmin && (
					<Button onClick={handleCreate}>
						<LuPlus className="mr-2 h-4 w-4" />
						Gebruiker toevoegen
					</Button>
				)}
			</div>

			<DataTable
				title="Gebruikers Overzicht"
				data={filteredUsers}
				columns={columns}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				loading={loading}
				getRowKey={(u) => u.user_id}
				emptyMessage="Geen gebruikers gevonden"
				initialSortColumn="user"
				initialSortDirection="asc"
				rowActions={
					isSiteAdmin
						? {
								onEdit: handleEdit,
								onDelete: handleDelete,
							}
						: undefined
				}
			/>

			{/* Confirmation Dialog for Admin/Site Admin Role Changes */}
			{confirmDialog && (
				<Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<LuTriangleAlert className="h-5 w-5 text-destructive" />
								Bevestig rolwijziging
							</DialogTitle>
							<DialogDescription>
								Je staat op het punt om de rol van <strong>{confirmDialog.userName}</strong> te wijzigen
								van{' '}
								{confirmDialog.oldRole ? (
									<>
										<strong>{roleLabels[confirmDialog.oldRole].label}</strong> naar{' '}
										<strong>{roleLabels[confirmDialog.newRole].label}</strong>
									</>
								) : (
									<>
										<strong>Geen rol</strong> naar{' '}
										<strong>{roleLabels[confirmDialog.newRole].label}</strong>
									</>
								)}
								.
							</DialogDescription>
						</DialogHeader>
						<div className="py-4">
							<p className="text-sm text-muted-foreground">
								{(confirmDialog.newRole === 'admin' || confirmDialog.newRole === 'site_admin') && (
									<>
										Deze gebruiker krijgt <strong>administratieve rechten</strong> en kan gevoelige
										acties uitvoeren.
									</>
								)}
								{(confirmDialog.oldRole === 'admin' || confirmDialog.oldRole === 'site_admin') &&
									confirmDialog.newRole !== 'admin' &&
									confirmDialog.newRole !== 'site_admin' && (
										<>
											Deze gebruiker verliest <strong>administratieve rechten</strong> en kan geen
											beheeracties meer uitvoeren.
										</>
									)}
							</p>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setConfirmDialog(null)}
								disabled={updatingUserId !== null}
							>
								Annuleren
							</Button>
							<Button
								variant="default"
								onClick={() => applyRoleChange(confirmDialog.userId, confirmDialog.newRole)}
								disabled={updatingUserId !== null}
							>
								{updatingUserId === confirmDialog.userId ? 'Wijzigen...' : 'Bevestigen'}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}

			{/* Edit User Dialog */}
			{editDialog && (
				<Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Gebruiker bewerken</DialogTitle>
							<DialogDescription>
								Wijzig de gegevens van {getDisplayName(editDialog.user)}.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="edit-email">Email</Label>
								<Input
									id="edit-email"
									type="email"
									value={editForm.email}
									onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="edit-first-name">Voornaam</Label>
								<Input
									id="edit-first-name"
									value={editForm.first_name}
									onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="edit-last-name">Achternaam</Label>
								<Input
									id="edit-last-name"
									value={editForm.last_name}
									onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setEditDialog(null)}>
								Annuleren
							</Button>
							<Button variant="default" onClick={saveEdit}>
								Opslaan
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}

			{/* Create User Dialog */}
			<Dialog open={createDialog} onOpenChange={setCreateDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Nieuwe gebruiker toevoegen</DialogTitle>
						<DialogDescription>Voeg een nieuwe gebruiker toe aan het systeem.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="create-email">Email *</Label>
							<Input
								id="create-email"
								type="email"
								value={createForm.email}
								onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
								placeholder="gebruiker@voorbeeld.nl"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-first-name">Voornaam</Label>
							<Input
								id="create-first-name"
								value={createForm.first_name}
								onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-last-name">Achternaam</Label>
							<Input
								id="create-last-name"
								value={createForm.last_name}
								onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-role">Rol</Label>
							<Select
								value={createForm.role ?? undefined}
								onValueChange={(value: AppRole) => setCreateForm({ ...createForm, role: value })}
							>
								<SelectTrigger id="create-role">
									<SelectValue placeholder="Geen rol" />
								</SelectTrigger>
								<SelectContent>
									{allRoles.map((role) => (
										<SelectItem key={role} value={role}>
											{roleLabels[role].label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateDialog(false)}>
							Annuleren
						</Button>
						<Button variant="default" onClick={saveCreate} disabled={!createForm.email}>
							Toevoegen
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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
							<Button variant="outline" onClick={() => setDeleteDialog(null)}>
								Annuleren
							</Button>
							<Button variant="destructive" onClick={confirmDelete}>
								Verwijderen
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
