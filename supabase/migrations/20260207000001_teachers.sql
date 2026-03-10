-- =============================================================================
-- TEACHERS TABLE AND RELATED TABLES
-- =============================================================================
-- This migration creates:
-- 1. teachers table for managing teacher records
-- 2. teacher_availability table for managing teacher availability schedules
-- 3. teacher_lesson_types junction table for linking teachers to lesson types
-- 4. RLS policies for all tables
-- 5. Triggers for data integrity
--
-- Teachers are linked to auth.users via user_id.
-- =============================================================================

-- =============================================================================
-- SECTION 1: TYPES
-- =============================================================================
-- No custom types needed for this migration

-- =============================================================================
-- SECTION 2: TABLES
-- =============================================================================

-- Teachers table - links users to teacher records (user_id is PK)
CREATE TABLE IF NOT EXISTS public.teachers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Teacher profile information
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key to profiles (ensures teacher always has a profile)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teachers_user_id_fkey'
    AND conrelid = 'public.teachers'::regclass
  ) THEN
    ALTER TABLE public.teachers
    ADD CONSTRAINT teachers_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(user_id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teachers_is_active ON public.teachers(is_active);

-- Teacher availability table - defines when teachers are available
CREATE TABLE IF NOT EXISTS public.teacher_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Teacher reference
  teacher_user_id UUID NOT NULL REFERENCES public.teachers(user_id) ON DELETE CASCADE,

  -- Availability schedule
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Data integrity constraints
  CONSTRAINT teacher_availability_time_check CHECK (end_time > start_time)
);

-- Indexes for teacher_availability
CREATE INDEX IF NOT EXISTS idx_teacher_availability_teacher_user_id ON public.teacher_availability(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_availability_day_of_week ON public.teacher_availability(day_of_week);

-- Teacher lesson types junction table - links teachers to lesson types they can teach
CREATE TABLE IF NOT EXISTS public.teacher_lesson_types (
  teacher_user_id UUID NOT NULL REFERENCES public.teachers(user_id) ON DELETE CASCADE,
  lesson_type_id UUID NOT NULL REFERENCES public.lesson_types(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (teacher_user_id, lesson_type_id)
);

-- Indexes for teacher_lesson_types
CREATE INDEX IF NOT EXISTS idx_teacher_lesson_types_teacher_user_id ON public.teacher_lesson_types(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_lesson_types_lesson_type_id ON public.teacher_lesson_types(lesson_type_id);

-- =============================================================================
-- SECTION 3: ENABLE RLS
-- =============================================================================

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
-- FORCE RLS: Even table owner / service_role is subject to RLS policies.
-- This is a security best practice but means admin scripts must use service_role
-- or bypass RLS explicitly. Many teams omit FORCE for operational flexibility.
ALTER TABLE public.teachers FORCE ROW LEVEL SECURITY;

ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability FORCE ROW LEVEL SECURITY;

ALTER TABLE public.teacher_lesson_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_lesson_types FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 4: HELPER FUNCTIONS
-- =============================================================================

-- Helper function to check if a user is a teacher
-- Uses SECURITY DEFINER to bypass RLS on teachers table
CREATE OR REPLACE FUNCTION public.is_teacher(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teachers
    WHERE user_id = _user_id
  );
$$;

-- Revoke public access, grant only to authenticated users
REVOKE ALL ON FUNCTION public.is_teacher(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_teacher(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_teacher(UUID) TO authenticated;
ALTER FUNCTION public.is_teacher(UUID) OWNER TO postgres;

-- Helper function to get teacher ID for a user
-- Uses SECURITY DEFINER to bypass RLS on teachers table
CREATE OR REPLACE FUNCTION public.get_teacher_user_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT user_id
  FROM public.teachers
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Revoke public access, grant only to authenticated users
REVOKE ALL ON FUNCTION public.get_teacher_user_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_teacher_user_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_user_id(UUID) TO authenticated;
ALTER FUNCTION public.get_teacher_user_id(UUID) OWNER TO postgres;

-- =============================================================================
-- SECTION 5: RLS POLICIES
-- =============================================================================

-- Combined SELECT policy: teachers can view own record, privileged users can view all
CREATE POLICY teachers_select
ON public.teachers FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR public.is_privileged((select auth.uid()))
);

-- Admins and site_admins can insert teachers
CREATE POLICY teachers_insert_admin
ON public.teachers FOR INSERT TO authenticated
WITH CHECK (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())));

-- Combined UPDATE policy: teachers can update own record, admins can update any
CREATE POLICY teachers_update
ON public.teachers FOR UPDATE TO authenticated
USING (
  user_id = (select auth.uid())
  OR public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
)
WITH CHECK (
  user_id = (select auth.uid())
  OR public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
);

-- Admins and site_admins can delete teachers
CREATE POLICY teachers_delete_admin
ON public.teachers FOR DELETE TO authenticated
USING (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())));

-- =============================================================================
-- SECTION 5B: RLS POLICIES FOR teacher_availability
-- =============================================================================

-- Combined SELECT policy: teachers can view own availability, privileged users can view all
CREATE POLICY teacher_availability_select
ON public.teacher_availability FOR SELECT TO authenticated
USING (
  teacher_user_id = public.get_teacher_user_id((select auth.uid()))
  OR public.is_privileged((select auth.uid()))
);

-- Combined INSERT policy: teachers can insert own availability, admins can insert for any
CREATE POLICY teacher_availability_insert
ON public.teacher_availability FOR INSERT TO authenticated
WITH CHECK (
  teacher_user_id = public.get_teacher_user_id((select auth.uid()))
  OR public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
);

-- Combined UPDATE policy: teachers can update own availability, admins can update any
CREATE POLICY teacher_availability_update
ON public.teacher_availability FOR UPDATE TO authenticated
USING (
  teacher_user_id = public.get_teacher_user_id((select auth.uid()))
  OR public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
)
WITH CHECK (
  teacher_user_id = public.get_teacher_user_id((select auth.uid()))
  OR public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
);

-- Combined DELETE policy: teachers can delete own availability, admins can delete any
CREATE POLICY teacher_availability_delete
ON public.teacher_availability FOR DELETE TO authenticated
USING (
  teacher_user_id = public.get_teacher_user_id((select auth.uid()))
  OR public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
);

-- =============================================================================
-- SECTION 5C: RLS POLICIES FOR teacher_lesson_types
-- =============================================================================

-- Combined SELECT policy: teachers can view own lesson types, privileged users can view all
CREATE POLICY teacher_lesson_types_select
ON public.teacher_lesson_types FOR SELECT TO authenticated
USING (
  teacher_user_id = public.get_teacher_user_id((select auth.uid()))
  OR public.is_privileged((select auth.uid()))
);

-- Admins and site_admins can insert lesson type links
CREATE POLICY teacher_lesson_types_insert_admin
ON public.teacher_lesson_types FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
);

-- Admins and site_admins can delete lesson type links
CREATE POLICY teacher_lesson_types_delete_admin
ON public.teacher_lesson_types FOR DELETE TO authenticated
USING (
  public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
);

-- =============================================================================
-- SECTION 6: TRIGGERS
-- =============================================================================

-- Reuse existing update_updated_at_column function from baseline
CREATE TRIGGER update_teachers_updated_at
BEFORE UPDATE ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for teacher_availability updated_at
CREATE TRIGGER update_teacher_availability_updated_at
BEFORE UPDATE ON public.teacher_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- SECTION 7: PERMISSIONS
-- =============================================================================

-- GRANT gives table-level permissions, but RLS policies (above) are what
-- actually control access. GRANT is required for RLS to work, but RLS is the
-- security boundary. Without matching RLS policies, GRANT alone does NOT grant access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_availability TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.teacher_lesson_types TO authenticated;

-- =============================================================================
-- END OF TEACHERS MIGRATION
-- =============================================================================
