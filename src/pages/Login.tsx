import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type LoginState = 'idle' | 'sending' | 'sent' | 'verifying';

export default function Login() {
	const { user, isLoading } = useAuth();
	const [email, setEmail] = useState('');
	const [otp, setOtp] = useState('');
	const [state, setState] = useState<LoginState>('idle');
	const [error, setError] = useState<string | null>(null);

	// Redirect if already logged in
	if (!isLoading && user) {
		return <Navigate to="/" replace />;
	}

	const handleSendMagicLink = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setState('sending');

		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				shouldCreateUser: false,
				emailRedirectTo: `${window.location.origin}/auth/callback`,
			},
		});

		if (error) {
			// User-friendly error message for unregistered users
			if (error.message === 'Signups not allowed for otp') {
				setError('Dit emailadres is niet geregistreerd. Maak eerst een account aan.');
			} else {
				setError(error.message);
			}
			setState('idle');
		} else {
			setState('sent');
		}
	};

	const handleVerifyOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setState('verifying');

		const { error } = await supabase.auth.verifyOtp({
			email,
			token: otp,
			type: 'email',
		});

		if (error) {
			setError(error.message);
			setState('sent');
		}
		// Success: onAuthStateChange will handle redirect
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
					<h1 className="text-2xl font-bold">Inloggen</h1>
					<p className="text-muted-foreground mt-2">Geen wachtwoord nodig - we sturen je een link.</p>
				</div>

				{error && (
					<div className="bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
						{error}
					</div>
				)}

				{state === 'idle' || state === 'sending' ? (
					<form onSubmit={handleSendMagicLink} className="space-y-4">
						<div>
							<label htmlFor="email" className="block text-sm font-medium mb-1">
								Email
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
							{state === 'sending' ? 'Versturen...' : 'Verstuur Magic Link'}
						</button>
					</form>
				) : (
					<div className="space-y-4">
						<div className="bg-accent border border-border px-4 py-3 rounded">
							<p className="font-medium text-foreground">Check je email!</p>
							<p className="text-sm mt-1 text-muted-foreground">
								We hebben een magic link gestuurd naar{' '}
								<strong className="text-foreground">{email}</strong>. Klik op de link of voer de code
								hieronder in.
							</p>
						</div>

						<form onSubmit={handleVerifyOtp} className="space-y-4">
							<div>
								<label htmlFor="otp" className="block text-sm font-medium mb-1">
									Of voer de code in
								</label>
								<input
									id="otp"
									type="text"
									inputMode="numeric"
									pattern="[0-9]{6,8}"
									maxLength={8}
									value={otp}
									onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
									placeholder="00000000"
									disabled={state === 'verifying'}
									className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 text-center text-2xl tracking-widest"
								/>
							</div>
							<button
								type="submit"
								disabled={state === 'verifying' || otp.length < 6}
								className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
							>
								{state === 'verifying' ? 'Verifiëren...' : 'Verifieer Code'}
							</button>
						</form>

						<button
							type="button"
							onClick={() => {
								setState('idle');
								setOtp('');
							}}
							className="w-full py-2 px-4 text-muted-foreground hover:text-foreground"
						>
							← Ander emailadres gebruiken
						</button>
					</div>
				)}

				<p className="text-center text-sm text-muted-foreground">
					Nog geen account?{' '}
					<Link to="/register" className="text-primary hover:underline">
						Registreren
					</Link>
				</p>
			</div>
		</div>
	);
}
