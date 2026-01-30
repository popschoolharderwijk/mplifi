-- ============================================================
-- FIX: Restore missing user_roles INSERT/UPDATE/DELETE policies
-- Also adds self-modification protection to DELETE policy
-- ============================================================

-- Ensure old policies are dropped (idempotent)
DROP POLICY IF EXISTS roles_insert_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_update_admin ON public.user_roles;
DROP POLICY IF EXISTS roles_delete_admin ON public.user_roles;

-- INSERT: admin can assign roles (except site_admin), site_admin can assign any
CREATE POLICY roles_insert
ON public.user_roles
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_admin((SELECT auth.uid())) AND role != 'site_admin')
  OR public.is_site_admin((SELECT auth.uid()))
);

-- UPDATE: admin/site_admin can change roles, but not their own role
-- admin cannot modify site_admin roles
CREATE POLICY roles_update
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

-- DELETE: admin/site_admin can delete roles, but not their own role
-- admin cannot delete site_admin roles
-- Added: user_id != auth.uid() to prevent self-deletion
CREATE POLICY roles_delete
ON public.user_roles
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  ((public.is_admin((SELECT auth.uid())) AND role != 'site_admin')
   OR public.is_site_admin((SELECT auth.uid())))
  AND user_id != (SELECT auth.uid())
);