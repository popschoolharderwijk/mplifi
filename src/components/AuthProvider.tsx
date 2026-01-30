import type { Session, User } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/lib/roles';

interface AuthContextType {
	user: User | null;
	session: Session | null;
	role: AppRole | null;
	isLoading: boolean;
	isAdmin: boolean;
	isSiteAdmin: boolean;
	signOut: () => Promise<void>;
	refreshRole: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<User | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [role, setRole] = useState<AppRole | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const fetchRole = useCallback(async (userId: string) => {
		const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId).single();

		if (error) {
			console.error('Error fetching user role:', error);
			setRole(null);
		} else {
			setRole(data?.role ?? null);
		}
	}, []);

	const refreshRole = useCallback(async () => {
		if (user) {
			await fetchRole(user.id);
		}
	}, [user, fetchRole]);

	useEffect(() => {
		// Get initial session
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
			setUser(session?.user ?? null);
			if (session?.user) {
				fetchRole(session.user.id);
			}
			setIsLoading(false);
		});

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
			setUser(session?.user ?? null);
			if (session?.user) {
				fetchRole(session.user.id);
			} else {
				setRole(null);
			}
			setIsLoading(false);
		});

		return () => subscription.unsubscribe();
	}, [fetchRole]);

	const signOut = async () => {
		await supabase.auth.signOut();
	};

	const isAdmin = role === 'admin';
	const isSiteAdmin = role === 'site_admin';

	return (
		<AuthContext.Provider value={{ user, session, role, isLoading, isAdmin, isSiteAdmin, signOut, refreshRole }}>
			{children}
		</AuthContext.Provider>
	);
}
