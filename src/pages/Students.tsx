import { useState } from 'react';
import { LuEllipsis, LuMail, LuPhone, LuPlus, LuSearch } from 'react-icons/lu';
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

// Dummy student data
const dummyStudents = [
	{
		id: '1',
		name: 'Emma de Vries',
		email: 'emma.devries@email.nl',
		phone: '06-12345678',
		instrument: 'Piano',
		teacher: 'Jan Bakker',
		status: 'active',
		startDate: '2024-09-01',
	},
	{
		id: '2',
		name: 'Lucas Jansen',
		email: 'lucas.jansen@email.nl',
		phone: '06-23456789',
		instrument: 'Gitaar',
		teacher: 'Maria Peters',
		status: 'active',
		startDate: '2024-10-15',
	},
	{
		id: '3',
		name: 'Sophie van den Berg',
		email: 'sophie.vdberg@email.nl',
		phone: '06-34567890',
		instrument: 'Zang',
		teacher: 'Jan Bakker',
		status: 'trial',
		startDate: '2025-01-10',
	},
	{
		id: '4',
		name: 'Daan Visser',
		email: 'daan.visser@email.nl',
		phone: '06-45678901',
		instrument: 'Drums',
		teacher: 'Pieter de Groot',
		status: 'active',
		startDate: '2023-05-20',
	},
	{
		id: '5',
		name: 'Julia Smit',
		email: 'julia.smit@email.nl',
		phone: '06-56789012',
		instrument: 'Viool',
		teacher: 'Maria Peters',
		status: 'inactive',
		startDate: '2024-02-01',
	},
	{
		id: '6',
		name: 'Sem de Jong',
		email: 'sem.dejong@email.nl',
		phone: '06-67890123',
		instrument: 'Saxofoon',
		teacher: 'Pieter de Groot',
		status: 'active',
		startDate: '2024-11-01',
	},
	{
		id: '7',
		name: 'Lotte Mulder',
		email: 'lotte.mulder@email.nl',
		phone: '06-78901234',
		instrument: 'Piano',
		teacher: 'Jan Bakker',
		status: 'active',
		startDate: '2024-08-15',
	},
	{
		id: '8',
		name: 'Finn van Dijk',
		email: 'finn.vandijk@email.nl',
		phone: '06-89012345',
		instrument: 'Basgitaar',
		teacher: 'Maria Peters',
		status: 'trial',
		startDate: '2025-01-20',
	},
];

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
	active: { label: 'Actief', variant: 'default' },
	trial: { label: 'Proefles', variant: 'secondary' },
	inactive: { label: 'Inactief', variant: 'outline' },
};

export default function Students() {
	const [searchQuery, setSearchQuery] = useState('');

	const filteredStudents = dummyStudents.filter(
		(student) =>
			student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
			student.instrument.toLowerCase().includes(searchQuery.toLowerCase()) ||
			student.teacher.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Leerlingen</h1>
					<p className="text-muted-foreground">Beheer alle leerlingen en hun gegevens</p>
				</div>
				<Button>
					<LuPlus className="mr-2 h-4 w-4" />
					Nieuwe Leerling
				</Button>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Leerlingen Overzicht</CardTitle>
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
									<th className="pb-3 font-medium">Leerling</th>
									<th className="pb-3 font-medium">Instrument</th>
									<th className="pb-3 font-medium">Docent</th>
									<th className="pb-3 font-medium">Status</th>
									<th className="pb-3 font-medium">Startdatum</th>
									<th className="pb-3 font-medium" />
								</tr>
							</thead>
							<tbody>
								{filteredStudents.map((student) => (
									<tr key={student.id} className="border-b last:border-0">
										<td className="py-4">
											<div className="flex items-center gap-3">
												<Avatar className="h-9 w-9">
													<AvatarFallback className="bg-primary/10 text-primary text-sm">
														{student.name
															.split(' ')
															.map((n) => n[0])
															.join('')
															.slice(0, 2)
															.toUpperCase()}
													</AvatarFallback>
												</Avatar>
												<div>
													<p className="font-medium">{student.name}</p>
													<div className="flex items-center gap-2 text-sm text-muted-foreground">
														<LuMail className="h-3 w-3" />
														{student.email}
													</div>
												</div>
											</div>
										</td>
										<td className="py-4">{student.instrument}</td>
										<td className="py-4">{student.teacher}</td>
										<td className="py-4">
											<Badge variant={statusLabels[student.status].variant}>
												{statusLabels[student.status].label}
											</Badge>
										</td>
										<td className="py-4 text-muted-foreground">
											{new Date(student.startDate).toLocaleDateString('nl-NL')}
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
						{filteredStudents.length} van {dummyStudents.length} leerlingen
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
