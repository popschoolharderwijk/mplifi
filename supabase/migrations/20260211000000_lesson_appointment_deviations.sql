-- =============================================================================
-- LESSON APPOINTMENT DEVIATIONS TABLE
-- =============================================================================
-- This migration creates:
-- 1. lesson_appointment_deviations table for managing temporary changes to lesson agreements
-- 2. RLS policies for the table
-- 3. Triggers for data integrity
-- 4. Auto-delete logic for no-op deviations
-- 5. Support for cancelling individual lesson occurrences
--
-- Lesson appointment deviations allow teachers/admins to temporarily change
-- lesson dates/times from the regular schedule defined in lesson_agreements.
-- For example: a lesson normally on Monday 13:00 can be moved to Thursday 14:00
-- for a specific week, or cancelled entirely.
-- =============================================================================

-- =============================================================================
-- SECTION 1: TYPES
-- =============================================================================
-- No custom types needed for this migration

-- =============================================================================
-- SECTION 2: TABLES
-- =============================================================================

-- Lesson appointment deviations table - tracks temporary changes to lesson schedules
CREATE TABLE IF NOT EXISTS public.lesson_appointment_deviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the lesson agreement
  lesson_agreement_id UUID NOT NULL REFERENCES public.lesson_agreements(id) ON DELETE CASCADE,

  -- Original schedule (what the lesson normally would be)
  original_date DATE NOT NULL, -- The date when the lesson normally would be according to the lesson agreement
  original_start_time TIME NOT NULL, -- The original start time according to the lesson agreement (for consistency and clarity)

  -- Actual schedule (what the lesson actually is)
  actual_date DATE NOT NULL, -- The actual date when the lesson takes place
  actual_start_time TIME NOT NULL, -- The actual start time (actual_date contains only date, no time)

  -- Cancellation flag
  is_cancelled BOOLEAN NOT NULL DEFAULT false, -- When true, the lesson for this specific date is cancelled/deleted

  -- Recurring: when true, this deviation applies to all occurrences from original_date onward (same weekday/time as actual_date and actual_start_time, or cancelled)
  recurring BOOLEAN NOT NULL DEFAULT false,

  -- Optional reason for the deviation
  reason TEXT,

  -- Audit trail
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id), -- Who created this deviation
  last_updated_by_user_id UUID NOT NULL REFERENCES auth.users(id), -- Who last updated this deviation

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Data integrity constraints
  CONSTRAINT deviation_date_check CHECK (actual_date >= original_date - INTERVAL '7 days' AND actual_date <= original_date + INTERVAL '7 days'),
  -- Deviation must either be cancelled, or actually deviate from the original schedule
  CONSTRAINT deviation_must_actually_deviate_or_be_cancelled CHECK (
    is_cancelled = true
    OR actual_date IS DISTINCT FROM original_date
    OR actual_start_time IS DISTINCT FROM original_start_time
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lesson_appointment_deviations_lesson_agreement_id ON public.lesson_appointment_deviations(lesson_agreement_id);
CREATE INDEX IF NOT EXISTS idx_lesson_appointment_deviations_original_date ON public.lesson_appointment_deviations(original_date);
CREATE INDEX IF NOT EXISTS idx_lesson_appointment_deviations_actual_date ON public.lesson_appointment_deviations(actual_date);
CREATE INDEX IF NOT EXISTS idx_lesson_appointment_deviations_created_by_user_id ON public.lesson_appointment_deviations(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_appointment_deviations_last_updated_by_user_id ON public.lesson_appointment_deviations(last_updated_by_user_id);

-- Unique constraint: only one deviation per lesson_agreement + original_date combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_appointment_deviations_unique ON public.lesson_appointment_deviations(lesson_agreement_id, original_date);

-- Partial index for efficient filtering of cancelled lessons
CREATE INDEX IF NOT EXISTS idx_lesson_appointment_deviations_is_cancelled
ON public.lesson_appointment_deviations(is_cancelled)
WHERE is_cancelled = true;

-- Table and column documentation
COMMENT ON TABLE public.lesson_appointment_deviations IS 'Tracks temporary changes to lesson schedules. Allows teachers/admins to move lessons from their regular schedule (defined in lesson_agreements) to different dates/times for specific weeks, or cancel them entirely.';

COMMENT ON COLUMN public.lesson_appointment_deviations.id IS 'Primary key, UUID generated automatically';
COMMENT ON COLUMN public.lesson_appointment_deviations.lesson_agreement_id IS 'Reference to lesson_agreements table. CASCADE delete: if lesson agreement is deleted, all its deviations are deleted.';
COMMENT ON COLUMN public.lesson_appointment_deviations.original_date IS 'The date when the lesson normally would be according to the lesson agreement for this specific week';
COMMENT ON COLUMN public.lesson_appointment_deviations.original_start_time IS 'The original start time according to the lesson agreement. Stored for consistency and clarity, even though it also exists in lesson_agreements.start_time.';
COMMENT ON COLUMN public.lesson_appointment_deviations.actual_date IS 'The actual date when the lesson takes place';
COMMENT ON COLUMN public.lesson_appointment_deviations.actual_start_time IS 'The actual start time (actual_date contains only date, no time)';
COMMENT ON COLUMN public.lesson_appointment_deviations.is_cancelled IS 'When true, the lesson for this specific date is cancelled/deleted. The actual_date/actual_start_time fields will equal the original values in this case.';
COMMENT ON COLUMN public.lesson_appointment_deviations.recurring IS 'When true, this deviation applies to all occurrences from original_date onward (same weekday/time as actual_date and actual_start_time, or cancelled).';
COMMENT ON COLUMN public.lesson_appointment_deviations.reason IS 'Optional reason for the deviation (e.g., "Teacher unavailable", "Student request")';
COMMENT ON COLUMN public.lesson_appointment_deviations.created_by_user_id IS 'Who created this deviation (for audit trail and accountability)';
COMMENT ON COLUMN public.lesson_appointment_deviations.last_updated_by_user_id IS 'Who last updated this deviation (updated on every UPDATE)';
COMMENT ON COLUMN public.lesson_appointment_deviations.created_at IS 'Timestamp when this record was created';
COMMENT ON COLUMN public.lesson_appointment_deviations.updated_at IS 'Timestamp when this record was last updated (automatically maintained by trigger)';

COMMENT ON CONSTRAINT deviation_must_actually_deviate_or_be_cancelled ON public.lesson_appointment_deviations
IS 'Prevents creating deviations that do not actually deviate from the original schedule, unless the lesson is cancelled. If is_cancelled is false and actual_date = original_date AND actual_start_time = original_start_time, the deviation is useless and should not exist.';

-- =============================================================================
-- SECTION 3: ENABLE RLS
-- =============================================================================

ALTER TABLE public.lesson_appointment_deviations ENABLE ROW LEVEL SECURITY;

-- FORCE ROW LEVEL SECURITY:
-- Even table owner / service_role is subject to RLS policies.
-- This is a security best practice for defense-in-depth, ensuring RLS is never
-- accidentally bypassed, even by privileged roles.
ALTER TABLE public.lesson_appointment_deviations FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 4: RLS POLICIES
-- =============================================================================

-- Teachers can view deviations for their own lessons
CREATE POLICY lesson_appointment_deviations_select_teacher
ON public.lesson_appointment_deviations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lesson_agreements la
    WHERE la.id = lesson_appointment_deviations.lesson_agreement_id
      AND la.teacher_id = public.get_teacher_id((select auth.uid()))
  )
);

-- Students can view deviations for their own lessons
CREATE POLICY lesson_appointment_deviations_select_student
ON public.lesson_appointment_deviations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lesson_agreements la
    WHERE la.id = lesson_appointment_deviations.lesson_agreement_id
      AND la.student_user_id = (select auth.uid())
  )
);

-- Staff, admins and site_admins can view all deviations
CREATE POLICY lesson_appointment_deviations_select_staff
ON public.lesson_appointment_deviations FOR SELECT TO authenticated
USING (
  public.is_privileged((select auth.uid()))
);

-- Teachers can insert deviations for their own lessons
CREATE POLICY lesson_appointment_deviations_insert_teacher
ON public.lesson_appointment_deviations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.lesson_agreements la
    WHERE la.id = lesson_appointment_deviations.lesson_agreement_id
      AND la.teacher_id = public.get_teacher_id((select auth.uid()))
  )
  AND created_by_user_id = (select auth.uid())
  AND last_updated_by_user_id = (select auth.uid())
);

-- Staff, admins and site_admins can insert deviations for any lesson
CREATE POLICY lesson_appointment_deviations_insert_staff
ON public.lesson_appointment_deviations FOR INSERT TO authenticated
WITH CHECK (
  public.is_privileged((select auth.uid()))
  AND created_by_user_id = (select auth.uid())
  AND last_updated_by_user_id = (select auth.uid())
);

-- Teachers can update deviations for their own lessons
-- Note: We use a simple USING clause for authorization. The WITH CHECK ensures
-- the teacher owns the lesson and is updating the last_updated_by_user_id correctly.
-- Immutability of original_date, original_start_time, created_by_user_id is enforced via trigger.
CREATE POLICY lesson_appointment_deviations_update_teacher
ON public.lesson_appointment_deviations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lesson_agreements la
    WHERE la.id = lesson_appointment_deviations.lesson_agreement_id
      AND la.teacher_id = public.get_teacher_id((select auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.lesson_agreements la
    WHERE la.id = lesson_appointment_deviations.lesson_agreement_id
      AND la.teacher_id = public.get_teacher_id((select auth.uid()))
  )
  AND last_updated_by_user_id = (select auth.uid())
);

-- Staff, admins and site_admins can update deviations for any lesson
-- Immutability of original_date, original_start_time, created_by_user_id is enforced via trigger.
CREATE POLICY lesson_appointment_deviations_update_staff
ON public.lesson_appointment_deviations FOR UPDATE TO authenticated
USING (
  public.is_privileged((select auth.uid()))
)
WITH CHECK (
  public.is_privileged((select auth.uid()))
  AND last_updated_by_user_id = (select auth.uid())
);

-- Teachers can delete deviations for their own lessons
CREATE POLICY lesson_appointment_deviations_delete_teacher
ON public.lesson_appointment_deviations FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lesson_agreements la
    WHERE la.id = lesson_appointment_deviations.lesson_agreement_id
      AND la.teacher_id = public.get_teacher_id((select auth.uid()))
  )
);

-- Staff, admins and site_admins can delete deviations for any lesson
CREATE POLICY lesson_appointment_deviations_delete_staff
ON public.lesson_appointment_deviations FOR DELETE TO authenticated
USING (
  public.is_privileged((select auth.uid()))
);

-- =============================================================================
-- SECTION 5: TRIGGERS
-- =============================================================================

-- Reuse existing update_updated_at_column function from baseline
CREATE TRIGGER update_lesson_appointment_deviations_updated_at
BEFORE UPDATE ON public.lesson_appointment_deviations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger function to enforce immutability of certain fields on UPDATE
-- This prevents changing original_date, original_start_time, lesson_agreement_id, and created_by_user_id
CREATE OR REPLACE FUNCTION public.enforce_deviation_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prevent changing immutable fields
  IF NEW.original_date IS DISTINCT FROM OLD.original_date THEN
    RAISE EXCEPTION 'Cannot change original_date after creation';
  END IF;

  IF NEW.original_start_time IS DISTINCT FROM OLD.original_start_time THEN
    RAISE EXCEPTION 'Cannot change original_start_time after creation';
  END IF;

  IF NEW.lesson_agreement_id IS DISTINCT FROM OLD.lesson_agreement_id THEN
    RAISE EXCEPTION 'Cannot change lesson_agreement_id after creation';
  END IF;

  IF NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
    RAISE EXCEPTION 'Cannot change created_by_user_id after creation';
  END IF;

  RETURN NEW;
END;
$$;

-- Set function owner to postgres for SECURITY DEFINER
ALTER FUNCTION public.enforce_deviation_immutable_fields() OWNER TO postgres;

-- Create trigger to enforce immutable fields
CREATE TRIGGER enforce_deviation_immutable_fields_trigger
BEFORE UPDATE ON public.lesson_appointment_deviations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_deviation_immutable_fields();

-- Trigger function to auto-delete deviations that become no-ops after UPDATE
-- This provides better UX: when a user drags an event back to its original
-- position, the deviation is automatically cleaned up instead of blocking.
-- Note: cancelled deviations are NOT auto-deleted, even if they match original schedule.
CREATE OR REPLACE FUNCTION public.auto_delete_noop_deviation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If actual matches original AND not cancelled, delete this deviation instead of updating
  IF NEW.actual_date = NEW.original_date
     AND NEW.actual_start_time = NEW.original_start_time
     AND NEW.is_cancelled = false THEN
    DELETE FROM public.lesson_appointment_deviations WHERE id = NEW.id;
    -- Return NULL to skip the UPDATE (row is already deleted)
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Set function owner to postgres for SECURITY DEFINER
ALTER FUNCTION public.auto_delete_noop_deviation() OWNER TO postgres;

-- Create trigger to auto-delete no-op deviations on UPDATE
-- Runs BEFORE UPDATE so we can return NULL to skip the update
CREATE TRIGGER auto_delete_noop_deviation_trigger
BEFORE UPDATE ON public.lesson_appointment_deviations
FOR EACH ROW
EXECUTE FUNCTION public.auto_delete_noop_deviation();

-- =============================================================================
-- SECTION 6: PERMISSIONS
-- =============================================================================

-- GRANT gives table-level permissions, but RLS policies (above) are what
-- actually control access. GRANT is required for RLS to work, but RLS is the
-- security boundary. Without matching RLS policies, GRANT alone does NOT grant access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_appointment_deviations TO authenticated;

-- =============================================================================
-- END OF LESSON APPOINTMENT DEVIATIONS MIGRATION
-- =============================================================================
