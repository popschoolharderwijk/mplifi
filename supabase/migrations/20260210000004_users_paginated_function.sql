-- Function to get paginated users with all related data in a single query
-- Uses shared views and COUNT(*) OVER() for efficient pagination

CREATE OR REPLACE FUNCTION get_users_paginated(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL, -- Filter by role: 'site_admin', 'admin', 'staff', or 'none' (no role)
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
    WHEN 'email' THEN 'email'
    WHEN 'phone_number' THEN 'phone_number'
    WHEN 'role' THEN 'role'
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
    WITH user_base AS (
      -- Get base user data with profile and role
      -- Apply RLS: only admin/site_admin can see all users
      SELECT
        p.user_id,
        p.email,
        p.first_name,
        p.last_name,
        p.phone_number,
        p.avatar_url,
        p.created_at,
        p.display_name,
        ur.role
      FROM view_profiles_with_display_name p
      LEFT JOIN user_roles ur ON p.user_id = ur.user_id
      WHERE (
        -- RLS: only admin/site_admin can see all users
        public.is_admin((SELECT auth.uid()))
        OR public.is_site_admin((SELECT auth.uid()))
      )
      AND (
        -- Search filter
        $1 IS NULL
        OR LOWER(p.email) LIKE $1
        OR LOWER(COALESCE(p.first_name, '')) LIKE $1
        OR LOWER(COALESCE(p.last_name, '')) LIKE $1
        OR LOWER(COALESCE(p.phone_number, '')) LIKE $1
        OR LOWER(p.display_name) LIKE $1
      )
    ),
    filtered_users AS (
      -- Apply role filter
      SELECT
        ub.*
      FROM user_base ub
      WHERE (
        -- Role filter
        $2 IS NULL
        OR ($2 = 'none' AND ub.role IS NULL)
        OR ($2 != 'none' AND ub.role::TEXT = $2)
      )
    ),
    paginated_users AS (
      -- Apply sorting, pagination, and get total count in one pass
      SELECT
        fu.*,
        COUNT(*) OVER () AS total_count
      FROM filtered_users fu
      ORDER BY %I %s NULLS LAST, display_name ASC, user_id ASC
      LIMIT $3
      OFFSET $4
    )
    SELECT JSON_BUILD_OBJECT(
      'data', COALESCE(
        (SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'user_id', pu.user_id,
            'email', pu.email,
            'first_name', pu.first_name,
            'last_name', pu.last_name,
            'phone_number', pu.phone_number,
            'avatar_url', pu.avatar_url,
            'created_at', pu.created_at,
            'role', pu.role
          )
        ) FROM paginated_users pu),
        '[]'::JSON
      ),
      'total_count', COALESCE((SELECT total_count FROM paginated_users LIMIT 1), 0),
      'limit', $3,
      'offset', $4
    )
  $q$, v_sort_column, v_sort_direction);

  -- Execute with parameters
  EXECUTE v_query
  INTO v_result
  USING v_search_pattern, p_role, p_limit, p_offset;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_users_paginated TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_users_paginated IS 'Get paginated users with all related data (profile, role) in a single efficient query. Supports search, role filter, and sorting. Uses COUNT(*) OVER() for efficient total count and dynamic SQL for optimized sorting. Only admin/site_admin can access this function.';
