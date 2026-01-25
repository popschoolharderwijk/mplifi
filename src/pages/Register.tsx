import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type RegisterState = 'idle' | 'sending' | 'sent';

export default function Register() {
	const { user, isLoading } = useAuth();
	const [email, setEmail] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [state, setState] = useState<RegisterState>('idle');
	const [error, setError] = useState<string | null>(null);

	// Redirect if already logged in
	if (!isLoading && user) {
		return <Navigate to="/" replace />;
	}

	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// Frontend validation - display_name required for registration
		const trimmedName = displayName.trim();
		if (!trimmedName) {
			setError('Naam is verplicht');
			return;
		}

		setState('sending');

		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				shouldCreateUser: true,
				emailRedirectTo: `${window.location.origin}/auth/callback`,
				data: {
					display_name: trimmedName,
				},
			},
		});

		if (error) {
			setError(error.message);
			setState('idle');
		} else {
			setState('sent');
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<p className="text-muted-foreground">Laden...</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold">Registreren</h1>
					<p className="text-muted-foreground mt-2">Maak een nieuw account aan.</p>
				</div>

				{error && (
					<div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
						{error}
					</div>
				)}

				{state === 'sent' ? (
					<div className="bg-accent border border-border px-4 py-3 rounded">
						<p className="font-medium text-foreground">Check je email!</p>
						<p className="text-sm mt-1 text-muted-foreground">
							We hebben een magic link gestuurd naar <strong className="text-foreground">{email}</strong>.
						</p>
					</div>
				) : (
					<form onSubmit={handleRegister} className="space-y-4">
						<div>
							<label htmlFor="displayName" className="block text-sm font-medium mb-1">
								Naam *
							</label>
							<input
								id="displayName"
								type="text"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								placeholder="Jouw naam"
								required
								disabled={state === 'sending'}
								className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
							/>
						</div>
						<div>
							<label htmlFor="email" className="block text-sm font-medium mb-1">
								Email *
							</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="jouw@email.nl"
								required
								disabled={state === 'sending'}
								className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
							/>
						</div>
						<button
							type="submit"
							disabled={state === 'sending'}
							className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
						>
							{state === 'sending' ? 'Versturen...' : 'Registreren'}
						</button>
					</form>
				)}

				<p className="text-center text-sm text-muted-foreground">
					Heb je al een account?{' '}
					<Link to="/login" className="text-primary hover:underline">
						Inloggen
					</Link>
				</p>
			</div>
		</div>
	);
}
