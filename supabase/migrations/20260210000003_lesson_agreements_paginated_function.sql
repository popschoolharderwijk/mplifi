-- Function to get paginated lesson agreements with all related data in a single query
-- Uses shared views and COUNT(*) OVER() for efficient pagination

CREATE OR REPLACE FUNCTION get_lesson_agreements_paginated(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_student_user_id UUID DEFAULT NULL,
  p_teacher_id UUID DEFAULT NULL,
  p_lesson_type_id UUID DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_sort_column TEXT DEFAULT 'start_date',
  p_sort_direction TEXT DEFAULT 'desc'
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
    WHEN 'student_name' THEN 'student_display_name'
    WHEN 'teacher_name' THEN 'teacher_display_name'
    WHEN 'lesson_type' THEN 'lesson_type_name'
    WHEN 'day_of_week' THEN 'day_of_week'
    WHEN 'start_time' THEN 'start_time'
    WHEN 'start_date' THEN 'start_date'
    WHEN 'is_active' THEN 'is_active'
    ELSE 'start_date'
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
    WITH     agreement_base AS (
      -- Get base agreement data with all related entities
      -- Apply RLS: students see only their own, teachers see only where they are teacher, staff/admin see all
      SELECT
        la.id,
        la.student_user_id,
        la.teacher_id,
        la.lesson_type_id,
        la.day_of_week,
        la.start_time,
        la.start_date,
        la.end_date,
        la.is_active,
        la.notes,
        la.created_at,
        la.updated_at,
        -- Student profile data
        sp.user_id AS student_user_id_profile,
        sp.email AS student_email,
        sp.first_name AS student_first_name,
        sp.last_name AS student_last_name,
        sp.avatar_url AS student_avatar_url,
        sp.display_name AS student_display_name,
        -- Teacher profile data
        tp.user_id AS teacher_user_id_profile,
        tp.first_name AS teacher_first_name,
        tp.last_name AS teacher_last_name,
        tp.avatar_url AS teacher_avatar_url,
        tp.display_name AS teacher_display_name,
        -- Lesson type data
        lt.name AS lesson_type_name,
        lt.icon AS lesson_type_icon,
        lt.color AS lesson_type_color
      FROM lesson_agreements la
      INNER JOIN view_profiles_with_display_name sp ON la.student_user_id = sp.user_id
      INNER JOIN teachers t ON la.teacher_id = t.id
      INNER JOIN view_profiles_with_display_name tp ON t.user_id = tp.user_id
      INNER JOIN lesson_types lt ON la.lesson_type_id = lt.id
      WHERE (
        -- RLS: students see only their own, teachers see only where they are teacher, staff/admin see all
        la.student_user_id = (SELECT auth.uid())
        OR la.teacher_id = public.get_teacher_id((SELECT auth.uid()))
        OR public.is_privileged((SELECT auth.uid()))
      )
      AND (
        -- Search filter (on student or teacher name/email)
        $1 IS NULL
        OR LOWER(sp.display_name) LIKE $1
        OR LOWER(sp.email) LIKE $1
        OR LOWER(tp.display_name) LIKE $1
        OR LOWER(tp.email) LIKE $1
      )
      AND (
        -- Student filter
        $2 IS NULL
        OR la.student_user_id = $2
      )
      AND (
        -- Teacher filter
        $3 IS NULL
        OR la.teacher_id = $3
      )
      AND (
        -- Lesson type filter
        $4 IS NULL
        OR la.lesson_type_id = $4
      )
      AND (
        -- Active status filter
        $5 IS NULL
        OR la.is_active = $5
      )
    ),
    paginated_agreements AS (
      -- Apply sorting, pagination, and get total count in one pass
      SELECT
        ab.*,
        COUNT(*) OVER () AS total_count
      FROM agreement_base ab
      ORDER BY %I %s NULLS LAST, start_date DESC, day_of_week ASC, start_time ASC, id ASC
      LIMIT $6
      OFFSET $7
    )
    SELECT JSON_BUILD_OBJECT(
      'data', COALESCE(
        (SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', pa.id,
            'student_user_id', pa.student_user_id,
            'teacher_id', pa.teacher_id,
            'lesson_type_id', pa.lesson_type_id,
            'day_of_week', pa.day_of_week,
            'start_time', pa.start_time,
            'start_date', pa.start_date,
            'end_date', pa.end_date,
            'is_active', pa.is_active,
            'notes', pa.notes,
            'created_at', pa.created_at,
            'updated_at', pa.updated_at,
            'student', JSON_BUILD_OBJECT(
              'user_id', pa.student_user_id_profile,
              'email', pa.student_email,
              'first_name', pa.student_first_name,
              'last_name', pa.student_last_name,
              'avatar_url', pa.student_avatar_url,
              'display_name', pa.student_display_name
            ),
            'teacher', JSON_BUILD_OBJECT(
              'user_id', pa.teacher_user_id_profile,
              'first_name', pa.teacher_first_name,
              'last_name', pa.teacher_last_name,
              'avatar_url', pa.teacher_avatar_url,
              'display_name', pa.teacher_display_name
            ),
            'lesson_type', JSON_BUILD_OBJECT(
              'id', pa.lesson_type_id,
              'name', pa.lesson_type_name,
              'icon', pa.lesson_type_icon,
              'color', pa.lesson_type_color
            )
          )
        ) FROM paginated_agreements pa),
        '[]'::JSON
      ),
      'total_count', COALESCE((SELECT total_count FROM paginated_agreements LIMIT 1), 0),
      'limit', $6,
      'offset', $7
    )
  $q$, v_sort_column, v_sort_direction);

  -- Execute with parameters
  EXECUTE v_query
  INTO v_result
  USING v_search_pattern, p_student_user_id, p_teacher_id, p_lesson_type_id, p_is_active, p_limit, p_offset;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_lesson_agreements_paginated TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_lesson_agreements_paginated IS 'Get paginated lesson agreements with all related data (student profile, teacher profile, lesson type) in a single efficient query. Supports search, filtering by student, teacher, lesson type, and active status, and sorting. Uses COUNT(*) OVER() for efficient total count and dynamic SQL for optimized sorting.';
