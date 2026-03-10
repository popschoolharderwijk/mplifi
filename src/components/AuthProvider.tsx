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
	isStaff: boolean;
	isTeacher: boolean;
	isPrivileged: boolean;
	teacherUserId: string | null;
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
	const [teacherUserId, setTeacherUserId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const fetchRole = useCallback(async (userId: string) => {
		const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();

		if (error) {
			console.error('Error fetching user role:', error);
			setRole(null);
		} else {
			setRole(data?.role ?? null);
		}
	}, []);

	const fetchTeacher = useCallback(async (userId: string) => {
		const { data, error } = await supabase.from('teachers').select('user_id').eq('user_id', userId).maybeSingle();

		if (error) {
			console.error('Error fetching teacher:', error);
			setTeacherUserId(null);
		} else {
			setTeacherUserId(data?.user_id ?? null);
		}
	}, []);

	const refreshRole = useCallback(async () => {
		if (user) {
			await Promise.all([fetchRole(user.id), fetchTeacher(user.id)]);
		}
	}, [user, fetchRole, fetchTeacher]);

	useEffect(() => {
		// Get initial session
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
			setUser(session?.user ?? null);
			if (session?.user) {
				Promise.all([fetchRole(session.user.id), fetchTeacher(session.user.id)]).finally(() => {
					setIsLoading(false);
				});
			} else {
				setIsLoading(false);
			}
		});

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
			setUser(session?.user ?? null);
			if (session?.user) {
				Promise.all([fetchRole(session.user.id), fetchTeacher(session.user.id)]).finally(() => {
					setIsLoading(false);
				});
			} else {
				setRole(null);
				setTeacherUserId(null);
				setIsLoading(false);
			}
		});

		return () => subscription.unsubscribe();
	}, [fetchRole, fetchTeacher]);

	const signOut = async () => {
		await supabase.auth.signOut();
	};

	const isAdmin = role === 'admin';
	const isSiteAdmin = role === 'site_admin';
	const isStaff = role === 'staff';
	const isTeacher = teacherUserId !== null;
	const isPrivileged = isAdmin || isSiteAdmin || isStaff;

	return (
		<AuthContext.Provider
			value={{
				user,
				session,
				role,
				isLoading,
				isAdmin,
				isSiteAdmin,
				isStaff,
				isTeacher,
				isPrivileged,
				teacherUserId,
				signOut,
				refreshRole,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}
