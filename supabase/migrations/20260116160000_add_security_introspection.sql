-- =============================================================================
-- SECURITY INTROSPECTION FUNCTIONS FOR CI TESTING
-- =============================================================================
-- These functions allow the test suite to verify RLS configuration.
-- They query PostgreSQL system catalogs and are restricted to service_role only.
--
-- SECURITY MODEL:
-- - SECURITY DEFINER: Runs with postgres privileges to access system catalogs
-- - SET search_path: Prevents search_path injection attacks
-- - SET row_security = off: Bypasses RLS for system catalog queries
-- - REVOKE FROM PUBLIC: No public access
-- - GRANT TO service_role: Only CI/backend can call these
--
-- WARNING: These functions expose schema metadata. Only grant to trusted roles.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- check_rls_enabled: Verify RLS is enabled on a table
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_rls_enabled(p_table_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (SELECT relrowsecurity
     FROM pg_class
     WHERE relname = p_table_name
       AND relnamespace = 'public'::regnamespace),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- policy_exists: Check if a specific RLS policy exists
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.policy_exists(p_table_name TEXT, p_policy_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = p_table_name
      AND policyname = p_policy_name
  );
$$;

-- -----------------------------------------------------------------------------
-- get_table_policies: List all policies for a table
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_table_policies(p_table_name TEXT)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    ARRAY_AGG(policyname ORDER BY policyname),
    ARRAY[]::TEXT[]
  )
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = p_table_name;
$$;

-- -----------------------------------------------------------------------------
-- function_exists: Check if a function exists in public schema
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.function_exists(p_fn_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = p_fn_name
      AND pronamespace = 'public'::regnamespace
  );
$$;

-- =============================================================================
-- SECURITY: Ownership and Access Control
-- =============================================================================

-- Set explicit ownership
ALTER FUNCTION public.check_rls_enabled(TEXT) OWNER TO postgres;
ALTER FUNCTION public.policy_exists(TEXT, TEXT) OWNER TO postgres;
ALTER FUNCTION public.get_table_policies(TEXT) OWNER TO postgres;
ALTER FUNCTION public.function_exists(TEXT) OWNER TO postgres;

-- Remove all public access
REVOKE ALL ON FUNCTION public.check_rls_enabled(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.policy_exists(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_table_policies(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.function_exists(TEXT) FROM PUBLIC;

-- Explicitly revoke from anon (Supabase's anon role doesn't inherit from PUBLIC revokes)
REVOKE ALL ON FUNCTION public.check_rls_enabled(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.policy_exists(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.get_table_policies(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.function_exists(TEXT) FROM anon;

-- Grant access only to service_role (CI/backend testing)
GRANT EXECUTE ON FUNCTION public.check_rls_enabled(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.policy_exists(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_table_policies(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.function_exists(TEXT) TO service_role;

-- =============================================================================
-- END SECURITY INTROSPECTION
-- =============================================================================
