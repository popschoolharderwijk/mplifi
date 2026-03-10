-- Create the hours report function
-- SECURITY INVOKER: runs as caller so RLS on lesson_agreements, students, teachers applies.
CREATE OR REPLACE FUNCTION public.get_hours_report(
  p_start_date date,
  p_end_date date,
  p_teacher_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH
  -- Generate all occurrences of lesson agreements within the date range (RLS filters by role)
  agreement_occurrences AS (
    SELECT
      la.id AS agreement_id,
      la.teacher_user_id,
      la.lesson_type_id,
      la.student_user_id,
      la.duration_minutes,
      la.day_of_week,
      la.frequency,
      la.start_date,
      la.end_date,
      la.start_time,
      -- Generate the series of dates for this agreement
      d.occurrence_date
    FROM lesson_agreements la
    CROSS JOIN LATERAL (
      SELECT gs::date AS occurrence_date
      FROM generate_series(
        -- Start from the later of agreement start_date or p_start_date, aligned to the correct day_of_week
        GREATEST(la.start_date, p_start_date),
        -- End at the earlier of agreement end_date or p_end_date
        LEAST(COALESCE(la.end_date, p_end_date), p_end_date),
        INTERVAL '1 day'
      ) AS gs
    ) d
    WHERE
      -- Filter to correct day_of_week (0=Sunday in app, extract dow: 0=Sunday)
      EXTRACT(DOW FROM d.occurrence_date) = la.day_of_week
      -- Optional filter by teacher (staff can pass a teacher_user_id; teachers only see own data via RLS)
      AND (p_teacher_user_id IS NULL OR la.teacher_user_id = p_teacher_user_id)
      -- Apply frequency filter
      AND (
        la.frequency = 'daily'
        OR la.frequency = 'weekly'
        OR (la.frequency = 'biweekly' AND (
          -- Every 2 weeks from start_date
          MOD(((d.occurrence_date - la.start_date)::INT), 14) = 0
        ))
        OR (la.frequency = 'monthly' AND (
          -- Same day_of_week, check if it's roughly every 4 weeks
          MOD(((d.occurrence_date - la.start_date)::INT), 28) = 0
        ))
      )
  ),
  -- Filter out cancelled deviations (agenda_event_deviations linked via agenda_events.source_id = agreement_id)
  non_cancelled_occurrences AS (
    SELECT ao.*
    FROM agreement_occurrences ao
    WHERE NOT EXISTS (
      SELECT 1
      FROM agenda_events ae
      JOIN agenda_event_deviations lad ON lad.event_id = ae.id
      WHERE ae.source_type = 'lesson_agreement'
        AND ae.source_id = ao.agreement_id
        AND lad.is_cancelled = true
        AND (
          (lad.recurring = false AND lad.original_date = ao.occurrence_date)
          OR
          (lad.recurring = true
           AND lad.original_date <= ao.occurrence_date
           AND (lad.recurring_end_date IS NULL OR lad.recurring_end_date >= ao.occurrence_date)
           AND NOT EXISTS (
             SELECT 1
             FROM agenda_events ae2
             JOIN agenda_event_deviations override ON override.event_id = ae2.id
             WHERE ae2.source_type = 'lesson_agreement'
               AND ae2.source_id = ao.agreement_id
               AND override.recurring = false
               AND override.original_date = ao.occurrence_date
               AND override.is_cancelled = false
           )
          )
        )
    )
  ),
  -- Join with student data for age calculation and teacher/lesson type info
  enriched AS (
    SELECT
      nco.teacher_user_id,
      nco.lesson_type_id,
      nco.duration_minutes,
      nco.occurrence_date,
      CASE
        WHEN s.date_of_birth IS NOT NULL THEN
          CASE
            WHEN AGE(nco.occurrence_date, s.date_of_birth) >= INTERVAL '18 years'
            THEN '18_plus'
            ELSE 'under_18'
          END
        ELSE 'unknown'
      END AS age_category
    FROM non_cancelled_occurrences nco
    LEFT JOIN students s ON s.user_id = nco.student_user_id
  ),
  -- Aggregate per teacher, lesson type, age category
  aggregated AS (
    SELECT
      e.teacher_user_id,
      e.lesson_type_id,
      e.age_category,
      SUM(e.duration_minutes) AS total_minutes,
      COUNT(*) AS lesson_count
    FROM enriched e
    GROUP BY e.teacher_user_id, e.lesson_type_id, e.age_category
  )
  SELECT json_build_object(
    'data', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'teacher_user_id', a.teacher_user_id,
          'teacher_name', COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, p.email),
          'lesson_type_id', a.lesson_type_id,
          'lesson_type_name', lt.name,
          'lesson_type_color', lt.color,
          'lesson_type_icon', lt.icon,
          'age_category', a.age_category,
          'total_minutes', a.total_minutes,
          'lesson_count', a.lesson_count
        )
        ORDER BY COALESCE(p.first_name || ' ' || p.last_name, p.email), lt.name, a.age_category
      )
      FROM aggregated a
      INNER JOIN teachers t ON a.teacher_user_id = t.user_id
      INNER JOIN profiles p ON t.user_id = p.user_id
      INNER JOIN lesson_types lt ON a.lesson_type_id = lt.id
      ),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
