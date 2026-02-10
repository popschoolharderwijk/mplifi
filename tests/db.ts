import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/integrations/supabase/types';
import type { TestUser } from './rls/test-users';

// Cache authenticated clients per user to avoid rate limiting
const clientCache = new Map<TestUser, SupabaseClient<Database>>();

export function createClientBypassRLS() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !key) {
		throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
	}

	return createClient<Database>(url, key);
}

export function createClientAnon() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

	if (!url || !key) {
		throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_DEFAULT_KEY must be set');
	}

	return createClient<Database>(url, key);
}

export async function createClientAs(user: TestUser) {
	// Return cached client if available
	const cached = clientCache.get(user);
	if (cached) {
		return cached;
	}

	const TEST_PASSWORD = process.env.VITE_DEV_LOGIN_PASSWORD;

	if (!TEST_PASSWORD) {
		throw new Error('VITE_DEV_LOGIN_PASSWORD must be set in environment for tests');
	}

	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

	if (!url || !key) {
		throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_DEFAULT_KEY must be set');
	}

	// Create a fresh client for this user (not shared with anon)
	const client = createClient<Database>(url, key, {
		auth: {
			persistSession: false, // Don't persist to storage
			autoRefreshToken: true,
		},
	});

	const { error } = await client.auth.signInWithPassword({
		email: user,
		password: TEST_PASSWORD,
	});

	if (error) {
		throw new Error(`Failed to sign in as ${user}: ${error.message}`);
	}

	// Cache the authenticated client
	clientCache.set(user, client);

	return client;
}
