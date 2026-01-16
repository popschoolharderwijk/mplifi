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
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simplified: user_id is PRIMARY KEY, ensuring one role per user
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
AS $$
  SELECT public._has_role(_user_id, 'site_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._has_role(_user_id, 'staff');
$$;

CREATE OR REPLACE FUNCTION public.is_teacher(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._has_role(_user_id, 'teacher');
$$;

CREATE OR REPLACE FUNCTION public.is_student(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Admins and site_admins can insert new profiles
CREATE POLICY profiles_insert_admin
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_site_admin(auth.uid())
);

-- Admins and site_admins can delete profiles
CREATE POLICY profiles_delete_admin
ON public.profiles FOR DELETE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_site_admin(auth.uid())
);

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

-- Teachers can view their own role and roles of their linked students
CREATE POLICY roles_select_teacher_students
ON public.user_roles FOR SELECT TO authenticated
USING (
  public.is_teacher(auth.uid())
  AND (
    user_id = auth.uid()
    OR (
      role = 'student'
      AND EXISTS (
        SELECT 1
        FROM public.teacher_students ts
        WHERE ts.teacher_id = auth.uid()
          AND ts.student_id = user_roles.user_id
      )
    )
  )
);

-- Only site_admin can assign initial roles (for manual user creation)
CREATE POLICY roles_insert_site_admin
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_site_admin(auth.uid()));

-- Only site_admin can change roles (UPDATE instead of DELETE+INSERT)
CREATE POLICY roles_update_site_admin
ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_site_admin(auth.uid()))
WITH CHECK (public.is_site_admin(auth.uid()));

-- =============================================================================
-- SECTION 7: RLS POLICIES - TEACHER_STUDENTS
-- =============================================================================

-- Teachers can manage their own student links
CREATE POLICY teacher_students_manage_own
ON public.teacher_students FOR ALL TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

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
  p.display_name,
  p.avatar_url,
  p.created_at,
  ts.teacher_id
FROM public.teacher_students ts
JOIN public.profiles p
  ON p.user_id = ts.student_id;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
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

-- Prevent user_id from being changed after creation
CREATE OR REPLACE FUNCTION public.prevent_user_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
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

-- =============================================================================
-- END OF DATABASE SETUP
-- =============================================================================
