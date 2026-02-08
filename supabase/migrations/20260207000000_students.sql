-- =============================================================================
-- STUDENTS TABLE
-- =============================================================================
-- This migration creates:
-- 1. students table for managing student records
-- 2. RLS policies for the table
-- 3. Triggers for data integrity
--
-- Students are linked to auth.users via user_id.
-- =============================================================================

-- =============================================================================
-- SECTION 1: TYPES
-- =============================================================================
-- No custom types needed for this migration

-- =============================================================================
-- SECTION 2: TABLES
-- =============================================================================

-- Students table - links users to student records
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

-- =============================================================================
-- SECTION 3: ENABLE RLS
-- =============================================================================

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
-- FORCE RLS: Even table owner / service_role is subject to RLS policies.
-- This is a security best practice but means admin scripts must use service_role
-- or bypass RLS explicitly. Many teams omit FORCE for operational flexibility.
ALTER TABLE public.students FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 4: HELPER FUNCTIONS
-- =============================================================================

-- Helper function to check if a user is a student
-- Uses SECURITY DEFINER to bypass RLS on students table
CREATE OR REPLACE FUNCTION public.is_student(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students
    WHERE user_id = _user_id
  );
$$;

-- Revoke public access, grant only to authenticated users
REVOKE ALL ON FUNCTION public.is_student(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_student(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_student(UUID) TO authenticated;
ALTER FUNCTION public.is_student(UUID) OWNER TO postgres;

-- Helper function to get student ID for a user
-- Uses SECURITY DEFINER to bypass RLS on students table
CREATE OR REPLACE FUNCTION public.get_student_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT id
  FROM public.students
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Revoke public access, grant only to authenticated users
REVOKE ALL ON FUNCTION public.get_student_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_id(UUID) TO authenticated;
ALTER FUNCTION public.get_student_id(UUID) OWNER TO postgres;

-- =============================================================================
-- SECTION 5: RLS POLICIES
-- =============================================================================

-- Students can view their own record
CREATE POLICY students_select_own
ON public.students FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Staff, admins and site_admins can view all students
CREATE POLICY students_select_staff
ON public.students FOR SELECT TO authenticated
USING (
  public.is_staff((select auth.uid()))
  OR public.is_admin((select auth.uid()))
  OR public.is_site_admin((select auth.uid()))
);

-- Note: INSERT and DELETE policies are intentionally omitted.
-- Students are automatically created/deleted via triggers on lesson_agreements.
-- No one can manually insert or delete students.

-- Admins and site_admins can update students (for future fields)
CREATE POLICY students_update_admin
ON public.students FOR UPDATE TO authenticated
USING (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())))
WITH CHECK (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())));

-- =============================================================================
-- SECTION 6: TRIGGERS
-- =============================================================================

-- Reuse existing update_updated_at_column function from baseline
CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- SECTION 7: PERMISSIONS
-- =============================================================================

-- GRANT gives table-level permissions, but RLS policies (above) are what
-- actually control access. GRANT is required for RLS to work, but RLS is the
-- security boundary. Without matching RLS policies, GRANT alone does NOT grant access.
-- Note: INSERT and DELETE are not granted - students are managed automatically via triggers.
GRANT SELECT, UPDATE ON public.students TO authenticated;

-- =============================================================================
-- END OF STUDENTS MIGRATION
-- =============================================================================
