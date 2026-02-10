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

  -- Parent/guardian information (for minors)
  parent_name TEXT,
  parent_email TEXT,
  parent_phone_number TEXT CHECK (parent_phone_number IS NULL OR (parent_phone_number ~ '^[0-9]{10}$')),

  -- Debtor information (for billing)
  debtor_info_same_as_student BOOLEAN NOT NULL DEFAULT true,
  debtor_name TEXT,
  debtor_address TEXT,
  debtor_postal_code TEXT,
  debtor_city TEXT,

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
  public.is_privileged((select auth.uid()))
);

-- Note: INSERT policy is intentionally omitted.
-- Students are automatically created via triggers on lesson_agreements.
-- No one can manually insert students.

-- Note: DELETE policy is intentionally omitted.
-- Students are automatically deleted via triggers on lesson_agreements.
-- No one can manually delete students.

-- Admins and site_admins can update students (for future fields)
CREATE POLICY students_update_admin
ON public.students FOR UPDATE TO authenticated
USING (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())))
WITH CHECK (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())));

-- Note: Teachers cannot view students directly. They can view lesson_agreements
-- which contain the student information they need.

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
-- Students can only be deleted by removing all lesson_agreements (trigger will auto-delete student).
GRANT SELECT, UPDATE ON public.students TO authenticated;

-- =============================================================================
-- SECTION 8: ALTER TABLE FOR EXISTING DATABASES
-- =============================================================================
-- These ALTER TABLE statements are safe to run on existing databases
-- They add new columns with default values or nullable constraints

-- Add parent/guardian columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_name') THEN
    ALTER TABLE public.students ADD COLUMN parent_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_email') THEN
    ALTER TABLE public.students ADD COLUMN parent_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_phone_number') THEN
    ALTER TABLE public.students ADD COLUMN parent_phone_number TEXT;
    -- Add check constraint if column was just created
    ALTER TABLE public.students ADD CONSTRAINT students_parent_phone_number_check
      CHECK (parent_phone_number IS NULL OR (parent_phone_number ~ '^[0-9]{10}$'));
  END IF;
END $$;

-- Add debtor columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'debtor_info_same_as_student') THEN
    ALTER TABLE public.students ADD COLUMN debtor_info_same_as_student BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'debtor_name') THEN
    ALTER TABLE public.students ADD COLUMN debtor_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'debtor_address') THEN
    ALTER TABLE public.students ADD COLUMN debtor_address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'debtor_postal_code') THEN
    ALTER TABLE public.students ADD COLUMN debtor_postal_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'debtor_city') THEN
    ALTER TABLE public.students ADD COLUMN debtor_city TEXT;
  END IF;
END $$;

-- =============================================================================
-- END OF STUDENTS MIGRATION
-- =============================================================================
