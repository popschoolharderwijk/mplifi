-- Shared views for pagination functions
-- These views encapsulate common patterns used across multiple pagination functions

-- View for profiles with calculated display_name
-- This view is used by students, teachers, and other entities that need profile data
--
-- SECURITY NOTE: Uses security_invoker = on to ensure RLS policies on profiles table
-- are enforced using the calling user's permissions, not the view owner's.
-- This prevents privilege escalation through the view.
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
