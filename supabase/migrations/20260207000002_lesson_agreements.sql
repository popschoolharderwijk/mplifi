-- =============================================================================
-- LESSON AGREEMENTS TABLE
-- =============================================================================
-- This migration creates:
-- 1. lesson_agreements table for managing lesson agreements
-- 2. RLS policies for the table
-- 3. Triggers for data integrity
--
-- Lesson agreements define scheduled lessons between students and teachers.
--
-- DESIGN PATTERNS:
--
-- 1. STUDENT_USER_ID PATTERN (No FK to students table):
--    - student_user_id references auth.users(id), NOT students.id
--    - Students are created automatically via triggers when the first lesson_agreement
--      is inserted (see trigger_ensure_student_on_agreement_insert)
--    - Students are deleted automatically when the last lesson_agreement is removed
--      (see trigger_cleanup_student_on_agreement_delete)
--    - This is a deliberate design choice: students are a CONSEQUENCE of agreements,
--      not a prerequisite. A student record only exists if they have at least one
--      lesson agreement.
--    - Benefits: Automatic lifecycle management, no orphaned student records
--    - Trade-off: Implicit relationship (not enforced by FK), but well-documented
--
-- 2. FORCE ROW LEVEL SECURITY:
--    - FORCE RLS is enabled, meaning even table owner/service_role is subject to RLS
--    - This is a security best practice for defense-in-depth
--    - Admin scripts must use service_role key or explicitly bypass RLS
--    - Triggers run as function owner (postgres) with row_security = off, so they
--      can bypass RLS when needed
--    - This pattern ensures RLS is never accidentally bypassed
--
-- 3. TRIGGER OWNERSHIP:
--    - All trigger functions are owned by postgres role
--    - Functions use SECURITY DEFINER with row_security = off
--    - This ensures triggers can perform operations that bypass RLS when needed
--    - Never change function ownership without understanding the security implications
-- =============================================================================

-- =============================================================================
-- SECTION 1: TYPES
-- =============================================================================
-- No custom types needed for this migration

-- =============================================================================
-- SECTION 2: TABLES
-- =============================================================================

-- Lesson agreements table - defines scheduled lessons between students and teachers
CREATE TABLE IF NOT EXISTS public.lesson_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL REFERENCES public.teachers(user_id) ON DELETE CASCADE,
  lesson_type_id UUID NOT NULL REFERENCES public.lesson_types(id),

  -- Snapshot of chosen option at creation time (duration/frequency/price; "a deal is a deal")
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  frequency public.lesson_frequency NOT NULL,
  price_per_lesson NUMERIC(10,2) NOT NULL CHECK (price_per_lesson > 0),

  -- Scheduling
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,

  -- Status and notes
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Data integrity constraints
  CONSTRAINT lesson_agreements_end_date_check CHECK (end_date IS NULL OR end_date >= start_date)
);

-- =============================================================================
-- SECTION 2.1: CONSTRAINT FUNCTIONS
-- =============================================================================

-- Function to check that teacher is not their own student
-- Returns true if the teacher's user_id matches the student_user_id (invalid)
CREATE OR REPLACE FUNCTION public.check_teacher_not_own_student()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  teacher_user_id UUID;
BEGIN
  -- teacher_user_id references teachers(user_id), so it is the teacher's user_id
  teacher_user_id := NEW.teacher_user_id;

  -- Check if teacher is trying to be their own student
  IF teacher_user_id = NEW.student_user_id THEN
    RAISE EXCEPTION 'A teacher cannot be their own student'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Set function ownership and permissions
ALTER FUNCTION public.check_teacher_not_own_student() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_teacher_not_own_student() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_teacher_not_own_student() FROM anon;
GRANT EXECUTE ON FUNCTION public.check_teacher_not_own_student() TO authenticated;

-- Trigger to enforce the constraint on INSERT and UPDATE
CREATE TRIGGER check_teacher_not_own_student_trigger
BEFORE INSERT OR UPDATE ON public.lesson_agreements
FOR EACH ROW
EXECUTE FUNCTION public.check_teacher_not_own_student();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lesson_agreements_student_user_id ON public.lesson_agreements(student_user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_agreements_teacher_user_id ON public.lesson_agreements(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_agreements_lesson_type_id ON public.lesson_agreements(lesson_type_id);
CREATE INDEX IF NOT EXISTS idx_lesson_agreements_is_active ON public.lesson_agreements(is_active);

-- Table and column documentation
COMMENT ON TABLE public.lesson_agreements IS 'Lesson agreements define scheduled recurring lessons between students and teachers. This table acts as the planning/contract layer for lessons.';

COMMENT ON COLUMN public.lesson_agreements.id IS 'Primary key, UUID generated automatically';
COMMENT ON COLUMN public.lesson_agreements.student_user_id IS 'Reference to auth.users(id). Note: No FK to students table - students are created automatically via triggers when the first lesson_agreement is inserted. This is a deliberate design choice where students are a consequence of agreements, not a prerequisite.';
COMMENT ON COLUMN public.lesson_agreements.teacher_user_id IS 'Reference to teachers table. CASCADE delete: if teacher is deleted, all their lesson agreements are deleted.';
COMMENT ON COLUMN public.lesson_agreements.lesson_type_id IS 'Reference to lesson_types table (e.g., Guitar, Piano, etc.)';
COMMENT ON COLUMN public.lesson_agreements.duration_minutes IS 'Snapshot: lesson duration in minutes at agreement creation (from chosen lesson_type_option).';
COMMENT ON COLUMN public.lesson_agreements.frequency IS 'Snapshot: lesson frequency at agreement creation (from chosen lesson_type_option).';
COMMENT ON COLUMN public.lesson_agreements.price_per_lesson IS 'Snapshot: price per lesson at agreement creation (from chosen lesson_type_option).';
COMMENT ON COLUMN public.lesson_agreements.day_of_week IS 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday) when the lesson occurs';
COMMENT ON COLUMN public.lesson_agreements.start_time IS 'Time when the lesson starts (TIME format, e.g., 14:00). Note: No end_time or duration field currently - may be added later for conflict prevention.';
COMMENT ON COLUMN public.lesson_agreements.start_date IS 'Date when this lesson agreement becomes active';
COMMENT ON COLUMN public.lesson_agreements.end_date IS 'Optional date when this lesson agreement ends. NULL means the agreement has no end date. Must be >= start_date if provided.';
COMMENT ON COLUMN public.lesson_agreements.is_active IS 'Whether this lesson agreement is currently active. Used for soft-delete or temporary deactivation.';
COMMENT ON COLUMN public.lesson_agreements.notes IS 'Optional notes about this lesson agreement (e.g., special instructions, room number, etc.)';
COMMENT ON COLUMN public.lesson_agreements.created_at IS 'Timestamp when this record was created';
COMMENT ON COLUMN public.lesson_agreements.updated_at IS 'Timestamp when this record was last updated (automatically maintained by trigger)';

-- =============================================================================
-- SECTION 3: ENABLE RLS
-- =============================================================================

ALTER TABLE public.lesson_agreements ENABLE ROW LEVEL SECURITY;

-- FORCE ROW LEVEL SECURITY:
-- Even table owner / service_role is subject to RLS policies.
-- This is a security best practice for defense-in-depth, ensuring RLS is never
-- accidentally bypassed, even by privileged roles.
--
-- IMPLICATIONS:
-- - Admin scripts must use service_role key or explicitly bypass RLS
-- - Triggers use SECURITY DEFINER with row_security = off to bypass RLS when needed
-- - Function ownership (postgres) must be preserved for triggers to work correctly
-- - Many teams omit FORCE for operational flexibility, but we choose security
--
-- TRIGGER SECURITY:
-- All trigger functions are owned by postgres and use SECURITY DEFINER with
-- row_security = off. This allows triggers to perform operations that bypass RLS
-- when necessary (e.g., creating/deleting students). Never change function ownership
-- without understanding the security implications.
ALTER TABLE public.lesson_agreements FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 4: RLS POLICIES
-- =============================================================================

-- Combined SELECT policy for students, teachers, and privileged users
-- Uses OR to allow any of the three user types to view lesson agreements:
-- - Students can view their own lesson agreements
-- - Teachers can view lesson agreements where they are the teacher
-- - Staff, admins and site_admins can view all lesson agreements
CREATE POLICY lesson_agreements_select
ON public.lesson_agreements FOR SELECT TO authenticated
USING (
  student_user_id = (select auth.uid())
  OR teacher_user_id = public.get_teacher_user_id((select auth.uid()))
  OR public.is_privileged((select auth.uid()))
);

-- Staff, admins and site_admins can insert lesson agreements
CREATE POLICY lesson_agreements_insert_staff
ON public.lesson_agreements FOR INSERT TO authenticated
WITH CHECK (
  public.is_privileged((select auth.uid()))
);

-- Staff, admins and site_admins can update lesson agreements
-- Note: Students and teachers are automatically blocked because they don't match this policy
CREATE POLICY lesson_agreements_update_staff
ON public.lesson_agreements FOR UPDATE TO authenticated
USING (
  public.is_privileged((select auth.uid()))
)
WITH CHECK (
  public.is_privileged((select auth.uid()))
);

-- Staff, admins and site_admins can delete lesson agreements
-- Note: Students and teachers are automatically blocked because they don't match this policy
CREATE POLICY lesson_agreements_delete_staff
ON public.lesson_agreements FOR DELETE TO authenticated
USING (
  public.is_privileged((select auth.uid()))
);

-- =============================================================================
-- SECTION 4.5: RESTRICT DELETE ON teacher_lesson_types
-- =============================================================================
-- teacher_lesson_types can only be deleted if no agreements exist for that teacher+lesson_type
-- This function and trigger are defined here because lesson_agreements table must exist first

-- Function to check if teacher_lesson_type has agreements before deletion
CREATE OR REPLACE FUNCTION public.check_teacher_lesson_type_has_no_agreements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Check if any lesson_agreements exist for this teacher and lesson_type combination
  IF EXISTS (
    SELECT 1
    FROM public.lesson_agreements
    WHERE teacher_user_id = OLD.teacher_user_id
      AND lesson_type_id = OLD.lesson_type_id
  ) THEN
    RAISE EXCEPTION 'Cannot remove lesson type from teacher: there are existing lesson agreements using this teacher and lesson type combination'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

ALTER FUNCTION public.check_teacher_lesson_type_has_no_agreements() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_teacher_lesson_type_has_no_agreements() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_teacher_lesson_type_has_no_agreements() FROM anon;
GRANT EXECUTE ON FUNCTION public.check_teacher_lesson_type_has_no_agreements() TO authenticated;

-- Trigger to enforce the constraint on DELETE
CREATE TRIGGER check_teacher_lesson_type_has_no_agreements_trigger
BEFORE DELETE ON public.teacher_lesson_types
FOR EACH ROW
EXECUTE FUNCTION public.check_teacher_lesson_type_has_no_agreements();

-- =============================================================================
-- SECTION 4.5: EXTEND STUDENTS SELECT POLICY
-- =============================================================================
-- Drop and recreate students_select to include teacher access to their students.
-- Teachers can view student records for students they have a lesson_agreement with.

DROP POLICY IF EXISTS students_select ON public.students;

CREATE POLICY students_select
ON public.students FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR public.is_privileged((select auth.uid()))
  -- Teachers can view their own students
  OR EXISTS (
    SELECT 1 FROM public.lesson_agreements la
    WHERE la.student_user_id = students.user_id
      AND la.teacher_user_id = public.get_teacher_user_id((select auth.uid()))
  )
);

-- =============================================================================
-- SECTION 4.6: EXTEND TEACHERS SELECT POLICY
-- =============================================================================
-- Drop and recreate teachers_select to include student access to their teachers.
-- Students can view teacher records for teachers they have a lesson_agreement with.

DROP POLICY IF EXISTS teachers_select ON public.teachers;

CREATE POLICY teachers_select
ON public.teachers FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR public.is_privileged((select auth.uid()))
  -- Students can view their own teachers
  OR EXISTS (
    SELECT 1 FROM public.lesson_agreements la
    WHERE la.teacher_user_id = teachers.user_id
      AND la.student_user_id = (select auth.uid())
  )
);

-- =============================================================================
-- SECTION 4.7: EXTEND PROFILES SELECT POLICY
-- =============================================================================
-- Drop and recreate profiles_select to include cross-viewing for lesson agreements.
-- Students: can view profiles of teachers they have a lesson_agreement with.
-- Teachers: can view profiles of students they have a lesson_agreement with.

DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select
ON public.profiles FOR SELECT TO authenticated
USING (
  (select auth.uid()) = user_id
  OR public.is_privileged((select auth.uid()))
  -- Students can view their teachers' profiles
  OR EXISTS (
    SELECT 1 FROM public.teachers t
    INNER JOIN public.lesson_agreements la ON la.teacher_user_id = t.user_id
    WHERE t.user_id = profiles.user_id
      AND la.student_user_id = (select auth.uid())
  )
  -- Teachers can view their students' profiles
  OR EXISTS (
    SELECT 1 FROM public.lesson_agreements la
    WHERE la.student_user_id = profiles.user_id
      AND la.teacher_user_id = public.get_teacher_user_id((select auth.uid()))
  )
);

-- =============================================================================
-- SECTION 5: HELPER FUNCTIONS FOR AUTOMATIC STUDENT MANAGEMENT
-- =============================================================================

-- Function to ensure a student exists for a given user_id
-- Creates the student if it doesn't exist
CREATE OR REPLACE FUNCTION public.ensure_student_exists(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Allow when no session (e.g. trigger during seed) or caller is self or privileged
  IF auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM _user_id
     AND NOT public.is_privileged(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  INSERT INTO public.students (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Revoke public access, grant only to authenticated users
REVOKE ALL ON FUNCTION public.ensure_student_exists(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_student_exists(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_student_exists(UUID) TO authenticated;
ALTER FUNCTION public.ensure_student_exists(UUID) OWNER TO postgres;

-- Trigger function to ensure student exists before inserting lesson agreement
CREATE OR REPLACE FUNCTION public.trigger_ensure_student_on_agreement_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  PERFORM public.ensure_student_exists(NEW.student_user_id);
  RETURN NEW;
END;
$$;

-- Revoke public access
REVOKE ALL ON FUNCTION public.trigger_ensure_student_on_agreement_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_ensure_student_on_agreement_insert() FROM anon;
GRANT EXECUTE ON FUNCTION public.trigger_ensure_student_on_agreement_insert() TO authenticated;
ALTER FUNCTION public.trigger_ensure_student_on_agreement_insert() OWNER TO postgres;

-- Function to cleanup student if no agreements remain
-- Deletes the student if there are no more lesson agreements and no other dependencies
--
-- DESIGN DECISION: This function performs a hard DELETE. Consider the following:
-- - If soft-delete is desired in the future, change DELETE to UPDATE is_active = false
-- - Before deleting, check for other relationships (payments, attendance, progress, etc.)
-- - Currently only checks lesson_agreements; extend this function when new tables reference students
--
-- RISK: Deleting a student may cascade to other tables if foreign keys are set up.
-- Ensure all relevant tables are checked before deletion, or use soft-delete pattern.
CREATE OR REPLACE FUNCTION public.cleanup_student_if_no_agreements(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Allow when no session (e.g. trigger during seed) or caller is self or privileged
  IF auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM _user_id
     AND NOT public.is_privileged(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Check if there are any lesson agreements remaining
  IF EXISTS (
    SELECT 1
    FROM public.lesson_agreements
    WHERE student_user_id = _user_id
  ) THEN
    -- Student still has agreements, do not delete
    RETURN;
  END IF;

  -- TODO: Add checks for other relationships before deleting:
  -- - payments (if exists)
  -- - attendance records (if exists)
  -- - progress/grade records (if exists)
  -- - any other tables that reference students
  --
  -- Example:
  -- IF EXISTS (SELECT 1 FROM public.payments WHERE student_user_id = _user_id) THEN
  --   RETURN;
  -- END IF;

  -- No agreements and no other dependencies found, safe to delete
  DELETE FROM public.students
  WHERE user_id = _user_id;
END;
$$;

-- Revoke public access, grant only to authenticated users
REVOKE ALL ON FUNCTION public.cleanup_student_if_no_agreements(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_student_if_no_agreements(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_student_if_no_agreements(UUID) TO authenticated;
ALTER FUNCTION public.cleanup_student_if_no_agreements(UUID) OWNER TO postgres;

-- Helper function to get student status (active/inactive) based on lesson agreements
-- SECURITY INVOKER: RLS on lesson_agreements restricts visible rows (student=own, teacher=own, staff=all).
CREATE OR REPLACE FUNCTION public.get_student_status(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.lesson_agreements
      WHERE student_user_id = _user_id
        AND is_active = true
    ) THEN 'active'
    ELSE 'inactive'
  END;
$$;

-- Revoke public access, grant only to authenticated users
REVOKE ALL ON FUNCTION public.get_student_status(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_status(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_status(UUID) TO authenticated;
ALTER FUNCTION public.get_student_status(UUID) OWNER TO postgres;

-- Trigger function to cleanup student after deleting lesson agreement
CREATE OR REPLACE FUNCTION public.trigger_cleanup_student_on_agreement_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  PERFORM public.cleanup_student_if_no_agreements(OLD.student_user_id);
  RETURN OLD;
END;
$$;

-- Revoke public access
REVOKE ALL ON FUNCTION public.trigger_cleanup_student_on_agreement_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_cleanup_student_on_agreement_delete() FROM anon;
GRANT EXECUTE ON FUNCTION public.trigger_cleanup_student_on_agreement_delete() TO authenticated;
ALTER FUNCTION public.trigger_cleanup_student_on_agreement_delete() OWNER TO postgres;

-- =============================================================================
-- SECTION 6: TRIGGERS
-- =============================================================================

-- Reuse existing update_updated_at_column function from baseline
CREATE TRIGGER update_lesson_agreements_updated_at
BEFORE UPDATE ON public.lesson_agreements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to automatically create student when lesson agreement is inserted
CREATE TRIGGER ensure_student_on_agreement_insert
BEFORE INSERT ON public.lesson_agreements
FOR EACH ROW
EXECUTE FUNCTION public.trigger_ensure_student_on_agreement_insert();

-- Trigger to automatically cleanup student when lesson agreement is deleted
CREATE TRIGGER cleanup_student_on_agreement_delete
AFTER DELETE ON public.lesson_agreements
FOR EACH ROW
EXECUTE FUNCTION public.trigger_cleanup_student_on_agreement_delete();

-- =============================================================================
-- SECTION 7: PERMISSIONS
-- =============================================================================

-- GRANT gives table-level permissions, but RLS policies (above) are what
-- actually control access. GRANT is required for RLS to work, but RLS is the
-- security boundary. Without matching RLS policies, GRANT alone does NOT grant access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_agreements TO authenticated;

-- =============================================================================
-- END OF LESSON AGREEMENTS MIGRATION
-- =============================================================================
