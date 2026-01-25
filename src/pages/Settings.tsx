import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function Settings() {
	const { theme, setTheme } = useTheme();

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Instellingen</h1>
				<p className="text-muted-foreground">Beheer je voorkeuren en accountinstellingen</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Thema</CardTitle>
					<CardDescription>Kies je voorkeur voor licht of donker thema</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex gap-2">
						<Button
							variant="outline"
							className={cn('flex-1', theme === 'light' && 'border-primary bg-primary/10')}
							onClick={() => setTheme('light')}
						>
							<Sun className="mr-2 h-4 w-4" />
							Licht
						</Button>
						<Button
							variant="outline"
							className={cn('flex-1', theme === 'dark' && 'border-primary bg-primary/10')}
							onClick={() => setTheme('dark')}
						>
							<Moon className="mr-2 h-4 w-4" />
							Donker
						</Button>
						<Button
							variant="outline"
							className={cn('flex-1', theme === 'system' && 'border-primary bg-primary/10')}
							onClick={() => setTheme('system')}
						>
							<Monitor className="mr-2 h-4 w-4" />
							Systeem
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
