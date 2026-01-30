-- ============================================================
-- PERFORMANCE FIX: Consolidate multiple PERMISSIVE policies
-- into single policies with combined conditions
-- ============================================================

-- ===================
-- PROFILES TABLE
-- ===================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_select_staff ON public.profiles;

-- Create single consolidated SELECT policy
CREATE POLICY profiles_select
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  -- Own profile
  (SELECT auth.uid()) = user_id
  -- OR admin/site_admin
  OR public.is_admin((SELECT auth.uid()))
  OR public.is_site_admin((SELECT auth.uid()))
  -- OR staff
  OR public.is_staff((SELECT auth.uid()))
);

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;

-- Create single consolidated UPDATE policy
CREATE POLICY profiles_update
ON public.profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  -- Own profile
  (SELECT auth.uid()) = user_id
  -- OR admin/site_admin
  OR public.is_admin((SELECT auth.uid()))
  OR public.is_site_admin((SELECT auth.uid()))
)
WITH CHECK (
  -- Own profile
  (SELECT auth.uid()) = user_id
  -- OR admin/site_admin
  OR public.is_admin((SELECT auth.uid()))
  OR public.is_site_admin((SELECT auth.uid()))
);

-- ===================
-- USER_ROLES TABLE
-- ===================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS roles_select_own ON public.user_roles;
DROP POLICY IF EXISTS roles_select_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_select_staff ON public.user_roles;

-- Create single consolidated SELECT policy
CREATE POLICY roles_select
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  -- Own role
  (SELECT auth.uid()) = user_id
  -- OR admin/site_admin
  OR public.is_admin((SELECT auth.uid()))
  OR public.is_site_admin((SELECT auth.uid()))
  -- OR staff
  OR public.is_staff((SELECT auth.uid()))
);

-- INSERT, UPDATE, DELETE policies remain as single policies (no consolidation needed)