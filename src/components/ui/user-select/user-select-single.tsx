import { useEffect, useState } from 'react';
import { LuCheck, LuChevronsUpDown, LuLoaderCircle } from 'react-icons/lu';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserDisplay } from '@/components/ui/user-display';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { User } from '@/types/users';
import type { UserSelectSingleProps } from './types';
import { useUserSelectData } from './use-user-select-data';

/**
 * Searchable dropdown to select a single user. Use for one user (e.g. owner, teacher).
 */
export function UserSelectSingle({
	value,
	onChange,
	filter = 'all',
	excludeUserIds = [],
	placeholder = 'Selecteer gebruiker...',
	disabled = false,
	className,
}: UserSelectSingleProps) {
	const [open, setOpen] = useState(false);
	const [cachedSelectedUser, setCachedSelectedUser] = useState<User | null>(null);

	const { users, filteredUsers, loading, searchQuery, setSearchQuery, fetchedUsers } = useUserSelectData({
		filter,
		excludeUserIds,
		open,
	});

	const selectedUser =
		users.find((u) => u.user_id === value) ?? (value === cachedSelectedUser?.user_id ? cachedSelectedUser : null);

	useEffect(() => {
		if (!value) return;
		if (fetchedUsers.some((u) => u.user_id === value) || cachedSelectedUser?.user_id === value) return;

		const loadOne = async () => {
			const { data, error } = await supabase
				.from('profiles')
				.select('user_id, first_name, last_name, email, avatar_url, phone_number')
				.eq('user_id', value)
				.single();
			if (error) {
				toast.error('Fout bij laden gebruiker', { description: error.message });
			} else if (data) {
				setCachedSelectedUser(data);
			}
		};
		loadOne();
	}, [value, fetchedUsers, cachedSelectedUser?.user_id]);

	const handleSelect = (user: User, isDeselecting: boolean) => {
		onChange(isDeselecting ? null : user);
		if (!isDeselecting) setCachedSelectedUser(user);
		setSearchQuery('');
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen} modal>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn('w-full justify-between font-normal h-auto min-h-10 py-2', className)}
				>
					{selectedUser ? (
						<UserDisplay profile={selectedUser} showEmail className="flex-1 justify-start text-left" />
					) : (
						<span className="text-muted-foreground">{placeholder}</span>
					)}
					<LuChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
				<Command shouldFilter={false}>
					<CommandInput placeholder="Zoek gebruiker..." value={searchQuery} onValueChange={setSearchQuery} />
					<CommandList className="max-h-[350px] overflow-y-auto">
						{loading ? (
							<div className="flex items-center justify-center py-6">
								<LuLoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
							</div>
						) : (
							<>
								<CommandEmpty>Geen gebruikers gevonden.</CommandEmpty>
								<CommandGroup>
									{filteredUsers.map((user) => {
										const isSelected = user.user_id === value;
										return (
											<CommandItem
												key={user.user_id}
												value={user.user_id}
												onSelect={() => handleSelect(user, isSelected)}
												className="py-2"
											>
												<LuCheck
													className={cn(
														'mr-2 h-4 w-4 shrink-0',
														isSelected ? 'opacity-100' : 'opacity-0',
													)}
												/>
												<UserDisplay profile={user} showEmail className="flex-1" />
											</CommandItem>
										);
									})}
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
