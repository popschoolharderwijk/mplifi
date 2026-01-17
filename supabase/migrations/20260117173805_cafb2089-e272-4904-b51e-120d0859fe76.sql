-- Recreate run_as_user to switch to authenticated role before executing
-- This ensures RLS is enforced because authenticated role has rolbypassrls = false
CREATE OR REPLACE FUNCTION public.run_as_user(_user_id uuid, _query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  result JSONB;
  normalized_query TEXT;
BEGIN
  -- Input validation: user_id
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'run_as_user: _user_id cannot be NULL';
  END IF;

  -- Input validation: query
  IF _query IS NULL OR trim(_query) = '' THEN
    RAISE EXCEPTION 'run_as_user: _query cannot be NULL or empty';
  END IF;

  -- Normalize query for pattern matching
  normalized_query := upper(trim(_query));

  -- STRICT: Only SELECT statements are allowed
  IF normalized_query !~* '^\s*SELECT\s' THEN
    RAISE EXCEPTION 'run_as_user: Only SELECT statements are allowed';
  END IF;

  -- Defense-in-depth: Block dangerous patterns even within SELECT
  IF normalized_query ~* '\b(INTO\s+|SET\s+|DO\s+\$|COPY\s+|PG_READ_FILE|PG_WRITE_FILE|LO_IMPORT|LO_EXPORT)\b' THEN
    RAISE EXCEPTION 'run_as_user: Query contains blocked pattern';
  END IF;

  -- Inject JWT claims to simulate the specified user
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', _user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );

  -- Switch to authenticated role which does NOT bypass RLS
  -- This is the key change: SET LOCAL ROLE is transaction-scoped
  SET LOCAL ROLE authenticated;

  -- Execute the query - RLS will now be enforced
  BEGIN
    EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', _query)
    INTO result;
  EXCEPTION
    WHEN OTHERS THEN
      -- Reset role before raising
      RESET ROLE;
      RAISE EXCEPTION 'run_as_user: Query execution failed - % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;

  -- Reset role after execution
  RESET ROLE;

  RETURN result;
END;
$$;

-- Revoke public access, only service_role can call this
REVOKE ALL ON FUNCTION public.run_as_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_as_user(uuid, text) TO service_role;