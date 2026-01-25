-- =============================================================================
-- COMPLETE DATABASE SETUP WITH SECURITY FIXES
-- =============================================================================
-- This file combines the initial database setup with all security hardening
-- fixes. Use this as a single source of truth for the database schema.
--
-- Role model: One user = One role (enforced by PRIMARY KEY on user_id)
-- =============================================================================

-- =============================================================================
-- SECTION 1: TYPES
-- =============================================================================

DROP TYPE IF EXISTS public.app_role CASCADE;

CREATE TYPE public.app_role AS ENUM (
  'site_admin',
  'admin',
  'staff',
  'teacher',
  'student'
);

-- =============================================================================
-- SECTION 2: TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT CHECK (phone_number IS NULL OR (phone_number ~ '^[0-9]{10}$')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_students (
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, student_id)
);

-- Indexes for foreign key lookups (performance optimization)
CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher_id
  ON public.teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student_id
  ON public.teacher_students(student_id);

-- =============================================================================
-- SECTION 3: ENABLE RLS
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_students FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 4: ROLE HELPER FUNCTIONS (HARDENED)
-- =============================================================================
-- All functions use SECURITY DEFINER, STABLE, and fixed search_path
-- to prevent search_path injection attacks.

-- Internal helper function - do not call directly
-- Use is_site_admin(), is_admin(), etc. instead
CREATE OR REPLACE FUNCTION public._has_role(
  _user_id UUID,
  _role app_role
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_site_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public._has_role(_user_id, 'site_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public._has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public._has_role(_user_id, 'staff');
$$;

CREATE OR REPLACE FUNCTION public.is_teacher(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public._has_role(_user_id, 'teacher');
$$;

CREATE OR REPLACE FUNCTION public.is_student(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public._has_role(_user_id, 'student');
$$;

-- Revoke public access, grant only to authenticated users
REVOKE ALL ON FUNCTION
  public._has_role(UUID, app_role),
  public.is_site_admin(UUID),
  public.is_admin(UUID),
  public.is_staff(UUID),
  public.is_teacher(UUID),
  public.is_student(UUID)
FROM PUBLIC;

-- Explicitly revoke from anon (Supabase's anon role doesn't inherit from PUBLIC revokes)
REVOKE ALL ON FUNCTION
  public._has_role(UUID, app_role),
  public.is_site_admin(UUID),
  public.is_admin(UUID),
  public.is_staff(UUID),
  public.is_teacher(UUID),
  public.is_student(UUID)
FROM anon;

-- _has_role is an internal helper - no direct grant needed
-- Public role helper functions are granted to authenticated users
GRANT EXECUTE ON FUNCTION public.is_site_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student(UUID) TO authenticated;

ALTER FUNCTION public.is_site_admin(UUID) OWNER TO postgres;
ALTER FUNCTION public.is_admin(UUID) OWNER TO postgres;
ALTER FUNCTION public.is_staff(UUID) OWNER TO postgres;
ALTER FUNCTION public.is_teacher(UUID) OWNER TO postgres;
ALTER FUNCTION public.is_student(UUID) OWNER TO postgres;

-- =============================================================================
-- SECTION 5: RLS POLICIES - PROFILES
-- =============================================================================

-- Users can view their own profile
CREATE POLICY profiles_select_own
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Admins and site_admins can view all profiles
CREATE POLICY profiles_select_admin
ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()));

-- Staff can view all profiles
CREATE POLICY profiles_select_staff
ON public.profiles FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

-- Teachers can view profiles of their linked students only
CREATE POLICY profiles_select_teacher_students
ON public.profiles FOR SELECT TO authenticated
USING (
  public.is_teacher(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.teacher_students ts
    WHERE ts.teacher_id = auth.uid()
      AND ts.student_id = profiles.user_id
  )
);

-- Users can update their own profile
CREATE POLICY profiles_update_own
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins and site_admins can update any profile
CREATE POLICY profiles_update_admin
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()));

-- Staff can update student profiles only
CREATE POLICY profiles_update_staff
ON public.profiles FOR UPDATE TO authenticated
USING (
  public.is_staff(auth.uid())
  AND public.is_student(user_id)
)
WITH CHECK (
  public.is_staff(auth.uid())
  AND public.is_student(user_id)
);

-- INSERT and DELETE policies explicitly removed:
-- Profiles can only be created via handle_new_user() trigger
-- Profiles can only be deleted via CASCADE when auth.users is deleted

-- =============================================================================
-- SECTION 6: RLS POLICIES - USER_ROLES
-- =============================================================================
-- Role changes are UPDATE operations, not INSERT+DELETE.

-- Users can view their own role
CREATE POLICY roles_select_own
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Admins and site_admins can view all roles
CREATE POLICY roles_select_admin
ON public.user_roles FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()));

-- Staff can view all roles
CREATE POLICY roles_select_staff
ON public.user_roles FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

-- Teachers can view roles of their linked students
-- (Teachers already see their own role via roles_select_own)
CREATE POLICY roles_select_teacher_students
ON public.user_roles FOR SELECT TO authenticated
USING (
  public.is_teacher(auth.uid())
  AND role = 'student'
  AND EXISTS (
    SELECT 1
    FROM public.teacher_students ts
    WHERE ts.teacher_id = auth.uid()
      AND ts.student_id = user_roles.user_id
  )
);

-- INSERT policy explicitly removed:
-- Roles can only be created via handle_new_user() trigger
-- Roles can only be deleted via CASCADE when auth.users is deleted

-- Only site_admin can change roles, but cannot modify their own role
-- This prevents accidental self-lockout. See also SECTION 11 for additional protection.
CREATE POLICY roles_update_site_admin
ON public.user_roles FOR UPDATE TO authenticated
USING (
  public.is_site_admin(auth.uid())
  AND user_id != auth.uid()  -- Cannot modify own role
)
WITH CHECK (
  public.is_site_admin(auth.uid())
  AND user_id != auth.uid()
);

-- =============================================================================
-- SECTION 7: RLS POLICIES - TEACHER_STUDENTS
-- =============================================================================

-- Teachers can view their own student links
CREATE POLICY teacher_students_select_own
ON public.teacher_students FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

-- Teachers can add students (must be teacher + target must be student)
CREATE POLICY teacher_students_insert_own
ON public.teacher_students FOR INSERT TO authenticated
WITH CHECK (
  teacher_id = auth.uid()
  AND public.is_teacher(auth.uid())
  AND public.is_student(student_id)
);

-- Teachers can remove their own student links
CREATE POLICY teacher_students_delete_own
ON public.teacher_students FOR DELETE TO authenticated
USING (teacher_id = auth.uid());

-- Admins and site_admins can view all teacher-student links
CREATE POLICY teacher_students_select_admin
ON public.teacher_students FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()));

-- Staff can view all teacher-student links
CREATE POLICY teacher_students_select_staff
ON public.teacher_students FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

-- =============================================================================
-- SECTION 8: VIEW - TEACHER_STUDENT_PROFILES (WITH SECURITY INVOKER)
-- =============================================================================
-- Safe abstraction for teachers to query their students.
-- Uses security_invoker=on to ensure RLS policies are evaluated
-- in the context of the querying user, not the view owner.

CREATE OR REPLACE VIEW public.teacher_student_profiles
WITH (security_invoker=on) AS
SELECT
  p.user_id     AS student_id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.email,
  p.created_at,
  ts.teacher_id
FROM public.teacher_students ts
JOIN public.profiles p
  ON p.user_id = ts.student_id;

-- Grant appropriate permissions on tables
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.teacher_students TO authenticated;

-- Grant permissions on views
GRANT SELECT ON public.teacher_student_profiles TO authenticated;

-- =============================================================================
-- SECTION 9: TRIGGERS
-- =============================================================================

-- Automatically update updated_at timestamp on profile changes
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- user_id immutable
CREATE OR REPLACE FUNCTION public.prevent_user_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_profiles_user_id_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_user_id_change();

-- email immutable (but allow internal auth trigger sync)
CREATE OR REPLACE FUNCTION public.prevent_profile_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    -- Block if this is a user request (via PostgREST/API)
    -- Allow if this is an internal trigger (session_user = 'postgres')
    -- In Supabase: API requests come through 'authenticator' role
    IF session_user = 'authenticator' THEN
      RAISE EXCEPTION 'profiles.email is read-only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_profiles_email_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_email_change();

-- =============================================================================
-- SECTION 10: NEW USER BOOTSTRAP
-- =============================================================================
-- Automatically creates a profile and assigns 'student' role when a new user
-- signs up via Supabase Auth.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- use raw_user_meta_data.first_name and last_name (can be NULL) for atomic setting of profile name
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- sync email updates
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_auth_user_email_update() FROM PUBLIC;

CREATE TRIGGER on_auth_user_email_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_email_update();

-- =============================================================================
-- SECTION 11: SITE_ADMIN LOCKOUT PROTECTION
-- =============================================================================
-- Defense-in-depth protection to ensure at least one site_admin always exists.
--
-- PROTECTION LAYERS:
-- 1. RLS Policy (SECTION 6): site_admin cannot modify their own role via API
-- 2. Trigger (this section): prevents removal of the LAST site_admin at DB level
--
-- SCENARIOS BLOCKED BY THIS TRIGGER:
-- - Direct SQL: DELETE FROM auth.users WHERE id = <last_site_admin>
-- - Supabase Dashboard: Deleting user via UI
-- - Supabase Admin API: supabase.auth.admin.deleteUser()
-- - Any CASCADE delete from auth.users → user_roles
--
-- HOW IT WORKS WITH CASCADE DELETES:
-- PostgreSQL executes all CASCADE deletes within the SAME transaction.
-- When this trigger raises an exception, the ENTIRE transaction is rolled back:
--
--   DELETE FROM auth.users (last site_admin)
--       ↓ CASCADE (same transaction)
--   DELETE FROM auth.identities
--       ↓ CASCADE (same transaction)
--   DELETE FROM user_roles
--       ↓ BEFORE DELETE trigger
--   RAISE EXCEPTION → FULL ROLLBACK
--
-- Result: auth.users, auth.identities, AND user_roles all remain intact.
-- No "half-deleted" state is possible.
--
-- TO REMOVE A SITE_ADMIN:
-- 1. First promote another user to site_admin
-- 2. Then the original site_admin can be removed/demoted
--
-- FIRST SITE_ADMIN:
-- Must be created via direct database access (seed.sql or migration).

CREATE OR REPLACE FUNCTION public.prevent_last_site_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  remaining_site_admins INTEGER;
BEGIN
  -- Only check when removing a site_admin role (DELETE or role change away from site_admin)
  IF OLD.role = 'site_admin' AND (TG_OP = 'DELETE' OR NEW.role != 'site_admin') THEN
    -- Count remaining site_admins (excluding the one being modified)
    SELECT COUNT(*) INTO remaining_site_admins
    FROM public.user_roles
    WHERE role = 'site_admin'
      AND user_id != OLD.user_id;

    IF remaining_site_admins = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last site_admin. Promote another user to site_admin first.';
    END IF;
  END IF;

  -- Return appropriate row based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger to both UPDATE and DELETE operations
CREATE TRIGGER protect_last_site_admin
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_site_admin_removal();

-- =============================================================================
-- END OF DATABASE SETUP
-- =============================================================================
