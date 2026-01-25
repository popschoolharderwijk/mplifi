import { ActionRequired } from '@/components/dashboard/ActionRequired';
import { RecentStudents } from '@/components/dashboard/RecentStudents';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { TeacherAvailability } from '@/components/dashboard/TeacherAvailability';
import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
	const { user } = useAuth();
	const userName = user?.email?.split('@')[0] || 'gebruiker';

	return (
		<div className="space-y-6 animate-in">
			{/* Page header */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground">
					Welkom terug, <span className="capitalize">{userName}</span>
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
