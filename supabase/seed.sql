-- =============================================================================
-- SEED DATA FOR RLS / CI TESTING
-- =============================================================================
-- NOTE:
-- - These users are seeded in auth.users for local/preview testing
-- - Password for all users: "password"
-- - RLS policies rely on auth.uid() matching these values
-- =============================================================================

-- -----------------------------------------------------------------------------
-- UUID STRUCTURE
-- -----------------------------------------------------------------------------
-- UUID format: TTTTTTTT-IIII-0000-0000-000000000000
--   TTTTTTTT: Type prefix (first 8 hex digits)
--   IIII: Index (4 hex digits, 1-based, zero-padded)
--   Rest: 0000-0000-000000000000
--
-- Type prefixes:
--   10000000 = site_admin
--   20000000 = admin
--   30000000 = staff
--   40000000 = teacher
--   50000000 = student
--   60000000 = user (no role, no teacher, no student)
--
-- Examples:
--   10000000-0001-0000-0000-000000000000 = site_admin, 1st
--   20000000-0001-0000-0000-000000000000 = admin, 1st
--   30000000-0020-0000-0000-000000000000 = staff, 20th
--   40000000-0005-0000-0000-000000000000 = teacher, 5th
--   50000000-0001-0000-0000-000000000000 = student, 1st
--   60000000-0001-0000-0000-000000000000 = user (no role), 1st
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- TEST USERS (UUID MAP)
-- -----------------------------------------------------------------------------
-- site_admin (1)
--   10000000-0001-0000-0000-000000000000
--
-- admins (2)
--   20000000-0001-0000-0000-000000000000
--   20000000-0002-0000-0000-000000000000
--
-- staff (5)
--   30000000-0001-0000-0000-000000000000
--   30000000-0002-0000-0000-000000000000
--   30000000-0003-0000-0000-000000000000
--   30000000-0004-0000-0000-000000000000
--   30000000-0005-0000-0000-000000000000
--
-- teachers (10)
--   40000000-0001-0000-0000-000000000000 (Teacher Alice - has students)
--   40000000-0002-0000-0000-000000000000 (Teacher Bob - has students)
--   40000000-0003-0000-0000-000000000000 (Teacher Charlie - has students)
--   40000000-0004-0000-0000-000000000000 (Teacher Diana - has students)
--   40000000-0005-0000-0000-000000000000 (Teacher Eve - has students, Bandcoaching)
--   40000000-0006-0000-0000-000000000000 (Teacher Frank - has students)
--   40000000-0007-0000-0000-000000000000 (Teacher Grace - has students)
--   40000000-0008-0000-0000-000000000000 (Teacher Henry - has students)
--   40000000-0009-0000-0000-000000000000 (Teacher Iris - has students)
--   40000000-0010-0000-0000-000000000000 (Teacher Jack - NO students)
--
-- students (60)
--   50000000-0001 t/m 50000000-0060
--
-- users without any role (10)
--   60000000-0001 t/m 60000000-0010
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

  -- -------------------------------------------------------------------------
  -- INSERT USERS INTO TEMP TABLE
  -- -------------------------------------------------------------------------
  -- Logic: Insert all users with new UUID structure
  -- - 1 site_admin, 2 admins, 5 staff, 10 teachers, 60 students, 10 users (no role)
  -- - Total: 88 users
  -- -------------------------------------------------------------------------
  INSERT INTO new_users (id, email, first_name, last_name, phone_number)
  VALUES
    -- Site admin (1)
    (UUID '10000000-0001-0000-0000-000000000000', 'site-admin@test.nl', 'Jan-Willem', 'van der Berg', '0612345678'),

    -- Admins (2)
    (UUID '20000000-0001-0000-0000-000000000000', 'admin-one@test.nl', 'Sophie', 'de Vries', '0623456789'),
    (UUID '20000000-0002-0000-0000-000000000000', 'admin-two@test.nl', 'Maarten', 'van den Broek', NULL),

    -- Staff (5)
    (UUID '30000000-0001-0000-0000-000000000000', 'staff-one@test.nl', 'Lisa', 'Jansen', '0634567890'),
    (UUID '30000000-0002-0000-0000-000000000000', 'staff-two@test.nl', 'Thomas', 'Bakker', '0634567891'),
    (UUID '30000000-0003-0000-0000-000000000000', 'staff-three@test.nl', 'Emma', 'Visser', '0634567892'),
    (UUID '30000000-0004-0000-0000-000000000000', 'staff-four@test.nl', 'Daan', 'Smit', '0634567893'),
    (UUID '30000000-0005-0000-0000-000000000000', 'staff-five@test.nl', 'Anna', 'Meijer', '0634567894'),

    -- Teachers (10)
    (UUID '40000000-0001-0000-0000-000000000000', 'teacher-alice@test.nl', 'Alice', 'van Dijk', '0645678901'),
    (UUID '40000000-0002-0000-0000-000000000000', 'teacher-bob@test.nl', 'Bob', 'de Boer', NULL),
    (UUID '40000000-0003-0000-0000-000000000000', 'teacher-charlie@test.nl', 'Charlotte', 'Mulder', '0645678902'),
    (UUID '40000000-0004-0000-0000-000000000000', 'teacher-diana@test.nl', 'Diana', 'van der Laan', '0645678903'),
    (UUID '40000000-0005-0000-0000-000000000000', 'teacher-eve@test.nl', 'Eva', 'van den Berg', '0645678904'),
    (UUID '40000000-0006-0000-0000-000000000000', 'teacher-frank@test.nl', 'Frank', 'de Vries', '0645678905'),
    (UUID '40000000-0007-0000-0000-000000000000', 'teacher-grace@test.nl', 'Grace', 'van der Meer', '0645678906'),
    (UUID '40000000-0008-0000-0000-000000000000', 'teacher-henry@test.nl', 'Hendrik', 'Janssen', '0645678907'),
    (UUID '40000000-0009-0000-0000-000000000000', 'teacher-iris@test.nl', 'Iris', 'van Leeuwen', '0645678908'),
    (UUID '40000000-0010-0000-0000-000000000000', 'teacher-jack@test.nl', 'Jacques', 'van der Wal', '0645678909'),

    -- Students (60)
    (UUID '50000000-0001-0000-0000-000000000000', 'student-001@test.nl', 'Lucas', 'van der Berg', '0656789012'),
    (UUID '50000000-0002-0000-0000-000000000000', 'student-002@test.nl', 'Noah', 'de Jong', NULL),
    (UUID '50000000-0003-0000-0000-000000000000', 'student-003@test.nl', 'Sem', 'Bakker', '0656789013'),
    (UUID '50000000-0004-0000-0000-000000000000', 'student-004@test.nl', 'Daan', 'Visser', NULL),
    (UUID '50000000-0005-0000-0000-000000000000', 'student-005@test.nl', 'Finn', 'Smit', '0656789014'),
    (UUID '50000000-0006-0000-0000-000000000000', 'student-006@test.nl', 'Liam', 'Meijer', '0656789015'),
    (UUID '50000000-0007-0000-0000-000000000000', 'student-007@test.nl', 'Jesse', 'de Boer', '0656789016'),
    (UUID '50000000-0008-0000-0000-000000000000', 'student-008@test.nl', 'Milan', 'Mulder', '0656789017'),
    (UUID '50000000-0009-0000-0000-000000000000', 'student-009@test.nl', 'Luuk', 'de Vries', '0656789018'),
    (UUID '50000000-0010-0000-0000-000000000000', 'student-010@test.nl', 'Bram', 'van Dijk', '0656789019'),
    (UUID '50000000-0011-0000-0000-000000000000', 'student-011@test.nl', 'Thijs', 'Janssen', '0656789020'),
    (UUID '50000000-0012-0000-0000-000000000000', 'student-012@test.nl', 'Max', 'van Leeuwen', '0656789021'),
    (UUID '50000000-0013-0000-0000-000000000000', 'student-013@test.nl', 'Sam', 'Jansen', '0656789022'),
    (UUID '50000000-0014-0000-0000-000000000000', 'student-014@test.nl', 'Levi', 'van der Laan', '0656789023'),
    (UUID '50000000-0015-0000-0000-000000000000', 'student-015@test.nl', 'Mees', 'van den Berg', '0656789024'),
    (UUID '50000000-0016-0000-0000-000000000000', 'student-016@test.nl', 'James', 'van der Meer', '0656789025'),
    (UUID '50000000-0017-0000-0000-000000000000', 'student-017@test.nl', 'Adam', 'van der Wal', '0656789026'),
    (UUID '50000000-0018-0000-0000-000000000000', 'student-018@test.nl', 'Olivier', 'van den Broek', '0656789027'),
    (UUID '50000000-0019-0000-0000-000000000000', 'student-019@test.nl', 'Benjamin', 'Hendriks', '0656789028'),
    (UUID '50000000-0020-0000-0000-000000000000', 'student-020@test.nl', 'Noud', 'Willems', '0656789029'),
    (UUID '50000000-0021-0000-0000-000000000000', 'student-021@test.nl', 'Gijs', 'van der Ven', '0656789030'),
    (UUID '50000000-0022-0000-0000-000000000000', 'student-022@test.nl', 'Teun', 'van der Heijden', '0656789031'),
    (UUID '50000000-0023-0000-0000-000000000000', 'student-023@test.nl', 'Roan', 'van der Steen', '0656789032'),
    (UUID '50000000-0024-0000-0000-000000000000', 'student-024@test.nl', 'Cas', 'van der Velden', '0656789033'),
    (UUID '50000000-0025-0000-0000-000000000000', 'student-025@test.nl', 'Tijn', 'van der Horst', '0656789034'),
    (UUID '50000000-0026-0000-0000-000000000000', 'student-026@test.nl', 'Sep', 'van der Pol', '0656789035'),
    (UUID '50000000-0027-0000-0000-000000000000', 'student-027@test.nl', 'Boaz', 'van der Linden', '0656789036'),
    (UUID '50000000-0028-0000-0000-000000000000', 'student-028@test.nl', 'Julian', 'van der Zanden', '0656789037'),
    (UUID '50000000-0029-0000-0000-000000000000', 'student-029@test.nl', 'Hugo', 'van der Schaaf', '0656789038'),
    (UUID '50000000-0030-0000-0000-000000000000', 'student-030@test.nl', 'Ruben', 'van der Schoot', '0656789039'),
    (UUID '50000000-0031-0000-0000-000000000000', 'student-031@test.nl', 'Sophie', 'van der Stelt', '0656789040'),
    (UUID '50000000-0032-0000-0000-000000000000', 'student-032@test.nl', 'Julia', 'van der Veen', '0656789041'),
    (UUID '50000000-0033-0000-0000-000000000000', 'student-033@test.nl', 'Emma', 'van der Weide', '0656789042'),
    (UUID '50000000-0034-0000-0000-000000000000', 'student-034@test.nl', 'Mila', 'van der Woude', '0656789043'),
    (UUID '50000000-0035-0000-0000-000000000000', 'student-035@test.nl', 'Tess', 'van der Zee', '0656789044'),
    (UUID '50000000-0036-0000-0000-000000000000', 'student-036@test.nl', 'Sara', 'van der Zwet', '0656789045'),
    (UUID '50000000-0037-0000-0000-000000000000', 'student-037@test.nl', 'Eva', 'van der Zwol', '0656789046'),
    (UUID '50000000-0038-0000-0000-000000000000', 'student-038@test.nl', 'Nora', 'van der Zwart', '0656789047'),
    (UUID '50000000-0039-0000-0000-000000000000', 'student-039@test.nl', 'Lotte', 'van der Zwaan', '0656789048'),
    (UUID '50000000-0040-0000-0000-000000000000', 'student-040@test.nl', 'Noor', 'van der Zwan', '0656789049'),
    (UUID '50000000-0041-0000-0000-000000000000', 'student-041@test.nl', 'Liv', 'van der Zwarte', '0656789050'),
    (UUID '50000000-0042-0000-0000-000000000000', 'student-042@test.nl', 'Saar', 'van der Zwartenberg', '0656789051'),
    (UUID '50000000-0043-0000-0000-000000000000', 'student-043@test.nl', 'Roos', 'van der Zwartewaal', '0656789052'),
    (UUID '50000000-0044-0000-0000-000000000000', 'student-044@test.nl', 'Fleur', 'van der Zwarteweg', '0656789053'),
    (UUID '50000000-0045-0000-0000-000000000000', 'student-045@test.nl', 'Ivy', 'van der Zwartewijk', '0656789054'),
    (UUID '50000000-0046-0000-0000-000000000000', 'student-046@test.nl', 'Lynn', 'van der Zwartewolde', '0656789055'),
    (UUID '50000000-0047-0000-0000-000000000000', 'student-047@test.nl', 'Yara', 'van der Zwartewoud', '0656789056'),
    (UUID '50000000-0048-0000-0000-000000000000', 'student-048@test.nl', 'Lieke', 'van der Zwartewout', '0656789057'),
    (UUID '50000000-0049-0000-0000-000000000000', 'student-049@test.nl', 'Fenna', 'van der Zwartewouw', '0656789058'),
    (UUID '50000000-0050-0000-0000-000000000000', 'student-050@test.nl', 'Lina', 'van der Zwartewouwers', '0656789059'),
    (UUID '50000000-0051-0000-0000-000000000000', 'student-051@test.nl', 'Anna', 'van der Zwartewouwershof', '0656789060'),
    (UUID '50000000-0052-0000-0000-000000000000', 'student-052@test.nl', 'Amber', 'van der Zwartewouwershofstraat', '0656789061'),
    (UUID '50000000-0053-0000-0000-000000000000', 'student-053@test.nl', 'Isabella', 'van der Zwartewouwershofstraatweg', '0656789062'),
    (UUID '50000000-0054-0000-0000-000000000000', 'student-054@test.nl', 'Eline', 'van der Zwartewouwershofstraatweglaan', '0656789063'),
    (UUID '50000000-0055-0000-0000-000000000000', 'student-055@test.nl', 'Luna', 'van der Zwartewouwershofstraatweglaanstraat', '0656789064'),
    (UUID '50000000-0056-0000-0000-000000000000', 'student-056@test.nl', 'Nina', 'Koning', '0656789065'),
    (UUID '50000000-0057-0000-0000-000000000000', 'student-057@test.nl', 'Mia', 'Vermeulen', '0656789066'),
    (UUID '50000000-0058-0000-0000-000000000000', 'student-058@test.nl', 'Lina', 'van den Berg', '0656789067'),
    (UUID '50000000-0059-0000-0000-000000000000', 'student-059@test.nl', 'Zoë', 'van den Broek', '0656789068'),
    (UUID '50000000-0060-0000-0000-000000000000', 'student-060@test.nl', 'Lara', 'van den Heuvel', '0656789069'),

    -- Users without any role (10)
    (UUID '60000000-0001-0000-0000-000000000000', 'user-001@test.nl', 'Koen', 'van der Berg', '0667890123'),
    (UUID '60000000-0002-0000-0000-000000000000', 'user-002@test.nl', 'Rik', 'de Jong', NULL),
    (UUID '60000000-0003-0000-0000-000000000000', 'user-003@test.nl', 'Tim', 'Bakker', '0667890124'),
    (UUID '60000000-0004-0000-0000-000000000000', 'user-004@test.nl', 'Sander', 'Visser', '0667890125'),
    (UUID '60000000-0005-0000-0000-000000000000', 'user-005@test.nl', 'Rick', 'Smit', NULL),
    (UUID '60000000-0006-0000-0000-000000000000', 'user-006@test.nl', 'Tom', 'Meijer', '0667890126'),
    (UUID '60000000-0007-0000-0000-000000000000', 'user-007@test.nl', 'Nick', 'de Boer', '0667890127'),
    (UUID '60000000-0008-0000-0000-000000000000', 'user-008@test.nl', 'Bas', 'Mulder', NULL),
    (UUID '60000000-0009-0000-0000-000000000000', 'user-009@test.nl', 'Stijn', 'de Vries', '0667890128'),
    (UUID '60000000-0010-0000-0000-000000000000', 'user-010@test.nl', 'Willem-Jan', 'van der Berg', '0667890129');

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
    '$2a$10$9e974vMhtRxGA42trytRd.tC0yXzEhsKO0xN8lgoLjy5psvhsJTY.',  -- encrypted_password
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
  -- UPDATE PROFILES WITH FIRST_NAME, LAST_NAME, AND PHONE NUMBERS
  -- -------------------------------------------------------------------------
  -- The handle_new_user trigger created profiles with first_name/last_name from raw_user_meta_data,
  -- but we explicitly update them here to ensure they match the new_users table values exactly
  UPDATE public.profiles p
  SET
    first_name = nu.first_name,
    last_name = nu.last_name,
    phone_number = nu.phone_number
  FROM new_users nu
  WHERE p.user_id = nu.id;

  -- -------------------------------------------------------------------------
  -- Drop the temporary table
  -- -------------------------------------------------------------------------
  DROP TABLE IF EXISTS new_users;

END $$;

-- -----------------------------------------------------------------------------
-- USER ROLES (only for users with explicit roles)
-- -----------------------------------------------------------------------------
-- Logic:
-- - Only site_admin, admin, and staff have explicit roles in user_roles table
-- - Teachers are identified by the teachers table, not by a role
-- - Students are identified by the students table (auto-created via triggers)
-- - Users with UUID prefix 60000000 have no role, no teacher record, no student record
--   They are just regular authenticated users without any special permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role) VALUES
  -- Site admin (1)
  ('10000000-0001-0000-0000-000000000000', 'site_admin'),

  -- Admins (2)
  ('20000000-0001-0000-0000-000000000000', 'admin'),
  ('20000000-0002-0000-0000-000000000000', 'admin'),

  -- Staff (5)
  ('30000000-0001-0000-0000-000000000000', 'staff'),
  ('30000000-0002-0000-0000-000000000000', 'staff'),
  ('30000000-0003-0000-0000-000000000000', 'staff'),
  ('30000000-0004-0000-0000-000000000000', 'staff'),
  ('30000000-0005-0000-0000-000000000000', 'staff')
ON CONFLICT (user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- LESSON TYPES (default lesson types)
-- -----------------------------------------------------------------------------
-- Logic: Insert all 8 lesson types if they don't exist
-- - Gitaar, Drums, Zang, Bas, Keyboard, Saxofoon, DJ / Beats, Bandcoaching
-- - Bandcoaching is the only group lesson (is_group_lesson = true)
-- - Durations: 30 min (most), 45 min (DJ / Beats), 60 min (Bandcoaching)
-- -----------------------------------------------------------------------------
INSERT INTO public.lesson_types (name, description, icon, color, duration_minutes, frequency, price_per_lesson, is_group_lesson, is_active)
SELECT * FROM (VALUES
  ('Gitaar', NULL, 'LuGuitar', '#FF9500', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('Drums', NULL, 'LuDrum', '#DC2626', 30, 'biweekly'::public.lesson_frequency, 25.00, false, true),
  ('Zang', 'Learn to sing', 'LuMic', '#EC4899', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('Bas', NULL, 'GiGuitarBassHead', '#9333EA', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('Keyboard', 'Keyboard lessons', 'LuPiano', '#3B82F6', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('Saxofoon', NULL, 'GiSaxophone', '#14B8A6', 30, 'weekly'::public.lesson_frequency, 25.00, false, true),
  ('DJ / Beats', NULL, 'LuHeadphones', '#F59E0B', 45, 'monthly'::public.lesson_frequency, 25.00, false, true),
  ('Bandcoaching', NULL, 'HiUserGroup', '#6366F1', 60, 'biweekly'::public.lesson_frequency, 25.00, true, true)
) AS v(name, description, icon, color, duration_minutes, frequency, price_per_lesson, is_group_lesson, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.lesson_types WHERE lesson_types.name = v.name);

-- -----------------------------------------------------------------------------
-- TEACHERS (for test users - teachers are identified by this table, not by role)
-- -----------------------------------------------------------------------------
-- Logic: Insert all 10 teachers
-- - Teachers 1-9 have students (will have lesson agreements)
-- - Teacher 10 (Jack) has NO students (no lesson agreements)
-- -----------------------------------------------------------------------------
INSERT INTO public.teachers (user_id)
SELECT user_id FROM public.profiles
WHERE email IN (
  'teacher-alice@test.nl',
  'teacher-bob@test.nl',
  'teacher-charlie@test.nl',
  'teacher-diana@test.nl',
  'teacher-eve@test.nl',
  'teacher-frank@test.nl',
  'teacher-grace@test.nl',
  'teacher-henry@test.nl',
  'teacher-iris@test.nl',
  'teacher-jack@test.nl'
)
ON CONFLICT (user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- TEACHER LESSON TYPES (link teachers to lesson types they can teach)
-- -----------------------------------------------------------------------------
-- Logic: Distribute all 8 lesson types across 9 teachers (teacher 10 has no students)
-- - Each teacher can teach 1, 2, or 3 lesson types
-- - All 8 lesson types must be represented
-- - Some lesson types are taught by multiple teachers
--
-- Distribution:
--   Teacher 1 (Alice): Gitaar, Drums, Zang (3 types)
--   Teacher 2 (Bob): Bas, Keyboard (2 types)
--   Teacher 3 (Charlie): Saxofoon (1 type)
--   Teacher 4 (Diana): DJ / Beats (1 type)
--   Teacher 5 (Eve): Bandcoaching (1 type) - group lesson
--   Teacher 6 (Frank): Gitaar (1 type)
--   Teacher 7 (Grace): Drums (1 type)
--   Teacher 8 (Henry): Zang (1 type)
--   Teacher 9 (Iris): Bas (1 type)
--   Teacher 10 (Jack): No lesson types (no students)
--
-- Result: All 8 types covered, some by multiple teachers
-- -----------------------------------------------------------------------------
INSERT INTO public.teacher_lesson_types (teacher_id, lesson_type_id)
SELECT
  t.id AS teacher_id,
  lt.id AS lesson_type_id
FROM (VALUES
  -- Teacher 1 (Alice): 3 types
  ('teacher-alice@test.nl', 'Gitaar'),
  ('teacher-alice@test.nl', 'Drums'),
  ('teacher-alice@test.nl', 'Zang'),

  -- Teacher 2 (Bob): 2 types
  ('teacher-bob@test.nl', 'Bas'),
  ('teacher-bob@test.nl', 'Keyboard'),

  -- Teacher 3 (Charlie): 1 type
  ('teacher-charlie@test.nl', 'Saxofoon'),

  -- Teacher 4 (Diana): 1 type
  ('teacher-diana@test.nl', 'DJ / Beats'),

  -- Teacher 5 (Eve): 1 type (group lesson)
  ('teacher-eve@test.nl', 'Bandcoaching'),

  -- Teacher 6 (Frank): 1 type
  ('teacher-frank@test.nl', 'Gitaar'),

  -- Teacher 7 (Grace): 1 type
  ('teacher-grace@test.nl', 'Drums'),

  -- Teacher 8 (Henry): 1 type
  ('teacher-henry@test.nl', 'Zang'),

  -- Teacher 9 (Iris): 1 type
  ('teacher-iris@test.nl', 'Bas')

  -- Teacher 10 (Jack): No lesson types (no students)
) AS teacher_lesson_data(teacher_email, lesson_type_name)
INNER JOIN public.profiles p ON p.email = teacher_lesson_data.teacher_email
INNER JOIN public.teachers t ON t.user_id = p.user_id
INNER JOIN public.lesson_types lt ON lt.name = teacher_lesson_data.lesson_type_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.teacher_lesson_types tlt
  WHERE tlt.teacher_id = t.id
    AND tlt.lesson_type_id = lt.id
);

-- -----------------------------------------------------------------------------
-- TEACHER AVAILABILITY (for RLS testing)
-- -----------------------------------------------------------------------------
-- Logic: Each teacher gets availability slots that are LARGER than their lesson times.
-- This represents realistic availability where teachers have free time for new students.
-- Overlapping/adjacent blocks are merged into single blocks.
--
-- Extended schedule (covers lessons + extra availability):
--   Teacher 1 (Alice): Mon 08:00-18:00 (full day), Wed 10:00-20:00, Fri 09:00-13:00 (extra)
--   Teacher 2 (Bob): Tue 09:00-18:00 (full day), Thu 08:00-18:00 (full day), Sat 10:00-14:00 (extra)
--   Teacher 3 (Charlie): Mon 12:00-19:00, Wed 14:00-18:00 (extra), Fri 08:00-14:00
--   Teacher 4 (Diana): Tue 10:00-20:00, Thu 08:00-14:00, Sat 09:00-12:00 (extra)
--   Teacher 5 (Eve): Mon 09:00-17:00 (more than just bandcoaching), Thu 14:00-18:00 (extra)
--   Teacher 6 (Frank): Mon 14:00-17:00 (extra), Wed 08:00-14:00, Fri 12:00-19:00
--   Teacher 7 (Grace): Mon 08:00-15:00, Thu 09:00-15:00, Fri 10:00-14:00 (extra)
--   Teacher 8 (Henry): Tue 08:00-14:00, Wed 15:00-19:00 (extra), Fri 09:00-15:00
--   Teacher 9 (Iris): Wed 09:00-15:00, Thu 12:00-19:00, Tue 14:00-17:00 (extra)
--   Teacher 10 (Jack): Tue 10:00-14:00, Thu 10:00-14:00 (has availability but no students)
-- -----------------------------------------------------------------------------
INSERT INTO public.teacher_availability (teacher_id, day_of_week, start_time, end_time)
SELECT
  t.id AS teacher_id,
  availability_data.day_of_week,
  availability_data.start_time::TIME,
  availability_data.end_time::TIME
FROM (VALUES
  -- Teacher 1 (Alice) - Extended availability with extra slots
  ('teacher-alice@test.nl', 1, '08:00', '18:00'),  -- Monday full day (covers 09:00-12:00 + 14:00-17:00 lessons)
  ('teacher-alice@test.nl', 3, '10:00', '20:00'),  -- Wednesday extended (covers 14:00-17:00 lessons + extra)
  ('teacher-alice@test.nl', 5, '09:00', '13:00'),  -- Friday morning (extra availability, no lessons)

  -- Teacher 2 (Bob) - Extended availability
  ('teacher-bob@test.nl', 2, '09:00', '18:00'),    -- Tuesday full day (covers 10:00-13:00 + 14:00-17:00)
  ('teacher-bob@test.nl', 4, '08:00', '18:00'),    -- Thursday full day (covers 10:00-13:00 + 14:00-17:00)
  ('teacher-bob@test.nl', 6, '10:00', '14:00'),    -- Saturday morning (extra availability)

  -- Teacher 3 (Charlie) - Extended availability
  ('teacher-charlie@test.nl', 1, '12:00', '19:00'), -- Monday extended (covers 14:00-17:00)
  ('teacher-charlie@test.nl', 3, '14:00', '18:00'), -- Wednesday afternoon (extra)
  ('teacher-charlie@test.nl', 5, '08:00', '14:00'), -- Friday extended (covers 09:00-12:00)

  -- Teacher 4 (Diana) - Extended availability
  ('teacher-diana@test.nl', 2, '10:00', '20:00'),  -- Tuesday extended (covers 14:00-17:00)
  ('teacher-diana@test.nl', 4, '08:00', '14:00'),  -- Thursday extended (covers 09:00-12:00)
  ('teacher-diana@test.nl', 6, '09:00', '12:00'),  -- Saturday morning (extra)

  -- Teacher 5 (Eve) - Extended beyond just Bandcoaching
  ('teacher-eve@test.nl', 1, '09:00', '17:00'),    -- Monday extended (covers 14:00-15:00 bandcoaching + extra)
  ('teacher-eve@test.nl', 4, '14:00', '18:00'),    -- Thursday afternoon (extra availability)

  -- Teacher 6 (Frank) - Extended availability
  ('teacher-frank@test.nl', 1, '14:00', '17:00'),  -- Monday afternoon (extra)
  ('teacher-frank@test.nl', 3, '08:00', '14:00'),  -- Wednesday extended (covers 09:00-12:00)
  ('teacher-frank@test.nl', 5, '12:00', '19:00'),  -- Friday extended (covers 14:00-17:00)

  -- Teacher 7 (Grace) - Extended availability
  ('teacher-grace@test.nl', 1, '08:00', '15:00'),  -- Monday extended (covers 10:00-13:00)
  ('teacher-grace@test.nl', 4, '09:00', '15:00'),  -- Thursday extended (covers 10:00-13:00)
  ('teacher-grace@test.nl', 5, '10:00', '14:00'),  -- Friday late morning (extra)

  -- Teacher 8 (Henry) - Extended availability
  ('teacher-henry@test.nl', 2, '08:00', '14:00'),  -- Tuesday extended (covers 09:00-12:00)
  ('teacher-henry@test.nl', 3, '15:00', '19:00'),  -- Wednesday afternoon (extra)
  ('teacher-henry@test.nl', 5, '09:00', '15:00'),  -- Friday extended (covers 10:00-13:00)

  -- Teacher 9 (Iris) - Extended availability
  ('teacher-iris@test.nl', 2, '14:00', '17:00'),   -- Tuesday afternoon (extra)
  ('teacher-iris@test.nl', 3, '09:00', '15:00'),   -- Wednesday extended (covers 10:00-13:00)
  ('teacher-iris@test.nl', 4, '12:00', '19:00'),   -- Thursday extended (covers 14:00-17:00)

  -- Teacher 10 (Jack) - Has availability but no students
  ('teacher-jack@test.nl', 2, '10:00', '14:00'),   -- Tuesday late morning
  ('teacher-jack@test.nl', 4, '10:00', '14:00')    -- Thursday late morning
) AS availability_data(teacher_email, day_of_week, start_time, end_time)
INNER JOIN public.profiles p ON p.email = availability_data.teacher_email
INNER JOIN public.teachers t ON t.user_id = p.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.teacher_availability ta
  WHERE ta.teacher_id = t.id
    AND ta.day_of_week = availability_data.day_of_week
    AND ta.start_time = availability_data.start_time::TIME
    AND ta.end_time = availability_data.end_time::TIME
);

-- -----------------------------------------------------------------------------
-- LESSON AGREEMENTS (for RLS testing)
-- -----------------------------------------------------------------------------
-- Logic: Create lesson agreements between 9 teachers and 60 students
-- - Teacher 10 (Jack) has NO students
-- - All 8 lesson types are represented
-- - STRICT RULE: Each (teacher, day_of_week, start_time) is unique (except Bandcoaching)
-- - Bandcoaching is a group lesson with 8 students at the same time
-- - Students can have 1-2 lesson agreements
--
-- Total lesson agreements: 88
--   - Bandcoaching: 8 students × 1 slot = 8 agreements (group lesson)
--   - Alice: 12 unique slots = 12 agreements
--   - Bob: 12 unique slots = 12 agreements
--   - Charlie: 12 unique slots = 12 agreements
--   - Diana: 8 unique slots = 8 agreements (45 min lessons = fewer slots)
--   - Frank: 12 unique slots = 12 agreements
--   - Grace: 12 unique slots = 12 agreements
--   - Henry: 12 unique slots = 12 agreements
--   - Iris: 12 unique slots = 12 agreements
--   Total: 8 + 12×8 = 8 + 96 = 104 agreements
--
-- Time slot allocation (30 min slots):
--   - 09:00, 09:30, 10:00, 10:30, 11:00, 11:30 (morning block: 6 slots)
--   - 14:00, 14:30, 15:00, 15:30, 16:00, 16:30 (afternoon block: 6 slots)
-- -----------------------------------------------------------------------------
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
  -- ========================================================================
  -- BANDCOACHING GROUP LESSON (8 students, same time)
  -- ========================================================================
  -- Teacher 5 (Eve) - Bandcoaching - Monday 14:00 (1 hour group lesson)
  -- Students 001-008 all have the same lesson at the same time (THIS IS ALLOWED)
  ('student-001@test.nl', 'teacher-eve@test.nl', 'Bandcoaching', 1, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-002@test.nl', 'teacher-eve@test.nl', 'Bandcoaching', 1, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-003@test.nl', 'teacher-eve@test.nl', 'Bandcoaching', 1, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-004@test.nl', 'teacher-eve@test.nl', 'Bandcoaching', 1, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-005@test.nl', 'teacher-eve@test.nl', 'Bandcoaching', 1, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-006@test.nl', 'teacher-eve@test.nl', 'Bandcoaching', 1, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-007@test.nl', 'teacher-eve@test.nl', 'Bandcoaching', 1, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-008@test.nl', 'teacher-eve@test.nl', 'Bandcoaching', 1, '14:00', CURRENT_DATE - INTERVAL '6 months', true),

  -- ========================================================================
  -- TEACHER 1 (Alice) - Gitaar, Drums, Zang - 12 UNIQUE slots
  -- ========================================================================
  -- Monday morning 09:00-12:00 (Gitaar): 6 slots
  ('student-009@test.nl', 'teacher-alice@test.nl', 'Gitaar', 1, '09:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-010@test.nl', 'teacher-alice@test.nl', 'Gitaar', 1, '09:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-011@test.nl', 'teacher-alice@test.nl', 'Gitaar', 1, '10:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-012@test.nl', 'teacher-alice@test.nl', 'Gitaar', 1, '10:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-013@test.nl', 'teacher-alice@test.nl', 'Gitaar', 1, '11:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-014@test.nl', 'teacher-alice@test.nl', 'Gitaar', 1, '11:30', CURRENT_DATE - INTERVAL '6 months', true),
  -- Monday afternoon 14:00-17:00 (Drums): 6 slots
  ('student-015@test.nl', 'teacher-alice@test.nl', 'Drums', 1, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-016@test.nl', 'teacher-alice@test.nl', 'Drums', 1, '14:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-017@test.nl', 'teacher-alice@test.nl', 'Drums', 1, '15:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-018@test.nl', 'teacher-alice@test.nl', 'Drums', 1, '15:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-019@test.nl', 'teacher-alice@test.nl', 'Drums', 1, '16:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-020@test.nl', 'teacher-alice@test.nl', 'Drums', 1, '16:30', CURRENT_DATE - INTERVAL '6 months', true),

  -- ========================================================================
  -- TEACHER 2 (Bob) - Bas, Keyboard - 12 UNIQUE slots
  -- ========================================================================
  -- Tuesday morning 10:00-13:00 (Bas): 6 slots
  ('student-021@test.nl', 'teacher-bob@test.nl', 'Bas', 2, '10:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-022@test.nl', 'teacher-bob@test.nl', 'Bas', 2, '10:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-023@test.nl', 'teacher-bob@test.nl', 'Bas', 2, '11:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-024@test.nl', 'teacher-bob@test.nl', 'Bas', 2, '11:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-025@test.nl', 'teacher-bob@test.nl', 'Bas', 2, '12:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-026@test.nl', 'teacher-bob@test.nl', 'Bas', 2, '12:30', CURRENT_DATE - INTERVAL '6 months', true),
  -- Tuesday afternoon 14:00-17:00 (Keyboard): 6 slots
  ('student-027@test.nl', 'teacher-bob@test.nl', 'Keyboard', 2, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-028@test.nl', 'teacher-bob@test.nl', 'Keyboard', 2, '14:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-029@test.nl', 'teacher-bob@test.nl', 'Keyboard', 2, '15:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-030@test.nl', 'teacher-bob@test.nl', 'Keyboard', 2, '15:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-031@test.nl', 'teacher-bob@test.nl', 'Keyboard', 2, '16:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-032@test.nl', 'teacher-bob@test.nl', 'Keyboard', 2, '16:30', CURRENT_DATE - INTERVAL '6 months', true),

  -- ========================================================================
  -- TEACHER 3 (Charlie) - Saxofoon - 12 UNIQUE slots
  -- ========================================================================
  -- Monday afternoon 14:00-17:00: 6 slots
  ('student-033@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 1, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-034@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 1, '14:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-035@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 1, '15:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-036@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 1, '15:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-037@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 1, '16:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-038@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 1, '16:30', CURRENT_DATE - INTERVAL '6 months', true),
  -- Friday morning 09:00-12:00: 6 slots
  ('student-039@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 5, '09:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-040@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 5, '09:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-041@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 5, '10:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-042@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 5, '10:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-043@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 5, '11:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-044@test.nl', 'teacher-charlie@test.nl', 'Saxofoon', 5, '11:30', CURRENT_DATE - INTERVAL '6 months', true),

  -- ========================================================================
  -- TEACHER 4 (Diana) - DJ / Beats (45 min lessons) - 8 UNIQUE slots
  -- ========================================================================
  -- Tuesday afternoon 14:00-17:00 (45 min = 4 lessons): 4 slots
  ('student-045@test.nl', 'teacher-diana@test.nl', 'DJ / Beats', 2, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-046@test.nl', 'teacher-diana@test.nl', 'DJ / Beats', 2, '14:45', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-047@test.nl', 'teacher-diana@test.nl', 'DJ / Beats', 2, '15:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-048@test.nl', 'teacher-diana@test.nl', 'DJ / Beats', 2, '16:15', CURRENT_DATE - INTERVAL '6 months', true),
  -- Thursday morning 09:00-12:00 (45 min = 4 lessons): 4 slots
  ('student-049@test.nl', 'teacher-diana@test.nl', 'DJ / Beats', 4, '09:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-050@test.nl', 'teacher-diana@test.nl', 'DJ / Beats', 4, '09:45', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-051@test.nl', 'teacher-diana@test.nl', 'DJ / Beats', 4, '10:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-052@test.nl', 'teacher-diana@test.nl', 'DJ / Beats', 4, '11:15', CURRENT_DATE - INTERVAL '6 months', true),

  -- ========================================================================
  -- TEACHER 6 (Frank) - Gitaar - 12 UNIQUE slots
  -- ========================================================================
  -- Wednesday morning 09:00-12:00: 6 slots
  ('student-053@test.nl', 'teacher-frank@test.nl', 'Gitaar', 3, '09:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-054@test.nl', 'teacher-frank@test.nl', 'Gitaar', 3, '09:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-055@test.nl', 'teacher-frank@test.nl', 'Gitaar', 3, '10:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-056@test.nl', 'teacher-frank@test.nl', 'Gitaar', 3, '10:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-057@test.nl', 'teacher-frank@test.nl', 'Gitaar', 3, '11:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-058@test.nl', 'teacher-frank@test.nl', 'Gitaar', 3, '11:30', CURRENT_DATE - INTERVAL '6 months', true),
  -- Friday afternoon 14:00-17:00: 6 slots
  ('student-059@test.nl', 'teacher-frank@test.nl', 'Gitaar', 5, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-060@test.nl', 'teacher-frank@test.nl', 'Gitaar', 5, '14:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-009@test.nl', 'teacher-frank@test.nl', 'Gitaar', 5, '15:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-010@test.nl', 'teacher-frank@test.nl', 'Gitaar', 5, '15:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-011@test.nl', 'teacher-frank@test.nl', 'Gitaar', 5, '16:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-012@test.nl', 'teacher-frank@test.nl', 'Gitaar', 5, '16:30', CURRENT_DATE - INTERVAL '6 months', true),

  -- ========================================================================
  -- TEACHER 7 (Grace) - Drums - 12 UNIQUE slots
  -- ========================================================================
  -- Monday late morning 10:00-13:00: 6 slots
  ('student-013@test.nl', 'teacher-grace@test.nl', 'Drums', 1, '10:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-014@test.nl', 'teacher-grace@test.nl', 'Drums', 1, '10:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-021@test.nl', 'teacher-grace@test.nl', 'Drums', 1, '11:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-022@test.nl', 'teacher-grace@test.nl', 'Drums', 1, '11:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-023@test.nl', 'teacher-grace@test.nl', 'Drums', 1, '12:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-024@test.nl', 'teacher-grace@test.nl', 'Drums', 1, '12:30', CURRENT_DATE - INTERVAL '6 months', true),
  -- Thursday late morning 10:00-13:00: 6 slots
  ('student-025@test.nl', 'teacher-grace@test.nl', 'Drums', 4, '10:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-026@test.nl', 'teacher-grace@test.nl', 'Drums', 4, '10:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-027@test.nl', 'teacher-grace@test.nl', 'Drums', 4, '11:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-028@test.nl', 'teacher-grace@test.nl', 'Drums', 4, '11:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-029@test.nl', 'teacher-grace@test.nl', 'Drums', 4, '12:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-030@test.nl', 'teacher-grace@test.nl', 'Drums', 4, '12:30', CURRENT_DATE - INTERVAL '6 months', true),

  -- ========================================================================
  -- TEACHER 8 (Henry) - Zang - 12 UNIQUE slots
  -- ========================================================================
  -- Tuesday morning 09:00-12:00: 6 slots
  ('student-031@test.nl', 'teacher-henry@test.nl', 'Zang', 2, '09:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-032@test.nl', 'teacher-henry@test.nl', 'Zang', 2, '09:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-033@test.nl', 'teacher-henry@test.nl', 'Zang', 2, '10:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-034@test.nl', 'teacher-henry@test.nl', 'Zang', 2, '10:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-035@test.nl', 'teacher-henry@test.nl', 'Zang', 2, '11:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-036@test.nl', 'teacher-henry@test.nl', 'Zang', 2, '11:30', CURRENT_DATE - INTERVAL '6 months', true),
  -- Friday late morning 10:00-13:00: 6 slots
  ('student-037@test.nl', 'teacher-henry@test.nl', 'Zang', 5, '10:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-038@test.nl', 'teacher-henry@test.nl', 'Zang', 5, '10:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-039@test.nl', 'teacher-henry@test.nl', 'Zang', 5, '11:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-040@test.nl', 'teacher-henry@test.nl', 'Zang', 5, '11:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-041@test.nl', 'teacher-henry@test.nl', 'Zang', 5, '12:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-042@test.nl', 'teacher-henry@test.nl', 'Zang', 5, '12:30', CURRENT_DATE - INTERVAL '6 months', true),

  -- ========================================================================
  -- TEACHER 9 (Iris) - Bas - 12 UNIQUE slots
  -- ========================================================================
  -- Wednesday late morning 10:00-13:00: 6 slots
  ('student-043@test.nl', 'teacher-iris@test.nl', 'Bas', 3, '10:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-044@test.nl', 'teacher-iris@test.nl', 'Bas', 3, '10:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-045@test.nl', 'teacher-iris@test.nl', 'Bas', 3, '11:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-046@test.nl', 'teacher-iris@test.nl', 'Bas', 3, '11:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-047@test.nl', 'teacher-iris@test.nl', 'Bas', 3, '12:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-048@test.nl', 'teacher-iris@test.nl', 'Bas', 3, '12:30', CURRENT_DATE - INTERVAL '6 months', true),
  -- Thursday afternoon 14:00-17:00: 6 slots
  ('student-049@test.nl', 'teacher-iris@test.nl', 'Bas', 4, '14:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-050@test.nl', 'teacher-iris@test.nl', 'Bas', 4, '14:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-051@test.nl', 'teacher-iris@test.nl', 'Bas', 4, '15:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-052@test.nl', 'teacher-iris@test.nl', 'Bas', 4, '15:30', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-053@test.nl', 'teacher-iris@test.nl', 'Bas', 4, '16:00', CURRENT_DATE - INTERVAL '6 months', true),
  ('student-054@test.nl', 'teacher-iris@test.nl', 'Bas', 4, '16:30', CURRENT_DATE - INTERVAL '6 months', true)

  -- ========================================================================
  -- NOTE: Teacher 10 (Jack) has NO lesson agreements (no students)
  -- ========================================================================
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
