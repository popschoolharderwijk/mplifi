import { useEffect, useMemo, useState } from 'react';
import { LuCheck, LuChevronsUpDown, LuLoaderCircle } from 'react-icons/lu';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserDisplay } from '@/components/ui/user-display';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { User } from '@/types/users';
import type { UserSelectMultipleProps } from './types';
import { useUserSelectData } from './use-user-select-data';

/**
 * Searchable dropdown to select multiple users. Optional max to cap selection size.
 */
export function UserSelectMultiple({
	value,
	onChange,
	max,
	filter = 'all',
	excludeUserIds = [],
	placeholder = 'Selecteer gebruikers...',
	disabled = false,
	className,
}: UserSelectMultipleProps) {
	const [open, setOpen] = useState(false);
	const [cachedSelectedUsers, setCachedSelectedUsers] = useState<User[]>([]);

	const valueIds = useMemo(() => value, [value]);
	const valueIdSet = new Set(valueIds);

	const { users, filteredUsers, loading, searchQuery, setSearchQuery, fetchedUsers } = useUserSelectData({
		filter,
		excludeUserIds,
		open,
	});

	const resolveSelectedUsers = (): User[] => {
		const fromUsers = valueIds.map((id) => users.find((u) => u.user_id === id)).filter((u): u is User => !!u);
		const fromCache = cachedSelectedUsers.filter((u) => valueIdSet.has(u.user_id));
		const merged = new Map<string, User>();
		for (const u of fromUsers) merged.set(u.user_id, u);
		for (const u of fromCache) merged.set(u.user_id, u);
		return valueIds.map((id) => merged.get(id)).filter((u): u is User => !!u);
	};

	const selectedUsers = resolveSelectedUsers();

	useEffect(() => {
		if (valueIds.length === 0) return;
		const missing = valueIds.filter(
			(id) => !fetchedUsers.some((u) => u.user_id === id) && !cachedSelectedUsers.some((u) => u.user_id === id),
		);
		if (missing.length === 0) return;

		const loadMany = async () => {
			const { data, error } = await supabase
				.from('profiles')
				.select('user_id, first_name, last_name, email, avatar_url, phone_number')
				.in('user_id', missing);
			if (error) {
				toast.error('Fout bij laden gebruikers', { description: error.message });
			} else if (data?.length) {
				setCachedSelectedUsers((prev) => {
					const byId = new Map(prev.map((u) => [u.user_id, u]));
					for (const u of data) byId.set(u.user_id, u);
					return Array.from(byId.values());
				});
			}
		};
		loadMany();
	}, [valueIds, fetchedUsers, cachedSelectedUsers]);

	const handleToggle = (user: User) => {
		const isSelected = valueIdSet.has(user.user_id);
		if (isSelected) {
			const newUsers = selectedUsers.filter((u) => u.user_id !== user.user_id);
			onChange(newUsers);
			setCachedSelectedUsers((prev) => {
				const byId = new Map(prev.map((u) => [u.user_id, u]));
				for (const u of newUsers) byId.set(u.user_id, u);
				return Array.from(byId.values());
			});
			return;
		}
		if (max !== undefined && valueIds.length >= max) {
			toast.error(`Maximaal ${max} geselecteerd`);
			return;
		}
		const newUsers = [...selectedUsers, user];
		if (max !== undefined) {
			newUsers.splice(max);
		}
		onChange(newUsers);
		setCachedSelectedUsers((prev) => {
			const byId = new Map(prev.map((u) => [u.user_id, u]));
			for (const u of newUsers) byId.set(u.user_id, u);
			return Array.from(byId.values());
		});
	};

	const triggerLabel =
		valueIds.length === 0 ? (
			<span className="text-muted-foreground">{placeholder}</span>
		) : (
			<span className="truncate text-left">
				{max !== undefined ? `${valueIds.length} van ${max} geselecteerd` : `${valueIds.length} geselecteerd`}
			</span>
		);

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
					{triggerLabel}
					<LuChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[400px] p-0" align="start">
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
										const isSelected = valueIdSet.has(user.user_id);
										return (
											<CommandItem
												key={user.user_id}
												value={user.user_id}
												onSelect={() => handleToggle(user)}
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
