/**
 * Script to create a new passwordless user in Supabase.
 * Uses Service Role Key to bypass rate limits and email confirmation.
 *
 * Users created with this script can ONLY login via Magic Link / OTP.
 * For test users with passwords, use seed.sql instead.
 *
 * Configure in .env.local:
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
 *   CREATE_USER_EMAIL=your@email.com
 *   CREATE_USER_FIRST_NAME=Your
 *   CREATE_USER_LAST_NAME=Name
 *
 * Run: bun run createuser
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CREATE_USER_EMAIL = process.env.CREATE_USER_EMAIL;
const CREATE_USER_FIRST_NAME = process.env.CREATE_USER_FIRST_NAME;
const CREATE_USER_LAST_NAME = process.env.CREATE_USER_LAST_NAME;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

if (!CREATE_USER_EMAIL) {
	throw new Error('Missing CREATE_USER_EMAIL in environment. Add this to .env.local');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});

console.log(`Creating passwordless user: ${CREATE_USER_EMAIL}`);

const { data, error } = await supabase.auth.admin.createUser({
	email: CREATE_USER_EMAIL,
	email_confirm: true,
	user_metadata: {
		first_name: CREATE_USER_FIRST_NAME || undefined,
		last_name: CREATE_USER_LAST_NAME || undefined,
	},
});

if (error) {
	console.error('Error:', error.message);
	process.exit(1);
}

console.log('\n✅ Passwordless user created!');
console.log('  ID:', data.user?.id);
console.log('  Email:', data.user?.email);
if (CREATE_USER_FIRST_NAME || CREATE_USER_LAST_NAME) {
	console.log('  Name:', [CREATE_USER_FIRST_NAME, CREATE_USER_LAST_NAME].filter(Boolean).join(' '));
}
console.log('\nThis user can only login via Magic Link / OTP.');
