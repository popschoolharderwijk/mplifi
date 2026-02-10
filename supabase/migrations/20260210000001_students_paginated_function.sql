-- Function to get paginated students with all related data in a single query
-- This replaces multiple round-trips to the database with a single efficient query

CREATE OR REPLACE FUNCTION get_students_paginated(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all', -- 'all', 'active', 'inactive'
  p_lesson_type_id UUID DEFAULT NULL,
  p_teacher_id UUID DEFAULT NULL, -- Filter by teacher (for MyStudents page)
  p_sort_column TEXT DEFAULT 'name',
  p_sort_direction TEXT DEFAULT 'asc'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_search_pattern TEXT;
  v_sort_column TEXT;
  v_sort_direction TEXT;
  v_query TEXT;
BEGIN
  -- Validate and whitelist sort column
  v_sort_column := CASE p_sort_column
    WHEN 'name' THEN 'display_name'
    WHEN 'phone_number' THEN 'phone_number'
    WHEN 'status' THEN 'active_agreements_count'
    WHEN 'agreements' THEN 'active_agreements_count'
    ELSE 'display_name'
  END;

  -- Validate sort direction
  v_sort_direction := CASE LOWER(p_sort_direction)
    WHEN 'desc' THEN 'DESC'
    ELSE 'ASC'
  END;

  -- Prepare search pattern
  v_search_pattern := CASE
    WHEN p_search IS NOT NULL AND p_search != ''
    THEN '%' || LOWER(p_search) || '%'
    ELSE NULL
  END;

  -- Build and execute dynamic query
  -- Using COUNT(*) OVER() to get total count in the same query pass
  v_query := format($q$
    WITH     student_base AS (
      -- Get base student data with profile using shared view
      -- Apply RLS: students can only see their own record, staff/admin can see all
      SELECT
        s.id,
        s.user_id,
        s.parent_name,
        s.parent_email,
        s.parent_phone_number,
        s.debtor_info_same_as_student,
        s.debtor_name,
        s.debtor_address,
        s.debtor_postal_code,
        s.debtor_city,
        s.created_at,
        s.updated_at,
        p.email,
        p.first_name,
        p.last_name,
        p.phone_number,
        p.avatar_url,
        p.display_name
      FROM students s
      INNER JOIN view_profiles_with_display_name p ON s.user_id = p.user_id
      WHERE (
        -- RLS: students can only see their own record, staff/admin can see all
        s.user_id = (SELECT auth.uid())
        OR public.is_privileged((SELECT auth.uid()))
      )
      AND (
        $1 IS NULL
        OR LOWER(p.email) LIKE $1
        OR LOWER(COALESCE(p.first_name, '')) LIKE $1
        OR LOWER(COALESCE(p.last_name, '')) LIKE $1
        OR LOWER(COALESCE(p.phone_number, '')) LIKE $1
        OR LOWER(p.display_name) LIKE $1
      )
    ),
    student_agreements AS (
      -- Get all agreements for these students with teacher and lesson type info
      SELECT
        la.student_user_id,
        la.id AS agreement_id,
        la.teacher_id,
        la.day_of_week,
        la.start_time,
        la.start_date,
        la.end_date,
        la.is_active,
        la.notes,
        lt.id AS lesson_type_id,
        lt.name AS lesson_type_name,
        lt.icon AS lesson_type_icon,
        lt.color AS lesson_type_color,
        tp.first_name AS teacher_first_name,
        tp.last_name AS teacher_last_name,
        tp.avatar_url AS teacher_avatar_url
      FROM lesson_agreements la
      INNER JOIN student_base sb ON la.student_user_id = sb.user_id
      INNER JOIN teachers t ON la.teacher_id = t.id
      INNER JOIN view_profiles_with_display_name tp ON t.user_id = tp.user_id
      INNER JOIN lesson_types lt ON la.lesson_type_id = lt.id
      WHERE (
        -- Teacher filter: if specified, only get agreements for that teacher
        $4 IS NULL
        OR la.teacher_id = $4
      )
    ),
    student_active_counts AS (
      -- Count active agreements per student
      SELECT
        student_user_id,
        COUNT(*) FILTER (WHERE is_active = TRUE) AS active_count
      FROM student_agreements
      GROUP BY student_user_id
    ),
    filtered_students AS (
      -- Apply status and lesson type filters
      SELECT
        sb.*,
        COALESCE(sac.active_count, 0)::INT AS active_agreements_count
      FROM student_base sb
      LEFT JOIN student_active_counts sac ON sb.user_id = sac.student_user_id
      WHERE (
        -- Status filter
        $2 = 'all'
        OR ($2 = 'active' AND COALESCE(sac.active_count, 0) > 0)
        OR ($2 = 'inactive' AND COALESCE(sac.active_count, 0) = 0)
      )
      AND (
        -- Lesson type filter
        $3 IS NULL
        OR EXISTS (
          SELECT 1 FROM student_agreements sa
          WHERE sa.student_user_id = sb.user_id
          AND sa.lesson_type_id = $3
        )
      )
      AND (
        -- Teacher filter
        $4 IS NULL
        OR EXISTS (
          SELECT 1 FROM student_agreements sa
          WHERE sa.student_user_id = sb.user_id
          AND sa.teacher_id = $4
        )
      )
    ),
    paginated_students AS (
      -- Apply sorting, pagination, and get total count in one pass
      SELECT
        fs.*,
        COUNT(*) OVER () AS total_count
      FROM filtered_students fs
      ORDER BY %I %s NULLS LAST, display_name ASC, id ASC
      LIMIT $5
      OFFSET $6
    ),
    students_with_agreements AS (
      SELECT
        ps.id,
        ps.user_id,
        ps.parent_name,
        ps.parent_email,
        ps.parent_phone_number,
        ps.debtor_info_same_as_student,
        ps.debtor_name,
        ps.debtor_address,
        ps.debtor_postal_code,
        ps.debtor_city,
        ps.created_at,
        ps.updated_at,
        ps.active_agreements_count,
        ps.total_count,
        JSON_BUILD_OBJECT(
          'email', ps.email,
          'first_name', ps.first_name,
          'last_name', ps.last_name,
          'phone_number', ps.phone_number,
          'avatar_url', ps.avatar_url
        ) AS profile,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', sa.agreement_id,
                'day_of_week', sa.day_of_week,
                'start_time', sa.start_time,
                'start_date', sa.start_date,
                'end_date', sa.end_date,
                'is_active', sa.is_active,
                'notes', sa.notes,
                'teacher', JSON_BUILD_OBJECT(
                  'first_name', sa.teacher_first_name,
                  'last_name', sa.teacher_last_name,
                  'avatar_url', sa.teacher_avatar_url
                ),
                'lesson_type', JSON_BUILD_OBJECT(
                  'id', sa.lesson_type_id,
                  'name', sa.lesson_type_name,
                  'icon', sa.lesson_type_icon,
                  'color', sa.lesson_type_color
                )
              )
              ORDER BY sa.day_of_week, sa.start_time
            )
            FROM student_agreements sa
            WHERE sa.student_user_id = ps.user_id
          ),
          '[]'::JSON
        ) AS agreements
      FROM paginated_students ps
    )
    SELECT JSON_BUILD_OBJECT(
      'data', COALESCE(
        (SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', swa.id,
            'user_id', swa.user_id,
            'parent_name', swa.parent_name,
            'parent_email', swa.parent_email,
            'parent_phone_number', swa.parent_phone_number,
            'debtor_info_same_as_student', swa.debtor_info_same_as_student,
            'debtor_name', swa.debtor_name,
            'debtor_address', swa.debtor_address,
            'debtor_postal_code', swa.debtor_postal_code,
            'debtor_city', swa.debtor_city,
            'created_at', swa.created_at,
            'updated_at', swa.updated_at,
            'active_agreements_count', swa.active_agreements_count,
            'profile', swa.profile,
            'agreements', swa.agreements
          )
        ) FROM students_with_agreements swa),
        '[]'::JSON
      ),
      'total_count', COALESCE((SELECT total_count FROM students_with_agreements LIMIT 1), 0),
      'limit', $5,
      'offset', $6
    )
  $q$, v_sort_column, v_sort_direction);

  -- Execute with parameters
  EXECUTE v_query
  INTO v_result
  USING v_search_pattern, p_status, p_lesson_type_id, p_teacher_id, p_limit, p_offset;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_students_paginated TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_students_paginated IS 'Get paginated students with all related data (profile, agreements, teachers, lesson types) in a single efficient query. Supports search, status filter, lesson type filter, and sorting. Uses COUNT(*) OVER() for efficient total count and dynamic SQL for optimized sorting.';
