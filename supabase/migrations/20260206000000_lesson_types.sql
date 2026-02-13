-- =============================================================================
-- LESSON TYPES TABLE
-- =============================================================================
-- This migration creates:
-- 1. lesson_frequency enum for lesson scheduling frequency
-- 2. lesson_types table for managing different types of music lessons
-- 3. RLS policies for the table
-- 4. Triggers for data integrity
--
-- Lesson types define the characteristics of different music lessons
-- (e.g., Gitaar, Drums, Zang, Bas, Keyboard, Saxofoon, DJ/Beats, Bandcoaching).
-- =============================================================================

-- =============================================================================
-- SECTION 1: TYPES
-- =============================================================================

DROP TYPE IF EXISTS public.lesson_frequency CASCADE;

CREATE TYPE public.lesson_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');

-- =============================================================================
-- SECTION 2: TABLES
-- =============================================================================

-- Lesson types table - defines different types of music lessons
CREATE TABLE IF NOT EXISTS public.lesson_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lesson type information
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT NOT NULL CHECK (length(icon) > 0),
  color TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),

  -- Lesson configuration
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  frequency public.lesson_frequency NOT NULL DEFAULT 'weekly',
  price_per_lesson NUMERIC(10,2) NOT NULL CHECK (price_per_lesson > 0),
  cost_center TEXT,
  is_group_lesson BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lesson_types_is_active ON public.lesson_types(is_active);
CREATE INDEX IF NOT EXISTS idx_lesson_types_is_group_lesson ON public.lesson_types(is_group_lesson);

-- =============================================================================
-- SECTION 3: ENABLE RLS
-- =============================================================================

ALTER TABLE public.lesson_types ENABLE ROW LEVEL SECURITY;
-- FORCE RLS: Even table owner / service_role is subject to RLS policies.
-- This is a security best practice but means admin scripts must use service_role
-- or bypass RLS explicitly. Many teams omit FORCE for operational flexibility.
ALTER TABLE public.lesson_types FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 4: RLS POLICIES
-- =============================================================================

-- All authenticated users can view lesson types (public reference data)
CREATE POLICY lesson_types_select_all
ON public.lesson_types FOR SELECT TO authenticated
USING (true);

-- Admins and site_admins can insert lesson types
CREATE POLICY lesson_types_insert_admin
ON public.lesson_types FOR INSERT TO authenticated
WITH CHECK (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())));

-- Admins and site_admins can update lesson types
CREATE POLICY lesson_types_update_admin
ON public.lesson_types FOR UPDATE TO authenticated
USING (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())))
WITH CHECK (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())));

-- Admins and site_admins can delete lesson types
CREATE POLICY lesson_types_delete_admin
ON public.lesson_types FOR DELETE TO authenticated
USING (public.is_admin((select auth.uid())) OR public.is_site_admin((select auth.uid())));

-- =============================================================================
-- SECTION 5: TRIGGERS
-- =============================================================================

-- Reuse existing update_updated_at_column function from baseline
CREATE TRIGGER update_lesson_types_updated_at
BEFORE UPDATE ON public.lesson_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- SECTION 6: PERMISSIONS
-- =============================================================================

-- GRANT gives table-level permissions, but RLS policies (above) are what
-- actually control access. GRANT is required for RLS to work, but RLS is the
-- security boundary. Without matching RLS policies, GRANT alone does NOT grant access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_types TO authenticated;

-- =============================================================================
-- END OF LESSON TYPES MIGRATION
-- =============================================================================
