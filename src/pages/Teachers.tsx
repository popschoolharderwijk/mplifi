import { useState } from 'react';
import { LuEllipsis, LuMail, LuPhone, LuPlus, LuSearch, LuUsers } from 'react-icons/lu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Dummy teacher data
const dummyTeachers = [
	{
		id: '1',
		name: 'Jan Bakker',
		email: 'jan.bakker@popschool.nl',
		phone: '06-11111111',
		instruments: ['Piano', 'Keyboard', 'Zang'],
		studentCount: 12,
		status: 'active',
		availability: 'Ma, Wo, Vr',
	},
	{
		id: '2',
		name: 'Maria Peters',
		email: 'maria.peters@popschool.nl',
		phone: '06-22222222',
		instruments: ['Gitaar', 'Basgitaar', 'Ukelele'],
		studentCount: 15,
		status: 'active',
		availability: 'Di, Do, Za',
	},
	{
		id: '3',
		name: 'Pieter de Groot',
		email: 'pieter.degroot@popschool.nl',
		phone: '06-33333333',
		instruments: ['Drums', 'Percussie', 'Saxofoon'],
		studentCount: 8,
		status: 'active',
		availability: 'Ma, Di, Wo, Do',
	},
	{
		id: '4',
		name: 'Anna van Leeuwen',
		email: 'anna.vleeuwen@popschool.nl',
		phone: '06-44444444',
		instruments: ['Viool', 'Altviool', 'Cello'],
		studentCount: 6,
		status: 'active',
		availability: 'Wo, Vr, Za',
	},
	{
		id: '5',
		name: 'Thomas Hendriks',
		email: 'thomas.hendriks@popschool.nl',
		phone: '06-55555555',
		instruments: ['Zang', 'Songwriting'],
		studentCount: 10,
		status: 'inactive',
		availability: '-',
	},
	{
		id: '6',
		name: 'Lisa de Wit',
		email: 'lisa.dewit@popschool.nl',
		phone: '06-66666666',
		instruments: ['Piano', 'Muziektheorie'],
		studentCount: 9,
		status: 'active',
		availability: 'Ma, Di, Vr',
	},
];

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
	active: { label: 'Actief', variant: 'default' },
	inactive: { label: 'Inactief', variant: 'outline' },
};

export default function Teachers() {
	const [searchQuery, setSearchQuery] = useState('');

	const filteredTeachers = dummyTeachers.filter(
		(teacher) =>
			teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			teacher.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
			teacher.instruments.some((i) => i.toLowerCase().includes(searchQuery.toLowerCase())),
	);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Docenten</h1>
					<p className="text-muted-foreground">Beheer docenten en hun beschikbaarheid</p>
				</div>
				<Button>
					<LuPlus className="mr-2 h-4 w-4" />
					Nieuwe Docent
				</Button>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Docenten Overzicht</CardTitle>
						<div className="relative">
							<LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="text"
								placeholder="Zoeken..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-9 w-64 rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b text-left text-sm text-muted-foreground">
									<th className="pb-3 font-medium">Docent</th>
									<th className="pb-3 font-medium">Instrumenten</th>
									<th className="pb-3 font-medium">Leerlingen</th>
									<th className="pb-3 font-medium">Beschikbaarheid</th>
									<th className="pb-3 font-medium">Status</th>
									<th className="pb-3 font-medium" />
								</tr>
							</thead>
							<tbody>
								{filteredTeachers.map((teacher) => (
									<tr key={teacher.id} className="border-b last:border-0">
										<td className="py-4">
											<div className="flex items-center gap-3">
												<Avatar className="h-9 w-9">
													<AvatarFallback className="bg-primary/10 text-primary text-sm">
														{teacher.name
															.split(' ')
															.map((n) => n[0])
															.join('')
															.slice(0, 2)
															.toUpperCase()}
													</AvatarFallback>
												</Avatar>
												<div>
													<p className="font-medium">{teacher.name}</p>
													<div className="flex items-center gap-2 text-sm text-muted-foreground">
														<LuMail className="h-3 w-3" />
														{teacher.email}
													</div>
												</div>
											</div>
										</td>
										<td className="py-4">
											<div className="flex flex-wrap gap-1">
												{teacher.instruments.map((instrument) => (
													<Badge key={instrument} variant="secondary" className="text-xs">
														{instrument}
													</Badge>
												))}
											</div>
										</td>
										<td className="py-4">
											<div className="flex items-center gap-1.5 text-muted-foreground">
												<LuUsers className="h-4 w-4" />
												{teacher.studentCount}
											</div>
										</td>
										<td className="py-4 text-muted-foreground">{teacher.availability}</td>
										<td className="py-4">
											<Badge variant={statusLabels[teacher.status].variant}>
												{statusLabels[teacher.status].label}
											</Badge>
										</td>
										<td className="py-4">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="ghost" size="icon" className="h-8 w-8">
														<LuEllipsis className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem>Bekijken</DropdownMenuItem>
													<DropdownMenuItem>Bewerken</DropdownMenuItem>
													<DropdownMenuItem>
														<LuPhone className="mr-2 h-4 w-4" />
														Bellen
													</DropdownMenuItem>
													<DropdownMenuItem>Rooster bekijken</DropdownMenuItem>
													<DropdownMenuItem className="text-destructive">
														Verwijderen
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="mt-4 text-sm text-muted-foreground">
						{filteredTeachers.length} van {dummyTeachers.length} docenten
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
