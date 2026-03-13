-- ============================================================
-- Extend get_hours_report to include project hours
-- ============================================================
-- Project events are stored in agenda_events with source_type='project'.
-- They can be single or recurring. Duration is derived from start_time/end_time.
-- Project rows have source_type='project', no lesson_type or age_category.

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
  -- ===================== LESSON HOURS =====================
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
      d.occurrence_date
    FROM lesson_agreements la
    CROSS JOIN LATERAL (
      SELECT gs::date AS occurrence_date
      FROM generate_series(
        GREATEST(la.start_date, p_start_date),
        LEAST(COALESCE(la.end_date, p_end_date), p_end_date),
        INTERVAL '1 day'
      ) AS gs
    ) d
    WHERE
      EXTRACT(DOW FROM d.occurrence_date) = la.day_of_week
      AND (p_teacher_user_id IS NULL OR la.teacher_user_id = p_teacher_user_id)
      AND (
        la.frequency = 'daily'
        OR la.frequency = 'weekly'
        OR (la.frequency = 'biweekly' AND MOD(((d.occurrence_date - la.start_date)::INT), 14) = 0)
        OR (la.frequency = 'monthly' AND MOD(((d.occurrence_date - la.start_date)::INT), 28) = 0)
      )
  ),
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
  enriched_lessons AS (
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
  aggregated_lessons AS (
    SELECT
      e.teacher_user_id,
      e.lesson_type_id,
      e.age_category,
      SUM(e.duration_minutes) AS total_minutes,
      COUNT(*) AS lesson_count
    FROM enriched_lessons e
    GROUP BY e.teacher_user_id, e.lesson_type_id, e.age_category
  ),
  lesson_rows AS (
    SELECT
      json_build_object(
        'source_type', 'lesson',
        'teacher_user_id', a.teacher_user_id,
        'teacher_name', COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, p.email),
        'lesson_type_id', a.lesson_type_id,
        'lesson_type_name', lt.name,
        'lesson_type_color', lt.color,
        'lesson_type_icon', lt.icon,
        'age_category', a.age_category,
        'total_minutes', a.total_minutes,
        'lesson_count', a.lesson_count,
        'project_id', NULL,
        'project_name', NULL
      ) AS row_json,
      COALESCE(p.first_name || ' ' || p.last_name, p.email) AS sort_name,
      lt.name AS sort_category_name,
      a.age_category AS sort_age
    FROM aggregated_lessons a
    INNER JOIN teachers t ON a.teacher_user_id = t.user_id
    INNER JOIN profiles p ON t.user_id = p.user_id
    INNER JOIN lesson_types lt ON a.lesson_type_id = lt.id
  ),

  -- ===================== PROJECT HOURS =====================
  -- Single (non-recurring) project events in range
  project_single_events AS (
    SELECT
      ae.id AS event_id,
      ae.source_id AS project_id,
      ae.start_date AS occurrence_date,
      ae.start_time,
      ae.end_time
    FROM agenda_events ae
    WHERE ae.source_type = 'project'
      AND ae.recurring = false
      AND ae.start_date BETWEEN p_start_date AND p_end_date
      AND ae.end_time IS NOT NULL
  ),
  -- Recurring project events: generate occurrences
  project_recurring_events AS (
    SELECT
      ae.id AS event_id,
      ae.source_id AS project_id,
      d.occurrence_date,
      ae.start_time,
      ae.end_time
    FROM agenda_events ae
    CROSS JOIN LATERAL (
      SELECT gs::date AS occurrence_date
      FROM generate_series(
        GREATEST(ae.start_date, p_start_date),
        LEAST(COALESCE(ae.recurring_end_date, COALESCE(ae.end_date, p_end_date)), p_end_date),
        CASE ae.recurring_frequency
          WHEN 'daily' THEN INTERVAL '1 day'
          WHEN 'weekly' THEN INTERVAL '7 days'
          WHEN 'biweekly' THEN INTERVAL '14 days'
          WHEN 'monthly' THEN INTERVAL '28 days'
          ELSE INTERVAL '7 days'
        END
      ) AS gs
    ) d
    WHERE ae.source_type = 'project'
      AND ae.recurring = true
      AND ae.end_time IS NOT NULL
  ),
  all_project_occurrences AS (
    SELECT * FROM project_single_events
    UNION ALL
    SELECT * FROM project_recurring_events
  ),
  -- Filter out cancelled deviations for project events
  non_cancelled_project_occurrences AS (
    SELECT apo.*
    FROM all_project_occurrences apo
    WHERE NOT EXISTS (
      SELECT 1
      FROM agenda_event_deviations d
      WHERE d.event_id = apo.event_id
        AND d.is_cancelled = true
        AND (
          (d.recurring = false AND d.original_date = apo.occurrence_date)
          OR
          (d.recurring = true
           AND d.original_date <= apo.occurrence_date
           AND (d.recurring_end_date IS NULL OR d.recurring_end_date >= apo.occurrence_date)
           AND NOT EXISTS (
             SELECT 1
             FROM agenda_event_deviations override_dev
             WHERE override_dev.event_id = apo.event_id
               AND override_dev.recurring = false
               AND override_dev.original_date = apo.occurrence_date
               AND override_dev.is_cancelled = false
           )
          )
        )
    )
  ),
  -- Join with participants (only teachers) and project metadata
  enriched_projects AS (
    SELECT
      ap.user_id AS teacher_user_id,
      ncpo.project_id,
      proj.name AS project_name,
      EXTRACT(EPOCH FROM (ncpo.end_time - ncpo.start_time)) / 60 AS duration_minutes
    FROM non_cancelled_project_occurrences ncpo
    INNER JOIN agenda_participants ap ON ap.event_id = ncpo.event_id
    INNER JOIN teachers t ON t.user_id = ap.user_id
    INNER JOIN projects proj ON proj.id = ncpo.project_id
    WHERE (p_teacher_user_id IS NULL OR ap.user_id = p_teacher_user_id)
  ),
  -- Aggregate project hours per teacher + project
  aggregated_projects AS (
    SELECT
      ep.teacher_user_id,
      ep.project_id,
      ep.project_name,
      SUM(ep.duration_minutes)::BIGINT AS total_minutes,
      COUNT(*) AS event_count
    FROM enriched_projects ep
    GROUP BY ep.teacher_user_id, ep.project_id, ep.project_name
  ),
  project_rows AS (
    SELECT
      json_build_object(
        'source_type', 'project',
        'teacher_user_id', ap.teacher_user_id,
        'teacher_name', COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, p.email),
        'lesson_type_id', NULL,
        'lesson_type_name', NULL,
        'lesson_type_color', NULL,
        'lesson_type_icon', NULL,
        'age_category', 'unknown',
        'total_minutes', ap.total_minutes,
        'lesson_count', ap.event_count,
        'project_id', ap.project_id,
        'project_name', ap.project_name
      ) AS row_json,
      COALESCE(p.first_name || ' ' || p.last_name, p.email) AS sort_name,
      ap.project_name AS sort_category_name,
      'unknown' AS sort_age
    FROM aggregated_projects ap
    INNER JOIN profiles p ON ap.teacher_user_id = p.user_id
  ),

  -- ===================== COMBINE =====================
  all_rows AS (
    SELECT row_json, sort_name, sort_category_name, sort_age FROM lesson_rows
    UNION ALL
    SELECT row_json, sort_name, sort_category_name, sort_age FROM project_rows
  )
  SELECT json_build_object(
    'data', COALESCE(
      (SELECT json_agg(r.row_json ORDER BY r.sort_name, r.sort_category_name, r.sort_age)
       FROM all_rows r),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;