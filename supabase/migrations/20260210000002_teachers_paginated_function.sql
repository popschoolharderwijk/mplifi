-- Function to get paginated teachers with all related data in a single query
-- Uses shared views and COUNT(*) OVER() for efficient pagination

CREATE OR REPLACE FUNCTION get_teachers_paginated(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all', -- 'all', 'active', 'inactive'
  p_lesson_type_id UUID DEFAULT NULL,
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
    WHEN 'status' THEN 'is_active'
    WHEN 'created_at' THEN 'created_at'
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
    WITH     teacher_base AS (
      -- Get base teacher data with profile using shared view
      -- Apply RLS: teachers can only see their own record, staff/admin can see all
      SELECT
        t.id,
        t.user_id,
        t.bio,
        t.is_active,
        t.created_at,
        t.updated_at,
        p.email,
        p.first_name,
        p.last_name,
        p.phone_number,
        p.avatar_url,
        p.display_name
      FROM teachers t
      INNER JOIN view_profiles_with_display_name p ON t.user_id = p.user_id
      WHERE (
        -- RLS: teachers can only see their own record, staff/admin can see all
        t.user_id = (SELECT auth.uid())
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
    teacher_lesson_types_data AS (
      -- Get lesson types for all teachers
      SELECT
        tlt.teacher_id,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', lt.id,
            'name', lt.name,
            'icon', lt.icon,
            'color', lt.color
          )
          ORDER BY lt.name
        ) AS lesson_types
      FROM teacher_lesson_types tlt
      INNER JOIN lesson_types lt ON tlt.lesson_type_id = lt.id
      INNER JOIN teacher_base tb ON tlt.teacher_id = tb.id
      GROUP BY tlt.teacher_id
    ),
    filtered_teachers AS (
      -- Apply status and lesson type filters
      SELECT
        tb.*,
        COALESCE(tlt.lesson_types, '[]'::JSON) AS lesson_types_json
      FROM teacher_base tb
      LEFT JOIN teacher_lesson_types_data tlt ON tb.id = tlt.teacher_id
      WHERE (
        -- Status filter
        $2 = 'all'
        OR ($2 = 'active' AND tb.is_active = TRUE)
        OR ($2 = 'inactive' AND tb.is_active = FALSE)
      )
      AND (
        -- Lesson type filter
        $3 IS NULL
        OR EXISTS (
          SELECT 1 FROM teacher_lesson_types tlt2
          WHERE tlt2.teacher_id = tb.id
          AND tlt2.lesson_type_id = $3
        )
      )
    ),
    paginated_teachers AS (
      -- Apply sorting, pagination, and get total count in one pass
      SELECT
        ft.*,
        COUNT(*) OVER () AS total_count
      FROM filtered_teachers ft
      ORDER BY %I %s NULLS LAST, display_name ASC, id ASC
      LIMIT $4
      OFFSET $5
    )
    SELECT JSON_BUILD_OBJECT(
      'data', COALESCE(
        (SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', pt.id,
            'user_id', pt.user_id,
            'bio', pt.bio,
            'is_active', pt.is_active,
            'created_at', pt.created_at,
            'updated_at', pt.updated_at,
            'profile', JSON_BUILD_OBJECT(
              'email', pt.email,
              'first_name', pt.first_name,
              'last_name', pt.last_name,
              'phone_number', pt.phone_number,
              'avatar_url', pt.avatar_url
            ),
            'lesson_types', pt.lesson_types_json
          )
        ) FROM paginated_teachers pt),
        '[]'::JSON
      ),
      'total_count', COALESCE((SELECT total_count FROM paginated_teachers LIMIT 1), 0),
      'limit', $4,
      'offset', $5
    )
  $q$, v_sort_column, v_sort_direction);

  -- Execute with parameters
  EXECUTE v_query
  INTO v_result
  USING v_search_pattern, p_status, p_lesson_type_id, p_limit, p_offset;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_teachers_paginated TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_teachers_paginated IS 'Get paginated teachers with all related data (profile, lesson types) in a single efficient query. Supports search, status filter, lesson type filter, and sorting. Uses COUNT(*) OVER() for efficient total count and dynamic SQL for optimized sorting.';
