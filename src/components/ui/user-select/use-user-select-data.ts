import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/lib/roles';
import type { User } from '@/types/users';
import type { UserFilter } from './types';

export function useUserSelectData({
	filter = 'all',
	excludeUserIds = [],
	open,
}: {
	filter?: UserFilter;
	excludeUserIds?: string[];
	open: boolean;
}) {
	const [loading, setLoading] = useState(false);
	const [fetchedUsers, setFetchedUsers] = useState<User[]>([]);
	const [searchQuery, setSearchQuery] = useState('');

	const excludeSet = new Set(excludeUserIds);
	const filterExcluded = (list: User[]) =>
		excludeUserIds.length === 0 ? list : list.filter((u) => !excludeSet.has(u.user_id));

	const users = filterExcluded(fetchedUsers);

	const filteredUsers = users.filter((user) => {
		if (!searchQuery.trim()) return true;
		const name = [user.first_name, user.last_name].filter(Boolean).join(' ').toLowerCase();
		const query = searchQuery.toLowerCase();
		return name.includes(query) || user.email.toLowerCase().includes(query);
	});

	useEffect(() => {
		if (!open) return;

		const loadUsers = async () => {
			setLoading(true);
			try {
				if (filter === 'students') {
					const { data: studentsData, error: studentsError } = await supabase
						.from('students')
						.select('user_id');
					if (studentsError) {
						toast.error('Fout bij laden gebruikers', { description: studentsError.message });
						setLoading(false);
						return;
					}
					const userIds = studentsData?.map((s) => s.user_id) ?? [];
					if (userIds.length === 0) {
						setFetchedUsers([]);
						setLoading(false);
						return;
					}
					const { data: profilesData, error: profilesError } = await supabase
						.from('profiles')
						.select('user_id, first_name, last_name, email, avatar_url, phone_number')
						.in('user_id', userIds)
						.order('first_name');
					if (profilesError) {
						toast.error('Fout bij laden gebruikers', { description: profilesError.message });
						setLoading(false);
						return;
					}
					setFetchedUsers(profilesData ?? []);
				} else if (filter === 'teachers') {
					const { data: teachersData, error: teachersError } = await supabase
						.from('teachers')
						.select('user_id')
						.eq('is_active', true);
					if (teachersError) {
						toast.error('Fout bij laden gebruikers', { description: teachersError.message });
						setLoading(false);
						return;
					}
					const userIds = teachersData?.map((t) => t.user_id) ?? [];
					if (userIds.length === 0) {
						setFetchedUsers([]);
						setLoading(false);
						return;
					}
					const { data: profilesData, error: profilesError } = await supabase
						.from('profiles')
						.select('user_id, first_name, last_name, email, avatar_url, phone_number')
						.in('user_id', userIds)
						.order('first_name');
					if (profilesError) {
						toast.error('Fout bij laden gebruikers', { description: profilesError.message });
						setLoading(false);
						return;
					}
					setFetchedUsers(profilesData ?? []);
				} else if (filter === 'all') {
					const { data: profilesData, error: profilesError } = await supabase
						.from('profiles')
						.select('user_id, first_name, last_name, email, avatar_url, phone_number')
						.order('first_name');
					if (profilesError) {
						toast.error('Fout bij laden gebruikers', { description: profilesError.message });
						setLoading(false);
						return;
					}
					setFetchedUsers(profilesData ?? []);
				} else {
					// filter is AppRole – exhaustive switch: new Supabase roles cause TS error here
					const role: AppRole = filter;
					switch (role) {
						case 'staff':
						case 'admin':
						case 'site_admin': {
							const { data: rolesData, error: rolesError } = await supabase
								.from('user_roles')
								.select('user_id')
								.eq('role', role);
							if (rolesError) {
								toast.error('Fout bij laden gebruikers', { description: rolesError.message });
								setLoading(false);
								return;
							}
							const userIds = rolesData?.map((r) => r.user_id) ?? [];
							if (userIds.length === 0) {
								setFetchedUsers([]);
								setLoading(false);
								return;
							}
							const { data: profilesData, error: profilesError } = await supabase
								.from('profiles')
								.select('user_id, first_name, last_name, email, avatar_url, phone_number')
								.in('user_id', userIds)
								.order('first_name');
							if (profilesError) {
								toast.error('Fout bij laden gebruikers', { description: profilesError.message });
								setLoading(false);
								return;
							}
							setFetchedUsers(profilesData ?? []);
							break;
						}
						default: {
							const _exhaustive: never = role;
							return _exhaustive;
						}
					}
				}
			} finally {
				setLoading(false);
			}
		};

		loadUsers();
	}, [open, filter]);

	return { users, filteredUsers, loading, searchQuery, setSearchQuery, fetchedUsers };
}
