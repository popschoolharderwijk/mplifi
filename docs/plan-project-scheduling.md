# Plan: Projectplanning in Agenda en Rapportage

## Samenvatting

Medewerkers, admins en site-admins kunnen tijdsloten plannen voor projecten, gekoppeld aan 1 of meer docenten en 1 of meer leerlingen. Dit kan vanuit de **Projecten-pagina** ("Tijdslot plannen") en vanuit de **Agenda** (nieuw event → bron "Project"). Geplande uren verschijnen in de agenda van deelnemers (docenten en leerlingen) en worden per docent per project getoond in de **Rapportage**.

### Kernprincipe

Project-tijdsloten hergebruiken het bestaande `agenda_events`-systeem. Een project-event is een `agenda_event` met `source_type = 'project'` en `source_id` verwijzend naar `projects.id`. Deelnemers worden via `agenda_participants` gekoppeld, identiek aan handmatige events en lessen.

---

## 1. Database-migratie

### 1a. `agenda_events` constraint en FK aanpassen

De huidige `source_id` FK verwijst naar `lesson_agreements(id)`. Omdat `source_id` nu polymorf is (kan verwijzen naar `lesson_agreements` of `projects`), wordt de harde FK vervangen door trigger-validatie.

```sql
-- ============================================================
-- Stap 1: Drop bestaande constraint en FK
-- ============================================================
ALTER TABLE public.agenda_events
  DROP CONSTRAINT IF EXISTS agenda_events_source_check;

ALTER TABLE public.agenda_events
  DROP CONSTRAINT IF EXISTS agenda_events_source_id_fkey;

-- ============================================================
-- Stap 2: Nieuwe CHECK constraint (3 source types)
-- ============================================================
ALTER TABLE public.agenda_events
  ADD CONSTRAINT agenda_events_source_check CHECK (
    (source_type = 'manual' AND source_id IS NULL)
    OR (source_type = 'lesson_agreement' AND source_id IS NOT NULL)
    OR (source_type = 'project' AND source_id IS NOT NULL)
  );
```

### 1b. Validatie-trigger voor `source_id`

Vervangt de harde FK. Controleert bij INSERT en UPDATE dat `source_id` bestaat in de juiste tabel.

```sql
CREATE OR REPLACE FUNCTION public.validate_agenda_event_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
```

### 1c. Cascade-delete triggers

Wanneer een project of lesson_agreement verwijderd wordt, moeten gerelateerde `agenda_events` ook opgeruimd worden (voorheen via FK CASCADE).

```sql
-- Cascade delete voor projects
CREATE OR REPLACE FUNCTION public.cascade_delete_agenda_events_for_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.agenda_events
  WHERE source_id = OLD.id
    AND source_type = TG_ARGV[0];
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cascade_delete_agenda_events_project
  BEFORE DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_delete_agenda_events_for_source('project');

CREATE TRIGGER trg_cascade_delete_agenda_events_lesson_agreement
  BEFORE DELETE ON public.lesson_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_delete_agenda_events_for_source('lesson_agreement');
```

### 1d. Rapportage-functie uitbreiden

De bestaande `get_hours_report` functie wordt uitgebreid met een CTE voor project-uren.

```sql
-- Pseudo-SQL voor de project-uren CTE (toe te voegen aan get_hours_report)
--
-- project_hours AS (
--   SELECT
--     ap.user_id AS teacher_user_id,
--     ae.source_id AS project_id,
--     p.name AS project_name,
--     p.cost_center,
--     ae.start_date,
--     ae.start_time,
--     ae.end_time,
--     -- Bereken duur in minuten
--     EXTRACT(EPOCH FROM (ae.end_time::time - ae.start_time::time)) / 60 AS duration_minutes
--   FROM agenda_events ae
--   JOIN agenda_participants ap ON ap.event_id = ae.id
--   JOIN projects p ON p.id = ae.source_id
--   LEFT JOIN teachers t ON t.user_id = ap.user_id
--   WHERE ae.source_type = 'project'
--     AND ae.start_date BETWEEN p_start_date AND p_end_date
--     AND t.user_id IS NOT NULL  -- Alleen docenten
--     -- Excluding cancelled deviations
--     AND NOT EXISTS (
--       SELECT 1 FROM agenda_event_deviations d
--       WHERE d.event_id = ae.id
--         AND d.original_date = ae.start_date
--         AND d.is_cancelled = true
--     )
-- )
--
-- De exacte implementatie hangt af van de huidige structuur van get_hours_report.
-- Het resultaat moet een extra veld 'source_type' bevatten ('lesson' of 'project')
-- en optioneel 'project_name' / 'project_id'.
```

---

## 2. RLS (Row-Level Security)

**Geen RLS-wijzigingen nodig.** Project-events erven de bestaande `agenda_events` RLS:

| Actie   | Beleid                                                            |
| ------- | ----------------------------------------------------------------- |
| SELECT  | Owner, participant, of privileged user                            |
| INSERT  | Owner of privileged user                                          |
| UPDATE  | Owner of privileged user                                          |
| DELETE  | Owner of privileged user                                          |

Privileged users (staff/admin/site_admin) kunnen project-events aanmaken. Docenten en leerlingen die als `agenda_participant` gekoppeld zijn, zien de events in hun agenda.

---

## 3. Frontend wijzigingen

### 3a. Types

**`src/components/agenda/types.ts`** — `CalendarEventResource` uitbreiden:

```typescript
// Toevoegen aan CalendarEventResource interface:
projectId?: string;
projectName?: string;
```

**`src/types/agenda-events.ts`** — `AgendaEventSourceType` uitbreiden:

```typescript
export type AgendaEventSourceType = 'manual' | 'lesson_agreement' | 'project';
```

### 3b. Data ophalen — `useAgendaData.ts`

In `getEnrichedEvents`:

1. Wanneer `source_type === 'project'`, haal projectnaam op uit een `projectsMap` (geladen bij `loadData`).
2. Zet `projectId` en `projectName` op de `CalendarEventResource`.
3. Gebruik het project-icoon (`LuFolderOpen`) en eventueel een standaardkleur voor project-events.

```typescript
// In loadData: projecten ophalen voor source_type = 'project'
const projectSourceIds = agendaEvents
  .filter(e => e.source_type === 'project' && e.source_id)
  .map(e => e.source_id!);

if (projectSourceIds.length > 0) {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', projectSourceIds);
  // → projectsMap = new Map(projects.map(p => [p.id, p]))
}
```

### 3c. Agenda Event Formulier — `AgendaEventFormDialog.tsx`

Voor privileged users:

1. **Bron-selector** toevoegen: "Handmatig" (default) of "Project".
2. Wanneer "Project" geselecteerd:
   - Toon project-selector (dropdown met actieve projecten).
   - `source_type` wordt `'project'`, `source_id` wordt het geselecteerde project-ID.
3. Deelnemers: meerdere docenten en leerlingen selecteerbaar (`UserSelectMultiple` uit `@/components/ui/user-select`).

### 3d. Projecten-pagina — `Projects.tsx`

Per project-rij een **"Tijdslot plannen"** actie toevoegen:

- Opent de `AgendaEventFormDialog` met het project voorgeselecteerd.
- Mogelijke implementatie: `rowActions` uitbreiden met een custom action, of een knop in de rij.

### 3e. Rapportage — `Reports.tsx`

1. `ReportRow` type uitbreiden met `source_type: 'lesson' | 'project'` en `project_name?: string`.
2. Quick filter toevoegen: "Type" → Lessen / Projecten.
3. Summary card toevoegen: "Project-uren" naast bestaande les-uren.
4. Kolom "Project" conditioneel tonen wanneer project-uren aanwezig zijn.

### 3f. Visueel onderscheid in agenda

Project-events worden visueel onderscheiden:

- **Icoon**: `LuFolderOpen` (uit `react-icons/lu`)
- **Label**: Projectnaam als titel
- **Kleur**: Eventueel projectkleur of een standaard accent-kleur

---

## 4. Bestaande patronen die hergebruikt worden

| Patroon                  | Bron                                    | Hergebruik                                       |
| ------------------------ | --------------------------------------- | ------------------------------------------------ |
| Agenda events CRUD       | `useAgendaEventForm.ts`                 | `performSave` met `source_type = 'project'`      |
| Event rendering          | `eventGenerators.ts`                    | Geen wijzigingen — project-events zijn `agenda_events` |
| Deviations               | `agenda_event_deviations`               | Werkt automatisch voor project-events             |
| Participants             | `agenda_participants`                   | Identiek aan handmatige events                    |
| RLS                      | Bestaande `agenda_events` policies      | Geen wijzigingen                                  |
| DataTable                | `src/components/ui/data-table.tsx`      | Rapportage en projecten-tabel                     |
| UserSelectSingle / UserSelectMultiple | `src/components/ui/user-select/`  | Enkele of meerdere gebruikers selecteren (eigenaar, deelnemers) |
| PageSkeleton             | `src/components/ui/page-skeleton.tsx`   | Loading states                                    |

---

## 5. Bestanden die geraakt worden

### Database (migratie)

- `supabase/migrations/YYYYMMDD_project_scheduling.sql` — nieuwe migratie

### Frontend

| Bestand                                          | Wijziging                                         |
| ------------------------------------------------ | ------------------------------------------------- |
| `src/components/agenda/types.ts`                 | `projectId`, `projectName` toevoegen              |
| `src/types/agenda-events.ts`                     | `'project'` toevoegen aan `AgendaEventSourceType` |
| `src/hooks/useAgendaData.ts`                     | Project-info ophalen en enrichen                  |
| `src/hooks/useAgendaEventForm.ts`                | `source_type = 'project'` ondersteuning           |
| `src/components/agenda/AgendaEventFormDialog.tsx` | Project-selector UI                               |
| `src/components/agenda/AgendaEvent.tsx`           | Project-icoon tonen                               |
| `src/lib/agenda/eventGenerators.ts`              | Geen wijzigingen verwacht                         |
| `src/pages/Projects.tsx`                         | "Tijdslot plannen" actie                          |
| `src/pages/Reports.tsx`                          | Project-uren, filter, summary card                |

### Tests

- RLS tests voor `agenda_events` met `source_type = 'project'` (optioneel, bestaande RLS dekt dit al)

---

## 6. Implementatie-checklist

Conform `plan-constraints.mdc`:

- [ ] **DRY**: Geen duplicatie — hergebruik bestaande agenda-infrastructuur
- [ ] **Types**: Hergebruik Supabase types; nieuwe types alleen in `src/types/`
- [ ] **Database**: Migratie aangemaakt; `bun run reset-db:dev` na schema-wijziging
- [ ] **UI**: Bestaande componenten (`DataTable`, `UserSelectSingle`/`UserSelectMultiple`, `PageSkeleton`) hergebruikt
- [ ] **Icons**: Alleen `react-icons` (`LuFolderOpen`)
- [ ] **Date/time**: Helpers uit `src/lib/date` en `src/lib/time`
- [ ] **Finale check**: `bun run check` → `bun run ci` tot alles slaagt

---

## 7. Volgorde van implementatie

1. **Database-migratie** — constraint, triggers, rapportage-functie
2. **Types** — `CalendarEventResource`, `AgendaEventSourceType`
3. **Data-laag** — `useAgendaData`, `useAgendaEventForm`
4. **UI Agenda** — `AgendaEventFormDialog` met project-selector
5. **UI Projecten** — "Tijdslot plannen" actie
6. **UI Rapportage** — project-uren weergave
7. **Validatie** — `bun run check`, `bun run ci`, handmatige test
