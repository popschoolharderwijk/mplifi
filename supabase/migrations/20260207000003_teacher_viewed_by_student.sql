-- =============================================================================
-- TEACHER VIEWED BY STUDENT VIEW
-- =============================================================================
-- This migration creates:
-- 1. A SECURITY DEFINER function that exposes limited teacher contact information
-- 2. A view that uses this function
--
-- Students can only see teachers they have lesson agreements with.
-- Only name, avatar and phone_number are exposed (not email or other profile fields).
--
-- SECURITY DESIGN DECISION:
-- The function uses SECURITY DEFINER to bypass RLS on teachers and profiles tables.
-- This is an INTENTIONAL design choice because:
-- 1. The function enforces explicit authorization checks using auth.uid()
-- 2. Only a limited set of columns are returned (no email or other sensitive data)
-- 3. The function verifies the caller is a student (has lesson_agreements)
-- 4. Owner is postgres; EXECUTE is granted only to authenticated users
-- 5. Tests in tests/rls/teachers/teacher-viewed-by-student.test.ts verify that
--    unauthorized callers cannot retrieve rows
--
-- LINTER WARNING:
-- The Supabase linter will report: "View public.teacher_viewed_by_student is
-- defined with the SECURITY DEFINER property". This is a FALSE POSITIVE for this
-- specific case because security is enforced via explicit auth.uid() checks.
--
-- WHITELIST ENTRY:
-- This view is registered in the ALLOWED_SECURITY_DEFINER_VIEWS whitelist in
-- tests/rls/system/baseline.security.test.ts. Any new SECURITY DEFINER views
-- must be added to this whitelist with proper documentation and security review.
--
-- This view is intended ONLY for students. Staff/admin/site_admin can access the
-- teachers and profiles tables directly with full details via their own RLS policies.
-- =============================================================================

-- =============================================================================
-- SECTION 1: FUNCTION
-- =============================================================================

-- Function that returns limited teacher contact info for students
-- Uses SECURITY DEFINER to bypass RLS on teachers and profiles tables
-- BUT with explicit security checks: only returns data for the calling user (auth.uid())
-- and only if they are a student (have lesson_agreements)
-- This is more secure than unrestricted SECURITY DEFINER because it validates the caller
CREATE OR REPLACE FUNCTION public.get_teachers_viewed_by_student()
RETURNS TABLE (
  teacher_id UUID,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone_number TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  -- Explicitly check that the caller is a student (has lesson_agreements)
  -- This prevents non-students from using this function
  -- Only return data for the calling user (auth.uid())
  SELECT DISTINCT
    t.id AS teacher_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.phone_number
  FROM public.lesson_agreements la
  INNER JOIN public.teachers t ON la.teacher_id = t.id
  INNER JOIN public.profiles p ON t.user_id = p.user_id
  WHERE la.student_user_id = (SELECT auth.uid())
    -- Additional check: ensure user has at least one agreement (is a student)
    AND EXISTS (
      SELECT 1
      FROM public.lesson_agreements la2
      WHERE la2.student_user_id = (SELECT auth.uid())
    );
$$;

-- Revoke public access
REVOKE ALL ON FUNCTION public.get_teachers_viewed_by_student() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_teachers_viewed_by_student() FROM anon;

-- Grant to authenticated users
GRANT EXECUTE ON FUNCTION public.get_teachers_viewed_by_student() TO authenticated;

ALTER FUNCTION public.get_teachers_viewed_by_student() OWNER TO postgres;

-- Documentation: explain the SECURITY DEFINER design decision
COMMENT ON FUNCTION public.get_teachers_viewed_by_student() IS
  'Intentional SECURITY DEFINER function. Bypasses RLS to expose limited teacher info '
  '(name, avatar, phone) to students. Security enforced via auth.uid() checks and '
  'verification that caller has lesson_agreements. See tests/rls/teachers/teacher-viewed-by-student.test.ts '
  'for verification that unauthorized callers cannot retrieve rows.';

-- =============================================================================
-- SECTION 2: VIEW
-- =============================================================================

-- View that uses the SECURITY DEFINER function
CREATE OR REPLACE VIEW public.teacher_viewed_by_student AS
SELECT * FROM public.get_teachers_viewed_by_student();

-- Grant SELECT on the view
GRANT SELECT ON public.teacher_viewed_by_student TO authenticated;

-- Documentation: explain the view is backed by a SECURITY DEFINER function
COMMENT ON VIEW public.teacher_viewed_by_student IS
  'View backed by SECURITY DEFINER function get_teachers_viewed_by_student(). '
  'Access is enforced via auth.uid() and lesson_agreements checks. '
  'Only exposes: teacher_id, first_name, last_name, avatar_url, phone_number. '
  'See function comment and tests/rls/teachers/teacher-viewed-by-student.test.ts for security details.';

-- =============================================================================
-- END OF TEACHER VIEWED BY STUDENT VIEW MIGRATION
-- =============================================================================
