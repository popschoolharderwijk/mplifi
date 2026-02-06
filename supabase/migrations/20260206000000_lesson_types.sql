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

CREATE TYPE public.lesson_frequency AS ENUM ('weekly', 'biweekly', 'monthly');

-- =============================================================================
-- SECTION 2: TABLES
-- =============================================================================

-- Lesson types table - defines different types of music lessons
CREATE TABLE public.lesson_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lesson type information
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,

  -- Lesson configuration
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  frequency public.lesson_frequency NOT NULL,
  price_per_lesson NUMERIC(10,2) NOT NULL,
  cost_center TEXT,
  is_group_lesson BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_lesson_types_is_active ON public.lesson_types(is_active);
CREATE INDEX idx_lesson_types_is_group_lesson ON public.lesson_types(is_group_lesson);

-- =============================================================================
-- SECTION 3: ENABLE RLS
-- =============================================================================

ALTER TABLE public.lesson_types ENABLE ROW LEVEL SECURITY;
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
WITH CHECK (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()));

-- Admins and site_admins can update lesson types
CREATE POLICY lesson_types_update_admin
ON public.lesson_types FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()));

-- Admins and site_admins can delete lesson types
CREATE POLICY lesson_types_delete_admin
ON public.lesson_types FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()));

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_types TO authenticated;

-- =============================================================================
-- END OF LESSON TYPES MIGRATION
-- =============================================================================
