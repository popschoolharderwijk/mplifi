import { LuCalendar, LuCheck, LuClock, LuGraduationCap, LuUserCheck, LuUsers } from 'react-icons/lu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StatItem {
	title: string;
	value: number | string;
	icon: React.ComponentType<{ className?: string }>;
	description?: string;
	trend?: {
		value: number;
		isPositive: boolean;
	};
}

interface StatsGridProps {
	stats?: StatItem[];
	isLoading?: boolean;
}

const defaultStats: StatItem[] = [
	{
		title: 'Totaal Leerlingen',
		value: 28,
		icon: LuUsers,
		description: '+2 deze maand',
	},
	{
		title: 'Actieve Leerlingen',
		value: 20,
		icon: LuUserCheck,
		description: '71% van totaal',
	},
	{
		title: 'Proeflessen',
		value: 8,
		icon: LuClock,
		description: 'Afgelopen maand',
	},
	{
		title: 'Wachtlijst',
		value: 0,
		icon: LuUsers,
		description: 'Geen wachtenden',
	},
	{
		title: 'Docenten',
		value: 12,
		icon: LuGraduationCap,
		description: '3 vakken gemiddeld',
	},
	{
		title: 'Lessen Deze Week',
		value: 3,
		icon: LuCalendar,
		description: 'Nog 12 beschikbaar',
	},
	{
		title: 'Beschikbare Slots',
		value: 39,
		icon: LuCheck,
		description: 'Voor nieuwe lessen',
	},
];

export function StatsGrid({ stats = defaultStats, isLoading = false }: StatsGridProps) {
	if (isLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
				{[1, 2, 3, 4, 5, 6, 7].map((n) => (
					<Card key={`stat-skeleton-${n}`}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-8 w-8 rounded-full" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-16 mb-1" />
							<Skeleton className="h-3 w-20" />
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 stagger-children">
			{stats.map((stat) => (
				<Card
					key={stat.title}
					className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
				>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
							<stat.icon className="h-5 w-5 text-primary" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{stat.value}</div>
						{stat.description && <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>}
					</CardContent>
				</Card>
			))}
		</div>
	);
}
