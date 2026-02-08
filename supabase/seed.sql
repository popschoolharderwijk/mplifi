-- =============================================================================
-- SEED DATA FOR RLS / CI TESTING
-- =============================================================================
-- NOTE:
-- - These users are seeded in auth.users for local/preview testing
-- - Password for all users: "password"
-- - RLS policies rely on auth.uid() matching these values
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TEST USERS (UUID MAP)
-- -----------------------------------------------------------------------------
-- site_admin
--   00000000-0000-0000-0000-000000000001
--
-- admins
--   00000000-0000-0000-0000-000000000010
--   00000000-0000-0000-0000-000000000011
--
-- staff
--   00000000-0000-0000-0000-000000000020
--
-- teachers
--   00000000-0000-0000-0000-000000000030
--   00000000-0000-0000-0000-000000000031
--
-- users without any role
--   00000000-0000-0000-0000-000000000100
--   00000000-0000-0000-0000-000000000101
--   00000000-0000-0000-0000-000000000102
--   00000000-0000-0000-0000-000000000103
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  -- -------------------------------------------------------------------------
  -- Create a temporary table for new users
  -- -------------------------------------------------------------------------
  CREATE TEMP TABLE new_users (
    id UUID,
    email TEXT,
	first_name TEXT,
	last_name TEXT,
	phone_number TEXT
  );

  INSERT INTO new_users (id, email, first_name, last_name, phone_number)
  VALUES
    (UUID '00000000-0000-0000-0000-000000000001', 'site-admin@test.nl', 'Site', 'Admin', '0612345678'),
    (UUID '00000000-0000-0000-0000-000000000010', 'admin-one@test.nl', 'Admin', 'One', '0623456789'),
    (UUID '00000000-0000-0000-0000-000000000011', 'admin-two@test.nl', 'Admin', 'Two', NULL),
    (UUID '00000000-0000-0000-0000-000000000020', 'staff@test.nl', 'Staff', NULL, '0634567890'),
    (UUID '00000000-0000-0000-0000-000000000030', 'teacher-alice@test.nl', 'Teacher', 'Alice', '0645678901'),
    (UUID '00000000-0000-0000-0000-000000000031', 'teacher-bob@test.nl', 'Teacher', 'Bob', NULL),
    (UUID '00000000-0000-0000-0000-000000000100', 'student-a@test.nl', 'Student', 'A', '0656789012'),
    (UUID '00000000-0000-0000-0000-000000000101', 'student-b@test.nl', 'Student', 'B', NULL),
    (UUID '00000000-0000-0000-0000-000000000102', 'student-c@test.nl', 'Student', 'C', '0667890123'),
    (UUID '00000000-0000-0000-0000-000000000103', 'student-d@test.nl', 'Student', 'D', NULL),
    (UUID '00000000-0000-0000-0000-000000000200', 'user-a@test.nl', 'User', 'A', '0678901234'),
    (UUID '00000000-0000-0000-0000-000000000201', 'user-b@test.nl', 'User', 'B', NULL);

  -- -------------------------------------------------------------------------
  -- INSERT INTO AUTH.USERS
  -- -------------------------------------------------------------------------
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  SELECT
    id,
    '00000000-0000-0000-0000-000000000000',             -- instance_id
    'authenticated',                                    -- aud
    'authenticated',                                    -- role
    email,
    '$2a$10$yBzT6M450XE/0xAgYQHCpu8IMIh0mWzy02C6X231pYCRZm9TSCd5.',  -- encrypted_password
    now(),                                              -- email_confirmed_at
    '{"provider":"email","providers":["email"]}',       -- raw_app_meta_data
	json_build_object(         							-- raw_user_meta_data
		'first_name', first_name,
		'last_name', last_name
    ),
    now(),                                              -- created_at
    now(),                                              -- updated_at
    '',                                                 -- confirmation_token
    '',                                                 -- email_change
    '',                                                 -- email_change_token_new
    ''                                                  -- recovery_token
  FROM new_users
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- INSERT INTO AUTH.IDENTITIES
  -- -------------------------------------------------------------------------
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    id,
    id,                       -- user_id = id
    email,                     -- provider_id
    'email',                   -- provider
    json_build_object(         -- identity_data
      'sub', id::text,
      'email', email,
      'email_verified', true,
      'provider', 'email'
    ),
    now(),                     -- last_sign_in_at
    now(),                     -- created_at
    now()                      -- updated_at
  FROM new_users
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- UPDATE PROFILES WITH PHONE NUMBERS
  -- -------------------------------------------------------------------------
  -- The handle_new_user trigger created profiles, now update with phone numbers
  UPDATE public.profiles p
  SET phone_number = nu.phone_number
  FROM new_users nu
  WHERE p.user_id = nu.id
    AND nu.phone_number IS NOT NULL;

  -- -------------------------------------------------------------------------
  -- Drop the temporary table
  -- -------------------------------------------------------------------------
  DROP TABLE IF EXISTS new_users;

END $$;

-- -----------------------------------------------------------------------------
-- USER ROLES (only for users with explicit roles)
-- -----------------------------------------------------------------------------
-- Note: New users do NOT get a role automatically.
-- Note: Teachers are identified by the teachers table, not by a role.
INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'site_admin'),
  ('00000000-0000-0000-0000-000000000010', 'admin'),
  ('00000000-0000-0000-0000-000000000011', 'admin'),
  ('00000000-0000-0000-0000-000000000020', 'staff')
ON CONFLICT (user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- LESSON TYPES (default lesson types)
-- -----------------------------------------------------------------------------
INSERT INTO public.lesson_types (name, description, icon, color, duration_minutes, frequency, price_per_lesson, is_group_lesson, is_active)
SELECT * FROM (VALUES
  ('Gitaar', NULL, 'LuGuitar', '#FF9500', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('Drums', NULL, 'LuDrum', '#DC2626', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('Zang', 'Leer zingen', 'LuMic', '#EC4899', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('Bas', NULL, 'GiGuitarBassHead', '#9333EA', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('Keyboard', 'Keyboard les', 'LuPiano', '#3B82F6', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('Saxofoon', NULL, 'GiSaxophone', '#14B8A6', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('DJ / Beats', NULL, 'LuHeadphones', '#F59E0B', 45, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('Bandcoaching', NULL, 'HiUserGroup', '#6366F1', 60, 'biweekly'::public.lesson_frequency, 25.00, true, true)
) AS v(name, description, icon, color, duration_minutes, frequency, price_per_lesson, is_group_lesson, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.lesson_types WHERE lesson_types.name = v.name);

-- -----------------------------------------------------------------------------
-- TEACHERS (for test users - teachers are identified by this table, not by role)
-- -----------------------------------------------------------------------------
INSERT INTO public.teachers (user_id)
SELECT user_id FROM public.profiles
WHERE email IN ('teacher-alice@test.nl', 'teacher-bob@test.nl')
ON CONFLICT (user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- LESSON AGREEMENTS (for RLS testing)
-- -----------------------------------------------------------------------------
-- Create lesson agreements between students and teachers for testing
-- Student A has agreements with Teacher Alice and Teacher Bob
-- Student B has agreement with Teacher Alice
-- Note: Students are automatically created via triggers when lesson agreements are inserted
INSERT INTO public.lesson_agreements (student_user_id, teacher_id, lesson_type_id, day_of_week, start_time, start_date, is_active)
SELECT
  student_profile.user_id AS student_user_id,
  t.id AS teacher_id,
  lt.id AS lesson_type_id,
  agreement_data.day_of_week,
  agreement_data.start_time::TIME,
  agreement_data.start_date,
  agreement_data.is_active
FROM (VALUES
  ('student-a@test.nl', 'teacher-alice@test.nl', 'Gitaar', 1, '14:00', CURRENT_DATE, true),
  ('student-a@test.nl', 'teacher-bob@test.nl', 'Gitaar', 2, '15:00', CURRENT_DATE, true),
  ('student-b@test.nl', 'teacher-alice@test.nl', 'Gitaar', 3, '16:00', CURRENT_DATE, true)
) AS agreement_data(student_email, teacher_email, lesson_type_name, day_of_week, start_time, start_date, is_active)
INNER JOIN public.profiles student_profile ON student_profile.email = agreement_data.student_email
INNER JOIN public.profiles teacher_profile ON teacher_profile.email = agreement_data.teacher_email
INNER JOIN public.teachers t ON t.user_id = teacher_profile.user_id
INNER JOIN public.lesson_types lt ON lt.name = agreement_data.lesson_type_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.lesson_agreements la
  WHERE la.student_user_id = student_profile.user_id
    AND la.teacher_id = t.id
    AND la.lesson_type_id = lt.id
    AND la.day_of_week = agreement_data.day_of_week
    AND la.start_time = agreement_data.start_time::TIME
    AND la.start_date = agreement_data.start_date
);

-- =============================================================================
-- END SEED
-- =============================================================================
