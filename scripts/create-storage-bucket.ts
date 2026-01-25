/**
 * Script to create the avatars storage bucket in Supabase.
 * This bucket is used for user avatar uploads.
 *
 * Configure in .env.local:
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
 *
 * Run: bun run scripts/create-storage-bucket.ts --env-file .env.local
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});

console.log('Creating avatars storage bucket...');

// Check if bucket already exists
const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

if (listError) {
	console.error('Error listing buckets:', listError.message);
	process.exit(1);
}

const avatarsBucket = existingBuckets?.find((bucket) => bucket.name === 'avatars');

if (avatarsBucket) {
	console.log('✅ Avatars bucket already exists!');
	console.log('  Name:', avatarsBucket.name);
	console.log('  Public:', avatarsBucket.public);
	console.log('  Created:', avatarsBucket.created_at);
	process.exit(0);
}

// Create the bucket
const maxFileSize = 5; // in MB
const { data: bucket, error: createError } = await supabase.storage.createBucket('avatars', {
	public: true,
	fileSizeLimit: maxFileSize * 1024 * 1024,
	allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
});

if (createError) {
	console.error('Error creating bucket:', createError.message);
	process.exit(1);
}

console.log('\n✅ Avatars storage bucket created!');
console.log('  Name:', bucket.name);
console.log('  Public: true (configured)');
console.log(`  File size limit: ${maxFileSize} MB`);
console.log('  Allowed types: jpeg, png, gif, webp');
console.log('\nBucket is ready for avatar uploads.');
