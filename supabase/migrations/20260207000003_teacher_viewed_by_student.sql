-- =============================================================================
-- TEACHER VIEWED BY STUDENT VIEW
-- =============================================================================
-- This migration creates:
-- 1. A security definer function that exposes limited teacher contact information
-- 2. A view that uses this function
--
-- Students can only see teachers they have lesson agreements with.
-- Only name, avatar and phone_number are exposed (not email or other profile fields).
-- =============================================================================

-- =============================================================================
-- SECTION 1: FUNCTION
-- =============================================================================

-- Security definer function that returns limited teacher contact info for students.
-- Bypasses RLS on teachers and profiles to allow students to see their teachers.
-- Only exposes: first_name, last_name, avatar_url, phone_number (not email or other fields).
--
-- This view is intended ONLY for students. Staff/admin/site_admin can access the
-- teachers and profiles tables directly with full details via their own RLS policies.
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
  SELECT DISTINCT
    t.id AS teacher_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.phone_number
  FROM public.lesson_agreements la
  INNER JOIN public.teachers t ON la.teacher_id = t.id
  INNER JOIN public.profiles p ON t.user_id = p.user_id
  WHERE la.student_user_id = (SELECT auth.uid());
$$;

-- Revoke public access
REVOKE ALL ON FUNCTION public.get_teachers_viewed_by_student() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_teachers_viewed_by_student() FROM anon;

-- Grant to authenticated users
GRANT EXECUTE ON FUNCTION public.get_teachers_viewed_by_student() TO authenticated;

ALTER FUNCTION public.get_teachers_viewed_by_student() OWNER TO postgres;

-- =============================================================================
-- SECTION 2: VIEW
-- =============================================================================

-- View that uses the security definer function
-- This allows students to see teacher contact info while respecting RLS
CREATE OR REPLACE VIEW public.teacher_viewed_by_student AS
SELECT * FROM public.get_teachers_viewed_by_student();

-- Grant SELECT on the view
GRANT SELECT ON public.teacher_viewed_by_student TO authenticated;

-- =============================================================================
-- END OF TEACHER VIEWED BY STUDENT VIEW MIGRATION
-- =============================================================================
