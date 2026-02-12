-- =============================================================================
-- SHARED PAGINATION VIEWS
-- =============================================================================
-- These views encapsulate common patterns used across multiple pagination functions.
--
-- SECURITY BEST PRACTICE:
-- All views that query RLS-protected tables MUST use `security_invoker = on`
-- (PostgreSQL 15+) to ensure the calling user's RLS policies are enforced.
-- Without this, views run with the owner's permissions and can bypass RLS.
--
-- Views that intentionally bypass RLS must be added to ALLOWED_SECURITY_DEFINER_VIEWS
-- in tests/rls/system/baseline.security.test.ts with proper documentation.
--
-- See docs/architecture.md for full security documentation.
-- =============================================================================

-- View for profiles with calculated display_name
-- This view is used by students, teachers, and other entities that need profile data
--
-- SECURITY: Uses security_invoker = on to ensure RLS policies on profiles table
-- are enforced using the calling user's permissions, not the view owner's.
-- This prevents privilege escalation through the view.
-- Tests in tests/rls/views/view-profiles-with-display-name.test.ts verify RLS is respected.
CREATE OR REPLACE VIEW view_profiles_with_display_name
WITH (security_invoker = on) AS
SELECT
  user_id,
  email,
  first_name,
  last_name,
  phone_number,
  avatar_url,
  created_at,
  COALESCE(
    NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
    email
  ) AS display_name
FROM profiles;

-- Grant SELECT to authenticated users
GRANT SELECT ON view_profiles_with_display_name TO authenticated;

-- Add comment
COMMENT ON VIEW view_profiles_with_display_name IS 'Profile data with calculated display_name field. Uses security_invoker=on to respect RLS policies. Used by pagination functions for students, teachers, and other entities.';
