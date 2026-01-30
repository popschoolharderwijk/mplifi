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
    (UUID '00000000-0000-0000-0000-000000000031', 'teacher-bob@test.nl', 'Teacher', 'Box', NULL),
    (UUID '00000000-0000-0000-0000-000000000100', 'student-a@test.nl', 'Student', 'A', '0656789012'),
    (UUID '00000000-0000-0000-0000-000000000101', 'student-b@test.nl', 'Student', 'B', NULL),
    (UUID '00000000-0000-0000-0000-000000000102', 'student-c@test.nl', 'Student', 'C', '0667890123'),
    (UUID '00000000-0000-0000-0000-000000000103', 'student-d@test.nl', 'Student', 'D', NULL);

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
INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'site_admin'),
  ('00000000-0000-0000-0000-000000000010', 'admin'),
  ('00000000-0000-0000-0000-000000000011', 'admin'),
  ('00000000-0000-0000-0000-000000000020', 'staff'),
  ('00000000-0000-0000-0000-000000000030', 'teacher'),
  ('00000000-0000-0000-0000-000000000031', 'teacher')
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- END SEED
-- =============================================================================
