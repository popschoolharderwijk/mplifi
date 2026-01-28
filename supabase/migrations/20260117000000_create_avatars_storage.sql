-- =============================================================================
-- STORAGE: AVATARS BUCKET POLICIES
-- =============================================================================
-- Storage buckets cannot be created via SQL migrations.
-- Run: bun run scripts/create-storage-bucket.ts
-- Or create manually in Supabase Dashboard: Storage > Create bucket > "avatars" (public)
--
-- This migration only creates the RLS policies for the avatars bucket.
-- =============================================================================

-- Note: The bucket must be created first via the script or dashboard.
-- These policies assume the bucket name is 'avatars' and it's public.

-- File path format: {user_id}.{ext} (e.g., abc-def-123.png)
-- Using consistent filename allows overwriting previous avatar (no storage leak)

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND name LIKE auth.uid()::text || '.%'
);

-- Allow authenticated users to update (overwrite) their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND name LIKE auth.uid()::text || '.%'
)
WITH CHECK (
  bucket_id = 'avatars'
  AND name LIKE auth.uid()::text || '.%'
);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND name LIKE auth.uid()::text || '.%'
);

-- Public bucket: authenticated users can view all avatars
-- The bucket is public for CDN/caching benefits, but we restrict API access to authenticated users
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
