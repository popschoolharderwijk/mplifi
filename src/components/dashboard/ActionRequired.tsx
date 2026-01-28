import { LuClipboardList } from 'react-icons/lu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TrialLessonRequest {
	id: string;
	studentName: string;
	instrument: string;
	date: string;
}

interface ActionRequiredProps {
	requests?: TrialLessonRequest[];
	isLoading?: boolean;
}

const defaultRequests: TrialLessonRequest[] = [
	{
		id: '1',
		studentName: 'test 15 12',
		instrument: 'Gitaar',
		date: '15 dec.',
	},
];

export function ActionRequired({ requests = defaultRequests, isLoading = false }: ActionRequiredProps) {
	if (isLoading) {
		return (
			<Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<div className="flex items-center gap-2">
						<LuClipboardList className="h-5 w-5 text-primary" />
						<Skeleton className="h-5 w-48" />
					</div>
					<Skeleton className="h-6 w-6 rounded-full" />
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<Skeleton className="h-16 w-full rounded-lg" />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!requests || requests.length === 0) {
		return null;
	}

	return (
		<Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<div className="flex items-center gap-2">
					<LuClipboardList className="h-5 w-5 text-primary" />
					<CardTitle className="text-base font-semibold">Openstaande Proefles Aanvragen</CardTitle>
				</div>
				<Badge variant="default" className="rounded-full">
					{requests.length}
				</Badge>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{requests.map((request) => (
						<div
							key={request.id}
							className="flex items-center justify-between rounded-lg bg-card p-4 shadow-sm"
						>
							<div className="flex items-center gap-4">
								<Avatar className="h-10 w-10">
									<AvatarFallback className="bg-muted text-muted-foreground">
										{request.studentName.slice(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div>
									<p className="font-medium">{request.studentName}</p>
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Badge variant="secondary" className="text-xs">
											{request.instrument}
										</Badge>
										<span>{request.date}</span>
									</div>
								</div>
							</div>
							<Button>Inplannen</Button>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
