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

-- Teachers table - links users to teacher records
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference
  -- Note: References both auth.users and profiles to ensure data integrity
  -- Every user has a profile (created via handle_new_user trigger)
  -- Teachers can only exist if a profile exists
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Teacher profile information
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key to profiles (ensures teacher always has a profile)
-- This enables Supabase PostgREST automatic joins via profiles!teachers_user_id_fkey
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
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON public.teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_is_active ON public.teachers(is_active);

-- Teacher availability table - defines when teachers are available
CREATE TABLE IF NOT EXISTS public.teacher_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Teacher reference
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,

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
CREATE INDEX IF NOT EXISTS idx_teacher_availability_teacher_id ON public.teacher_availability(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_availability_day_of_week ON public.teacher_availability(day_of_week);

-- Teacher lesson types junction table - links teachers to lesson types they can teach
CREATE TABLE IF NOT EXISTS public.teacher_lesson_types (
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  lesson_type_id UUID NOT NULL REFERENCES public.lesson_types(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (teacher_id, lesson_type_id)
);

-- Indexes for teacher_lesson_types
CREATE INDEX IF NOT EXISTS idx_teacher_lesson_types_teacher_id ON public.teacher_lesson_types(teacher_id);
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
CREATE OR REPLACE FUNCTION public.get_teacher_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT id
  FROM public.teachers
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Revoke public access, grant only to authenticated users
REVOKE ALL ON FUNCTION public.get_teacher_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_teacher_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_id(UUID) TO authenticated;
ALTER FUNCTION public.get_teacher_id(UUID) OWNER TO postgres;

-- =============================================================================
-- SECTION 5: RLS POLICIES
-- =============================================================================

-- Teachers can view their own record
CREATE POLICY teachers_select_own
ON public.teachers FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Staff, admins and site_admins can view all teachers
CREATE POLICY teachers_select_staff
ON public.teachers FOR SELECT TO authenticated
USING (
  public.is_privileged((select auth.uid()))
);

-- Admins and site_admins can insert teachers
CREATE POLICY teachers_insert_admin
ON public.teachers FOR INSERT TO authenticated
WITH CHECK (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())));

-- Teachers can update their own record (especially for bio)
CREATE POLICY teachers_update_own
ON public.teachers FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- Admins and site_admins can update teachers
CREATE POLICY teachers_update_admin
ON public.teachers FOR UPDATE TO authenticated
USING (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())))
WITH CHECK (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())));

-- Admins and site_admins can delete teachers
CREATE POLICY teachers_delete_admin
ON public.teachers FOR DELETE TO authenticated
USING (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())));

-- =============================================================================
-- SECTION 5B: RLS POLICIES FOR teacher_availability
-- =============================================================================

-- Teachers can view their own availability
CREATE POLICY teacher_availability_select_own
ON public.teacher_availability FOR SELECT TO authenticated
USING (
  teacher_id = public.get_teacher_id((select auth.uid()))
);

-- Staff, admins and site_admins can view all availability
CREATE POLICY teacher_availability_select_staff
ON public.teacher_availability FOR SELECT TO authenticated
USING (
  public.is_privileged((select auth.uid()))
);

-- Teachers can insert their own availability
CREATE POLICY teacher_availability_insert_own
ON public.teacher_availability FOR INSERT TO authenticated
WITH CHECK (
  teacher_id = public.get_teacher_id((select auth.uid()))
);

-- Admins and site_admins can insert availability for any teacher
CREATE POLICY teacher_availability_insert_admin
ON public.teacher_availability FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
);

-- Teachers can update their own availability
CREATE POLICY teacher_availability_update_own
ON public.teacher_availability FOR UPDATE TO authenticated
USING (
  teacher_id = public.get_teacher_id((select auth.uid()))
)
WITH CHECK (
  teacher_id = public.get_teacher_id((select auth.uid()))
);

-- Admins and site_admins can update availability for any teacher
CREATE POLICY teacher_availability_update_admin
ON public.teacher_availability FOR UPDATE TO authenticated
USING (
  public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
)
WITH CHECK (
  public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
);

-- Teachers can delete their own availability
CREATE POLICY teacher_availability_delete_own
ON public.teacher_availability FOR DELETE TO authenticated
USING (
  teacher_id = public.get_teacher_id((select auth.uid()))
);

-- Admins and site_admins can delete availability for any teacher
CREATE POLICY teacher_availability_delete_admin
ON public.teacher_availability FOR DELETE TO authenticated
USING (
  public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid()))
);

-- =============================================================================
-- SECTION 5C: RLS POLICIES FOR teacher_lesson_types
-- =============================================================================

-- Teachers can view their own lesson types
CREATE POLICY teacher_lesson_types_select_own
ON public.teacher_lesson_types FOR SELECT TO authenticated
USING (
  teacher_id = public.get_teacher_id((select auth.uid()))
);

-- Staff, admins and site_admins can view all lesson type links
CREATE POLICY teacher_lesson_types_select_staff
ON public.teacher_lesson_types FOR SELECT TO authenticated
USING (
  public.is_privileged((select auth.uid()))
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
