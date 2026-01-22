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

DO $$
BEGIN
  -- -------------------------------------------------------------------------
  -- Create a temporary table for new users
  -- -------------------------------------------------------------------------
  CREATE TEMP TABLE new_users (
    id UUID,
    email TEXT,
	display_name TEXT
  );

  INSERT INTO new_users (id, email, display_name)
  VALUES
    (UUID '00000000-0000-0000-0000-000000000001', 'site-admin@test.nl', 'Site Admin'),
    (UUID '00000000-0000-0000-0000-000000000010', 'admin-one@test.nl', 'Admin One'),
    (UUID '00000000-0000-0000-0000-000000000011', 'admin-two@test.nl', 'Admin Two'),
    (UUID '00000000-0000-0000-0000-000000000020', 'staff@test.nl', 'Staff'),
    (UUID '00000000-0000-0000-0000-000000000030', 'teacher-alice@test.nl', 'Teacher Alice'),
    (UUID '00000000-0000-0000-0000-000000000031', 'teacher-bob@test.nl', 'Teacher Box'),
    (UUID '00000000-0000-0000-0000-000000000100', 'student-a@test.nl', 'Student A'),
    (UUID '00000000-0000-0000-0000-000000000101', 'student-b@test.nl', 'Student B'),
    (UUID '00000000-0000-0000-0000-000000000102', 'student-c@test.nl', 'Student C'),
    (UUID '00000000-0000-0000-0000-000000000103', 'student-d@test.nl', 'Student D');

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
    '00000000-0000-0000-0000-000000000000',            -- instance_id
    'authenticated',                                    -- aud
    'authenticated',                                    -- role
    email,
    '$2a$10$yBzT6M450XE/0xAgYQHCpu8IMIh0mWzy02C6X231pYCRZm9TSCd5.',  -- encrypted_password
    now(),                                              -- email_confirmed_at
    '{"provider":"email","providers":["email"]}',       -- raw_app_meta_data
	json_build_object(         							-- raw_user_meta_data
		'display_name', display_name
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
  -- Drop the temporary table
  -- -------------------------------------------------------------------------
  DROP TABLE IF EXISTS new_users;

END $$;

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
