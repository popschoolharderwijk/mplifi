-- =========================================
-- Initial RLS + View
-- =========================================

-- ---------- Roles ----------
DROP TYPE IF EXISTS public.app_role CASCADE;

CREATE TYPE public.app_role AS ENUM (
  'site_admin',
  'admin',
  'staff',
  'teacher',
  'student'
);

-- ---------- Tables ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.teacher_students (
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, student_id)
);

-- ---------- Enable RLS ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_students FORCE ROW LEVEL SECURITY;

-- =========================================
-- Role helper functions
-- =========================================

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

CREATE OR REPLACE FUNCTION public.is_site_admin(UUID)
RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT public._has_role($1, 'site_admin'); $$;

CREATE OR REPLACE FUNCTION public.is_admin(UUID)
RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT public._has_role($1, 'admin'); $$;

CREATE OR REPLACE FUNCTION public.is_staff(UUID)
RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT public._has_role($1, 'staff'); $$;

CREATE OR REPLACE FUNCTION public.is_teacher(UUID)
RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT public._has_role($1, 'teacher'); $$;

CREATE OR REPLACE FUNCTION public.is_student(UUID)
RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT public._has_role($1, 'student'); $$;

REVOKE ALL ON FUNCTION
  public._has_role(UUID, app_role),
  public.is_site_admin(UUID),
  public.is_admin(UUID),
  public.is_staff(UUID),
  public.is_teacher(UUID),
  public.is_student(UUID)
FROM PUBLIC;

ALTER FUNCTION public.is_site_admin(UUID) OWNER TO postgres;
ALTER FUNCTION public.is_admin(UUID) OWNER TO postgres;
ALTER FUNCTION public.is_staff(UUID) OWNER TO postgres;
ALTER FUNCTION public.is_teacher(UUID) OWNER TO postgres;
ALTER FUNCTION public.is_student(UUID) OWNER TO postgres;

-- =========================================
-- RLS: PROFILES
-- =========================================

-- Own profile
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins
CREATE POLICY profiles_select_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()));

-- Teacher: ONLY own students
CREATE POLICY profiles_select_teacher_students
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_teacher(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.teacher_students ts
    WHERE ts.teacher_id = auth.uid()
      AND ts.student_id = profiles.user_id
  )
);

-- Updates
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY profiles_update_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()));

-- =========================================
-- RLS: USER_ROLES
-- =========================================

-- Own roles
CREATE POLICY roles_select_own
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins
CREATE POLICY roles_select_admin
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_site_admin(auth.uid()));

-- Teacher: ONLY own role + linked students
CREATE POLICY roles_select_teacher_students
ON public.user_roles
FOR SELECT
TO authenticated
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

-- (Insert / update / delete policies for admins/staff/site_admin unchanged & assumed)

-- =========================================
-- RLS: TEACHER_STUDENTS
-- =========================================

CREATE POLICY teacher_students_manage_own
ON public.teacher_students
FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- =========================================
-- VIEW: teacher_student_profiles
-- =========================================
-- Safe abstraction: teachers query this, RLS still applies

CREATE OR REPLACE VIEW public.teacher_student_profiles AS
SELECT
  p.user_id     AS student_id,
  p.display_name,
  p.avatar_url,
  p.created_at,
  ts.teacher_id
FROM public.teacher_students ts
JOIN public.profiles p
  ON p.user_id = ts.student_id;

-- Optional: limit direct table access, promote view usage
REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT ON public.teacher_student_profiles TO authenticated;

-- =========================================
-- Triggers
-- =========================================

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

-- =========================================
-- New user bootstrap
-- =========================================

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
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
