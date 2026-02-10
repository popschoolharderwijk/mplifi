/**
 * Script to create a new user in Supabase.
 * Uses Service Role Key to bypass rate limits and email confirmation.
 *
 * Supports two modes:
 * 1. Passwordless user (Magic Link / OTP only) - when no password is provided
 * 2. Password user (for dev login bypass) - when password is provided
 *
 * Configure in .env.localdev or .env.development:
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
 *   DEV_LOGIN_EMAIL=dev@example.com
 *   DEV_LOGIN_PASSWORD=your-dev-password       (optional, omit for passwordless)
 *   DEV_LOGIN_FIRST_NAME=Your                  (optional)
 *   DEV_LOGIN_LAST_NAME=Name                   (optional)
 *   DEV_LOGIN_ROLE=admin                       (optional)
 *
 * Run: bun run createuser
 */

import { createClient } from '@supabase/supabase-js';
import { Constants } from '@/integrations/supabase/types';

// Valid app_role values from the database enum
const VALID_ROLES = Constants.public.Enums.app_role;
type AppRole = (typeof VALID_ROLES)[number];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEV_LOGIN_EMAIL = process.env.DEV_LOGIN_EMAIL;
const DEV_LOGIN_PASSWORD = process.env.DEV_LOGIN_PASSWORD;
const DEV_LOGIN_FIRST_NAME = process.env.DEV_LOGIN_FIRST_NAME;
const DEV_LOGIN_LAST_NAME = process.env.DEV_LOGIN_LAST_NAME;
const DEV_LOGIN_ROLE = process.env.DEV_LOGIN_ROLE?.trim() || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

if (!DEV_LOGIN_EMAIL) {
	throw new Error('Missing DEV_LOGIN_EMAIL in environment');
}

// Validate DEV_LOGIN_ROLE if provided
if (DEV_LOGIN_ROLE && !VALID_ROLES.includes(DEV_LOGIN_ROLE as AppRole)) {
	throw new Error(`Invalid DEV_LOGIN_ROLE: "${DEV_LOGIN_ROLE}". Valid values are: ${VALID_ROLES.join(', ')}`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});

const hasPassword = !!DEV_LOGIN_PASSWORD;

// Build user_metadata object (only include fields that are set)
const user_metadata: Record<string, string> = {};
if (DEV_LOGIN_FIRST_NAME) user_metadata.first_name = DEV_LOGIN_FIRST_NAME;
if (DEV_LOGIN_LAST_NAME) user_metadata.last_name = DEV_LOGIN_LAST_NAME;

// Check if user already exists
const { data: existingUsers } = await supabase.auth.admin.listUsers();
const existingUser = existingUsers?.users.find((u) => u.email === DEV_LOGIN_EMAIL);

let userId: string | undefined;
let action: 'created' | 'updated';

if (existingUser) {
	// Update existing user in auth.users
	console.log(`Updating existing user: ${DEV_LOGIN_EMAIL}`);

	// Merge with existing metadata to preserve other fields
	const mergedMetadata = { ...existingUser.user_metadata, ...user_metadata };

	const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
		password: DEV_LOGIN_PASSWORD || undefined,
		user_metadata: mergedMetadata,
	});

	if (error) {
		console.error('Error updating user:', error.message);
		process.exit(1);
	}

	// Also update profiles table (trigger only runs on INSERT, not UPDATE)
	if (DEV_LOGIN_FIRST_NAME || DEV_LOGIN_LAST_NAME) {
		const profileUpdate: Record<string, string> = {};
		if (DEV_LOGIN_FIRST_NAME) profileUpdate.first_name = DEV_LOGIN_FIRST_NAME;
		if (DEV_LOGIN_LAST_NAME) profileUpdate.last_name = DEV_LOGIN_LAST_NAME;

		const { error: profileError } = await supabase
			.from('profiles')
			.update(profileUpdate)
			.eq('user_id', existingUser.id);

		if (profileError) {
			console.error('Error updating profile:', profileError.message);
			process.exit(1);
		}
	}

	userId = data.user?.id;
	action = 'updated';
} else {
	// Create new user
	console.log(`Creating ${hasPassword ? 'password' : 'passwordless'} user: ${DEV_LOGIN_EMAIL}`);

	const { data, error } = await supabase.auth.admin.createUser({
		email: DEV_LOGIN_EMAIL,
		email_confirm: true,
		password: DEV_LOGIN_PASSWORD || undefined,
		user_metadata,
	});

	if (error) {
		console.error('Error creating user:', error.message);
		process.exit(1);
	}

	userId = data.user?.id;
	action = 'created';
}

// Handle user_roles based on DEV_LOGIN_ROLE
if (userId) {
	if (DEV_LOGIN_ROLE) {
		// Upsert role: delete existing and insert new (user_id is the primary key)
		const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);

		if (deleteError) {
			console.error('Error removing existing role:', deleteError.message);
			process.exit(1);
		}

		const { error: insertError } = await supabase.from('user_roles').insert({
			user_id: userId,
			role: DEV_LOGIN_ROLE as AppRole,
		});

		if (insertError) {
			console.error('Error assigning role:', insertError.message);
			process.exit(1);
		}

		console.log(`Role "${DEV_LOGIN_ROLE}" assigned to user.`);
	} else {
		// DEV_LOGIN_ROLE is empty, delete any existing role
		const { data: existingRole } = await supabase.from('user_roles').select('role').eq('user_id', userId).single();

		if (existingRole) {
			const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);

			if (deleteError) {
				console.error('Error removing role:', deleteError.message);
				process.exit(1);
			}

			console.log(`Removed existing role "${existingRole.role}" from user.`);
		}
	}
}

console.log(`\n✅ ${hasPassword ? 'Password' : 'Passwordless'} user ${action}!`);
console.log('  ID:', userId);
console.log('  Email:', DEV_LOGIN_EMAIL);
if (DEV_LOGIN_FIRST_NAME || DEV_LOGIN_LAST_NAME) {
	console.log('  Name:', [DEV_LOGIN_FIRST_NAME, DEV_LOGIN_LAST_NAME].filter(Boolean).join(' '));
}
if (DEV_LOGIN_ROLE) {
	console.log('  Role:', DEV_LOGIN_ROLE);
}

if (hasPassword) {
	console.log('\nThis user can login via password (dev bypass) or Magic Link / OTP.');
} else {
	console.log('\nThis user can only login via Magic Link / OTP.');
	console.log('To enable dev login bypass, set VITE_DEV_LOGIN_PASSWORD and recreate the user.');
}
