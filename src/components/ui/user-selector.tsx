import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface UserOption {
	user_id: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
	avatar_url: string | null;
}

interface UserSelectorProps {
	value: string | null;
	onChange: (userId: string | null) => void;
	placeholder?: string;
	searchPlaceholder?: string;
	className?: string;
	disabled?: boolean;
	excludeTeacherIds?: string[]; // Exclude users who are already teachers
}

export function UserSelector({
	value,
	onChange,
	placeholder = 'Selecteer gebruiker...',
	searchPlaceholder = 'Zoek gebruiker...',
	className,
	disabled = false,
	excludeTeacherIds = [],
}: UserSelectorProps) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [users, setUsers] = useState<UserOption[]>([]);
	const [loading, setLoading] = useState(false);

	const loadUsers = useCallback(async () => {
		setLoading(true);
		try {
			// Get all profiles
			const { data: profiles, error } = await supabase
				.from('profiles')
				.select('user_id, email, first_name, last_name, avatar_url')
				.order('email', { ascending: true });

			if (error) throw error;

			// Get existing teachers to exclude
			const { data: teachers } = await supabase.from('teachers').select('user_id');

			const teacherUserIds = new Set(teachers?.map((t) => t.user_id) ?? []);
			const excludeSet = new Set(excludeTeacherIds);

			// Filter out users who are already teachers
			const availableUsers = (profiles ?? []).filter(
				(user) => !teacherUserIds.has(user.user_id) && !excludeSet.has(user.user_id),
			);

			setUsers(availableUsers);
		} catch (error) {
			console.error('Error loading users:', error);
			toast.error('Fout bij laden gebruikers');
		} finally {
			setLoading(false);
		}
	}, [excludeTeacherIds]);

	// Load users when dropdown opens
	useEffect(() => {
		if (open && !disabled) {
			loadUsers();
		}
	}, [open, disabled, loadUsers]);

	const filteredUsers = useMemo(() => {
		if (!searchQuery.trim()) {
			return users;
		}

		const query = searchQuery.toLowerCase();
		return users.filter((user) => {
			const name = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
			return user.email.toLowerCase().includes(query) || name.includes(query);
		});
	}, [searchQuery, users]);

	const selectedUser = users.find((u) => u.user_id === value);

	const getDisplayName = (user: UserOption) => {
		if (user.first_name && user.last_name) {
			return `${user.first_name} ${user.last_name}`;
		}
		if (user.first_name) {
			return user.first_name;
		}
		return user.email;
	};

	const getUserInitials = (user: UserOption) => {
		if (user.first_name && user.last_name) {
			return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
		}
		if (user.first_name) {
			return user.first_name.slice(0, 2).toUpperCase();
		}
		return user.email.slice(0, 2).toUpperCase();
	};

	const handleSelect = (userId: string) => {
		onChange(userId);
		setSearchQuery('');
		setOpen(false);
	};

	return (
		<div className={cn('space-y-2', className)}>
			<Popover open={open} onOpenChange={setOpen} modal>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="w-full justify-between"
						disabled={disabled || loading}
					>
						{selectedUser ? (
							<div className="flex items-center gap-2">
								<Avatar className="h-5 w-5">
									<AvatarImage src={selectedUser.avatar_url ?? undefined} />
									<AvatarFallback className="text-xs">{getUserInitials(selectedUser)}</AvatarFallback>
								</Avatar>
								<span className="truncate">
									{getDisplayName(selectedUser)} ({selectedUser.email})
								</span>
							</div>
						) : (
							<span className="truncate">{placeholder}</span>
						)}
						<LuSearch className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[400px] p-0" align="start">
					<Command shouldFilter={false}>
						<CommandInput
							placeholder={searchPlaceholder}
							value={searchQuery}
							onValueChange={setSearchQuery}
						/>
						<CommandList className="max-h-[350px] overflow-y-auto">
							{loading ? (
								<div className="p-4 text-center text-sm text-muted-foreground">Laden...</div>
							) : filteredUsers.length === 0 ? (
								<CommandEmpty>Geen gebruiker gevonden.</CommandEmpty>
							) : (
								<CommandGroup>
									{filteredUsers.map((user) => (
										<CommandItem
											key={user.user_id}
											value={user.user_id}
											onSelect={() => handleSelect(user.user_id)}
											className="flex items-center gap-2"
										>
											<Avatar className="h-8 w-8">
												<AvatarImage src={user.avatar_url ?? undefined} />
												<AvatarFallback className="text-xs">
													{getUserInitials(user)}
												</AvatarFallback>
											</Avatar>
											<div className="flex flex-col">
												<span>{getDisplayName(user)}</span>
												<span className="text-xs text-muted-foreground">{user.email}</span>
											</div>
										</CommandItem>
									))}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}
