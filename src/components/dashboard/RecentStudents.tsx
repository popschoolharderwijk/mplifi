import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Student {
	id: string;
	name: string;
	email: string;
	status: 'active' | 'trial' | 'inactive';
	joinDate?: string;
}

interface RecentStudentsProps {
	students?: Student[];
	isLoading?: boolean;
}

const defaultStudents: Student[] = [
	{ id: '1', name: 'test', email: 'test@test.nl', status: 'trial' },
	{ id: '2', name: 'test', email: 'test@test.nl', status: 'trial', joinDate: '22-12-2025' },
	{ id: '3', name: 'test3 test4', email: 'test12@test.nl', status: 'trial', joinDate: '22-12-2025' },
];

function getStatusBadge(status: Student['status']) {
	switch (status) {
		case 'active':
			return <Badge className="bg-success text-success-foreground">Actief</Badge>;
		case 'trial':
			return <Badge variant="outline">Proefles</Badge>;
		case 'inactive':
			return <Badge variant="secondary">Inactief</Badge>;
		default:
			return null;
	}
}

export function RecentStudents({ students = defaultStudents, isLoading = false }: RecentStudentsProps) {
	if (isLoading) {
		return (
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-base font-semibold">Recente Leerlingen</CardTitle>
					<Skeleton className="h-4 w-20" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{[1, 2, 3].map((n) => (
							<div key={`student-skeleton-${n}`} className="flex items-center gap-4">
								<Skeleton className="h-10 w-10 rounded-full" />
								<div className="flex-1 space-y-1">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-3 w-32" />
								</div>
								<Skeleton className="h-6 w-16 rounded-full" />
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
				<CardTitle className="text-base font-semibold">Recente Leerlingen</CardTitle>
				<Button variant="ghost" size="sm" asChild>
					<Link
						to="/students"
						className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
					>
						Bekijk alle
						<ChevronRight className="h-4 w-4" />
					</Link>
				</Button>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{students.map((student) => (
						<div key={student.id} className="flex items-center gap-4">
							<Avatar className="h-10 w-10">
								<AvatarFallback className="bg-primary/10 text-primary">
									{student.name.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="flex-1 min-w-0">
								<p className="font-medium truncate">{student.name}</p>
								<p className="text-sm text-muted-foreground truncate">{student.email}</p>
							</div>
							<div className="flex items-center gap-2">
								{student.joinDate && (
									<span className="text-xs text-muted-foreground hidden sm:block">
										{student.joinDate}
									</span>
								)}
								{getStatusBadge(student.status)}
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
