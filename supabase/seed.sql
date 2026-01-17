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
-- students
--   00000000-0000-0000-0000-000000000100
--   00000000-0000-0000-0000-000000000101
--   00000000-0000-0000-0000-000000000102
--   00000000-0000-0000-0000-000000000103
-- -----------------------------------------------------------------------------

-- Pre-computed bcrypt hash for password "password" (cost 10)
-- Generated with: SELECT crypt('password', gen_salt('bf', 10));
DO $$
DECLARE
  password_hash TEXT := '$2a$10$PznXR4PluzW2H4t5oaQV6.gFckmqU0.c0xM.XcrQjGJ0gKWbpWV/m';
BEGIN

-- -----------------------------------------------------------------------------
-- AUTH.USERS
-- -----------------------------------------------------------------------------
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
VALUES
  -- site_admin
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'site-admin@test.nl',
    password_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  -- admin one
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin-one@test.nl',
    password_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  -- admin two
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin-two@test.nl',
    password_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  -- staff
  (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'staff@test.nl',
    password_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  -- teacher alice
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'teacher-alice@test.nl',
    password_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  -- teacher bob
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'teacher-bob@test.nl',
    password_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  -- student a
  (
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'student-a@test.nl',
    password_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  -- student b
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'student-b@test.nl',
    password_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  -- student c
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'student-c@test.nl',
    password_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  -- student d
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'student-d@test.nl',
    password_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- AUTH.IDENTITIES
-- -----------------------------------------------------------------------------
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
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'site-admin@test.nl',
    'email',
    '{"sub":"00000000-0000-0000-0000-000000000001","email":"site-admin@test.nl","email_verified":true,"provider":"email"}',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000010',
    'admin-one@test.nl',
    'email',
    '{"sub":"00000000-0000-0000-0000-000000000010","email":"admin-one@test.nl","email_verified":true,"provider":"email"}',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000011',
    'admin-two@test.nl',
    'email',
    '{"sub":"00000000-0000-0000-0000-000000000011","email":"admin-two@test.nl","email_verified":true,"provider":"email"}',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000020',
    'staff@test.nl',
    'email',
    '{"sub":"00000000-0000-0000-0000-000000000020","email":"staff@test.nl","email_verified":true,"provider":"email"}',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000030',
    'teacher-alice@test.nl',
    'email',
    '{"sub":"00000000-0000-0000-0000-000000000030","email":"teacher-alice@test.nl","email_verified":true,"provider":"email"}',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000031',
    'teacher-bob@test.nl',
    'email',
    '{"sub":"00000000-0000-0000-0000-000000000031","email":"teacher-bob@test.nl","email_verified":true,"provider":"email"}',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000100',
    'student-a@test.nl',
    'email',
    '{"sub":"00000000-0000-0000-0000-000000000100","email":"student-a@test.nl","email_verified":true,"provider":"email"}',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000101',
    'student-b@test.nl',
    'email',
    '{"sub":"00000000-0000-0000-0000-000000000101","email":"student-b@test.nl","email_verified":true,"provider":"email"}',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000102',
    'student-c@test.nl',
    'email',
    '{"sub":"00000000-0000-0000-0000-000000000102","email":"student-c@test.nl","email_verified":true,"provider":"email"}',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000103',
    'student-d@test.nl',
    'email',
    '{"sub":"00000000-0000-0000-0000-000000000103","email":"student-d@test.nl","email_verified":true,"provider":"email"}',
    now(),
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

END $$;

-- -----------------------------------------------------------------------------
-- PROFILES (created by handle_new_user trigger, update display_name)
-- -----------------------------------------------------------------------------
UPDATE public.profiles SET display_name = 'Site Admin' WHERE user_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET display_name = 'Admin One' WHERE user_id = '00000000-0000-0000-0000-000000000010';
UPDATE public.profiles SET display_name = 'Admin Two' WHERE user_id = '00000000-0000-0000-0000-000000000011';
UPDATE public.profiles SET display_name = 'Staff Member' WHERE user_id = '00000000-0000-0000-0000-000000000020';
UPDATE public.profiles SET display_name = 'Teacher Alice' WHERE user_id = '00000000-0000-0000-0000-000000000030';
UPDATE public.profiles SET display_name = 'Teacher Bob' WHERE user_id = '00000000-0000-0000-0000-000000000031';
UPDATE public.profiles SET display_name = 'Student A' WHERE user_id = '00000000-0000-0000-0000-000000000100';
UPDATE public.profiles SET display_name = 'Student B' WHERE user_id = '00000000-0000-0000-0000-000000000101';
UPDATE public.profiles SET display_name = 'Student C' WHERE user_id = '00000000-0000-0000-0000-000000000102';
UPDATE public.profiles SET display_name = 'Student D' WHERE user_id = '00000000-0000-0000-0000-000000000103';

-- -----------------------------------------------------------------------------
-- USER ROLES (update from default 'student' to correct role)
-- -----------------------------------------------------------------------------
UPDATE public.user_roles SET role = 'site_admin' WHERE user_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '00000000-0000-0000-0000-000000000010';
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '00000000-0000-0000-0000-000000000011';
UPDATE public.user_roles SET role = 'staff' WHERE user_id = '00000000-0000-0000-0000-000000000020';
UPDATE public.user_roles SET role = 'teacher' WHERE user_id = '00000000-0000-0000-0000-000000000030';
UPDATE public.user_roles SET role = 'teacher' WHERE user_id = '00000000-0000-0000-0000-000000000031';
-- Students keep the default 'student' role from handle_new_user trigger

-- -----------------------------------------------------------------------------
-- TEACHER ↔ STUDENT RELATIONSHIPS
-- -----------------------------------------------------------------------------
-- Teacher Alice teaches Student A & B
INSERT INTO public.teacher_students (teacher_id, student_id)
VALUES
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000100'),
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000101')
ON CONFLICT DO NOTHING;

-- Teacher Bob teaches Student C & D
INSERT INTO public.teacher_students (teacher_id, student_id)
VALUES
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000103')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- END SEED
-- =============================================================================
