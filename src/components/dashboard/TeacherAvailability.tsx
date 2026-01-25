import { CheckCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Teacher {
	id: string;
	name: string;
	instruments: string[];
	availableHours: number;
}

interface TeacherAvailabilityProps {
	teachers?: Teacher[];
	isLoading?: boolean;
}

const defaultTeachers: Teacher[] = [
	{ id: '1', name: 'Jeff', instruments: ['Gitaar', 'Bandcoaching'], availableHours: 37 },
	{ id: '2', name: 'Karel Keys', instruments: ['Keyboard', 'Bandcoaching'], availableHours: 24.5 },
	{ id: '3', name: 'Mark de Vries', instruments: [], availableHours: 28 },
];

export function TeacherAvailability({ teachers = defaultTeachers, isLoading = false }: TeacherAvailabilityProps) {
	if (isLoading) {
		return (
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-base font-semibold">Docent Beschikbaarheid</CardTitle>
					<Skeleton className="h-4 w-20" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{[1, 2, 3].map((n) => (
							<div key={`teacher-skeleton-${n}`} className="flex items-center gap-4">
								<Skeleton className="h-10 w-10 rounded-full" />
								<div className="flex-1 space-y-1">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-3 w-32" />
								</div>
								<Skeleton className="h-4 w-16" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-base font-semibold">Docent Beschikbaarheid</CardTitle>
				<Button variant="ghost" size="sm" asChild>
					<Link
						to="/teachers"
						className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
					>
						Bekijk alle
						<ChevronRight className="h-4 w-4" />
					</Link>
				</Button>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{teachers.map((teacher) => (
						<div key={teacher.id} className="flex items-center gap-4">
							<Avatar className="h-10 w-10">
								<AvatarFallback className="bg-primary/10 text-primary">
									{teacher.name.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="flex-1 min-w-0">
								<p className="font-medium truncate">{teacher.name}</p>
								<div className="flex flex-wrap gap-1 mt-0.5">
									{teacher.instruments.length > 0 ? (
										teacher.instruments.map((instrument) => (
											<Badge key={instrument} variant="secondary" className="text-xs">
												{instrument}
											</Badge>
										))
									) : (
										<span className="text-xs text-muted-foreground">Geen lessen toegewezen</span>
									)}
								</div>
							</div>
							<div className="flex items-center gap-1 text-success shrink-0">
								<CheckCircle className="h-4 w-4" />
								<span className="text-sm font-medium">{teacher.availableHours} uur vrij</span>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
