-- ============================================================
-- Project Scheduling: polymorphic source_id support
-- ============================================================

-- 1. Drop old constraints and FK
ALTER TABLE public.agenda_events
  DROP CONSTRAINT IF EXISTS agenda_events_source_check;

ALTER TABLE public.agenda_events
  DROP CONSTRAINT IF EXISTS agenda_events_source_type_check;

ALTER TABLE public.agenda_events
  DROP CONSTRAINT IF EXISTS agenda_events_source_id_fkey;

-- 2. New check constraint (3 source types)
ALTER TABLE public.agenda_events
  ADD CONSTRAINT agenda_events_source_check CHECK (
    (source_type = 'manual' AND source_id IS NULL)
    OR (source_type = 'lesson_agreement' AND source_id IS NOT NULL)
    OR (source_type = 'project' AND source_id IS NOT NULL)
  );

-- 3. Validation trigger: verify source_id exists in the correct table
CREATE OR REPLACE FUNCTION public.validate_agenda_event_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.source_type = 'lesson_agreement' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.lesson_agreements WHERE id = NEW.source_id
    ) THEN
      RAISE EXCEPTION 'source_id % does not exist in lesson_agreements', NEW.source_id;
    END IF;

  ELSIF NEW.source_type = 'project' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects WHERE id = NEW.source_id
    ) THEN
      RAISE EXCEPTION 'source_id % does not exist in projects', NEW.source_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_agenda_event_source
  BEFORE INSERT OR UPDATE ON public.agenda_events
  FOR EACH ROW
  WHEN (NEW.source_id IS NOT NULL)
  EXECUTE FUNCTION public.validate_agenda_event_source();

-- 4. Cascade-delete trigger function (reusable for multiple source tables)
CREATE OR REPLACE FUNCTION public.cascade_delete_agenda_events_for_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  DELETE FROM public.agenda_events
  WHERE source_id = OLD.id
    AND source_type = TG_ARGV[0];
  RETURN OLD;
END;
$$;

-- Cascade delete for projects
CREATE TRIGGER trg_cascade_delete_agenda_events_project
  BEFORE DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_delete_agenda_events_for_source('project');

-- Cascade delete for lesson_agreements (replaces old FK CASCADE)
CREATE TRIGGER trg_cascade_delete_agenda_events_lesson_agreement
  BEFORE DELETE ON public.lesson_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_delete_agenda_events_for_source('lesson_agreement');