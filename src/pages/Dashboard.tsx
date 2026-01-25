import { useEffect, useState } from 'react';
import { ActionRequired } from '@/components/dashboard/ActionRequired';
import { RecentStudents } from '@/components/dashboard/RecentStudents';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { TeacherAvailability } from '@/components/dashboard/TeacherAvailability';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
	const { user } = useAuth();
	const [firstName, setFirstName] = useState<string | null>(null);

	useEffect(() => {
		async function loadFirstName() {
			if (!user) return;

			const { data } = await supabase.from('profiles').select('first_name').eq('user_id', user.id).single();

			if (data?.first_name) {
				setFirstName(data.first_name);
			}
		}

		loadFirstName();

		// Listen for profile updates
		const handleProfileUpdate = () => {
			loadFirstName();
		};

		window.addEventListener('profile-updated', handleProfileUpdate);

		return () => {
			window.removeEventListener('profile-updated', handleProfileUpdate);
		};
	}, [user]);

	return (
		<div className="space-y-6 animate-in">
			{/* Page header */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground">
					{firstName ? (
						<>
							Welkom terug, <span className="capitalize">{firstName}</span>
						</>
					) : (
						'Welkom terug'
					)}
				</p>
			</div>

			{/* Action Required section */}
			<ActionRequired />

			{/* Stats Grid */}
			<StatsGrid />

			{/* Two-column section */}
			<div className="grid gap-6 md:grid-cols-2">
				<RecentStudents />
				<TeacherAvailability />
			</div>
		</div>
	);
}
