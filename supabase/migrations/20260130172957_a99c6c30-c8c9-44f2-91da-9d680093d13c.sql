-- ============================================================
-- FIX: Convert all RESTRICTIVE policies to PERMISSIVE
-- ============================================================

-- ===================
-- PROFILES TABLE
-- ===================

-- Drop existing RESTRICTIVE policies
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_select_staff ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;

-- Recreate as PERMISSIVE (correct syntax: AS before TO)
CREATE POLICY profiles_select_own
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY profiles_select_admin
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.is_admin((SELECT auth.uid())) OR public.is_site_admin((SELECT auth.uid())));

CREATE POLICY profiles_select_staff
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.is_staff((SELECT auth.uid())));

CREATE POLICY profiles_update_own
ON public.profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY profiles_update_admin
ON public.profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (public.is_admin((SELECT auth.uid())) OR public.is_site_admin((SELECT auth.uid())))
WITH CHECK (public.is_admin((SELECT auth.uid())) OR public.is_site_admin((SELECT auth.uid())));

-- ===================
-- USER_ROLES TABLE
-- ===================

-- Drop existing RESTRICTIVE policies
DROP POLICY IF EXISTS roles_select_own ON public.user_roles;
DROP POLICY IF EXISTS roles_select_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_select_staff ON public.user_roles;
DROP POLICY IF EXISTS roles_insert_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_update_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_delete_admin ON public.user_roles;

-- Recreate as PERMISSIVE
CREATE POLICY roles_select_own
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY roles_select_admin
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.is_admin((SELECT auth.uid())) OR public.is_site_admin((SELECT auth.uid())));

CREATE POLICY roles_select_staff
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.is_staff((SELECT auth.uid())));

CREATE POLICY roles_insert_admin
ON public.user_roles
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_admin((SELECT auth.uid())) AND role != 'site_admin')
  OR public.is_site_admin((SELECT auth.uid()))
);

CREATE POLICY roles_update_admin
ON public.user_roles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  ((public.is_admin((SELECT auth.uid())) AND role != 'site_admin')
   OR public.is_site_admin((SELECT auth.uid())))
  AND user_id != (SELECT auth.uid())
)
WITH CHECK (
  ((public.is_admin((SELECT auth.uid())) AND role != 'site_admin')
   OR public.is_site_admin((SELECT auth.uid())))
  AND user_id != (SELECT auth.uid())
);

CREATE POLICY roles_delete_admin
ON public.user_roles
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  (public.is_admin((SELECT auth.uid())) AND role != 'site_admin')
  OR public.is_site_admin((SELECT auth.uid()))
);