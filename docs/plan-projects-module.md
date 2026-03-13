# Plan: Projects-module implementatie

## Overzicht

Hiërarchie: **Project Domains → Project Labels → Projects**

- **project_domains**: categorieën (bijv. "Muziek", "Dans")
- **project_labels**: subcategorieën binnen een domein (bijv. "Gitaar", "Piano")
- **projects**: concrete projecten met eigenaar, kostenplaats en actief/inactief

**Terminologie**: In de UI kan "label" verwarrend zijn; overweeg gebruikersvriendelijke termen (bijv. "categorie" / "subcategorie" of "domein" / "type") waar het past. In code blijft `project_domains` / `project_labels`.

### Architectuurkeuze: 3-laag vs 2-laag

Dit plan kiest voor **drie tabellen** (domains → labels → projects). Dat is geschikt als:
- domeinen zelden veranderen, labels vaak;
- labels niet tussen domeinen mogen bewegen;
- domain en label apart beheerd worden (bijv. verschillende rechten).

**Alternatief (2 tabellen)** als domain vooral een visuele groepering is:
- `project_labels` met `parent_label_id` (self-ref), of
- `project_categories` + `projects` (één niveau).

Bij 3 tabellen: queries joinen altijd `projects` → `project_labels` → `project_domains`; houd daar rekening mee in API/UI.

---

## Plan constraints (van plan-constraints.mdc)

**Voor LLMs / implementatie**: Vóór het schrijven van code **eerst de inhoud van `./src/lib` en `./src/components` doornemen**. Zo voorkom je dubbele functionaliteit en houd je DRY (Don't Repeat Yourself): hergebruik wat er al is.

Bij implementatie **in deze volgorde** toepassen:

| # | Constraint | Toepassing in dit plan |
|---|------------|------------------------|
| 1 | **Types** | Hergebruik uit `./src/types` of `./src/integrations/supabase/types.ts`; nieuwe types alleen in `./src/types` als herbruikbaar; baseren op Supabase-types. |
| 2 | **Database / Supabase types** | Na migratie: `bun run reset-db:dev` (Stap 3). **Nooit** `./src/integrations/supabase/types.ts` handmatig bewerken. |
| 3 | **UI** | Eerst `./src/components` (incl. `./src/components/ui`) doornemen; bestaande componenten gebruiken; PageSkeleton/SectionSkeleton voor loading; PageHeader bovenaan + breadcrumb suffix. |
| 4 | **Icons** | Alleen **react-icons** (bijv. `react-icons/lu`, `react-icons/fi`); **niet** `lucide-react`. |
| 5 | **Data overviews** | DataTable (`data-table.tsx`) voor tabellen/overzichten. |
| 6 | **Date/time** | Alleen helpers uit `./src/lib/date` en `./src/lib/time`; niet inline formatteren. |
| 7 | **Completion** | Laatste stap: `bun run check`, daarna `bun run ci`; fouten oplossen tot `bun run ci` slaagt. |

**DRY**: Geen duplicatie van logica, types of UI. Eerst `./src/lib` en `./src/components` doornemen; hergebruik bestaande componenten, types en helpers.

---

## Stap 1: Database-migratie

**Nieuw bestand**: `supabase/migrations/YYYYMMDDHHMMSS_projects_module.sql` (datum/tijd naar keuze). Alle onderstaande SQL in dat bestand zetten.

### Tabellen

```sql
-- 1. project_domains
CREATE TABLE public.project_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. project_labels
CREATE TABLE public.project_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.project_domains(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Case-insensitive uniek label per domein (voorkomt "Gitaar" en "gitaar")
CREATE UNIQUE INDEX idx_project_labels_domain_name_lower ON public.project_labels (domain_id, lower(name));

-- 3. projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid NOT NULL REFERENCES public.project_labels(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  owner_user_id uuid NOT NULL REFERENCES public.users(id),  -- of auth.users(id): consistent met rest codebase
  cost_center text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexen voor join-performance (FK-kolommen)
CREATE INDEX idx_project_labels_domain_id ON public.project_labels(domain_id);
CREATE INDEX idx_projects_label_id ON public.projects(label_id);
CREATE INDEX idx_projects_owner_user_id ON public.projects(owner_user_id);
```

> **Referentie eigenaar**: Gebruik de **zelfde user-tabel als elders** in het project (bijv. `public.users(id)` of `auth.users(id)`). Supabase raadt vaak `public.users` aan: joinen is eenvoudiger, RLS werkt voorspelbaarder. Controleer bestaande referenties en wees consequent.

> **project_domains name**: Optioneel case-insensitive: `CREATE UNIQUE INDEX idx_project_domains_name_lower ON public.project_domains (lower(name));` (na de tabel). Bij `project_labels` is dat al gedaan via `idx_project_labels_domain_name_lower`.

### updated_at triggers

Hergebruik bestaande `update_updated_at_column()`. Concreet toevoegen:

```sql
CREATE TRIGGER update_project_domains_updated_at
  BEFORE UPDATE ON public.project_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_labels_updated_at
  BEFORE UPDATE ON public.project_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### RLS Policies

Patroon volgt `lesson_types`:

| Tabel              | SELECT               | INSERT            | UPDATE            | DELETE            |
|--------------------|----------------------|-------------------|-------------------|-------------------|
| `project_domains`  | authenticated (true) | admin/site_admin  | admin/site_admin  | admin/site_admin  |
| `project_labels`   | authenticated (true) | admin/site_admin  | admin/site_admin  | admin/site_admin  |
| `projects`         | authenticated (true) | admin/site_admin  | admin/site_admin  | admin/site_admin  |

Policy-namen:
- `project_domains_select_all`, `project_domains_insert_admin`, `project_domains_update_admin`, `project_domains_delete_admin`
- `project_labels_select_all`, `project_labels_insert_admin`, `project_labels_update_admin`, `project_labels_delete_admin`
- `projects_select_all`, `projects_insert_admin`, `projects_update_admin`, `projects_delete_admin`

**Let op**: Projects INSERT/UPDATE/DELETE zijn **alleen** voor admin/site_admin (geen staff). SELECT is voor alle authenticated users.

**ON DELETE RESTRICT op `projects.label_id`**: Verwijderen van een label kan niet zolang er projecten aan hangen. Oplossing: labels **niet hard-deleten**; gebruik `is_active = false` (soft delete). Geen verwijder-knop voor labels in de UI, of alleen tonen als er geen projecten bij het label horen. Idem voor **project_domains**: een domein kan niet verwijderd worden zolang er labels aan gekoppeld zijn (FK); de UI toont bij FK-fout een duidelijke melding (labels eerst verwijderen of aan ander domein koppelen).

**SELECT**: Alle authenticated users zien alle projecten (organisatiebreed overzicht).

---

## Stap 2: Seed data voor tests

Toevoegen aan `supabase/seed.sql`:

```sql
-- Project Domains (3) – standaard UUID-vorm i.p.v. letter-prefixes
INSERT INTO public.project_domains (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Muziek'),
  ('00000000-0000-0000-0000-000000000002', 'Dans'),
  ('00000000-0000-0000-0000-000000000003', 'Theater');

-- Project Labels (6, 2 per domein)
INSERT INTO public.project_labels (id, domain_id, name) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Gitaarles'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Pianoles'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000002', 'Ballet'),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000002', 'Streetdance'),
  ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000003', 'Impro'),
  ('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000003', 'Musical');

-- Projects (4, mix van owners: admin + staff/teachers)
INSERT INTO public.projects (id, label_id, name, owner_user_id, cost_center) VALUES
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011', 'Gitaarproject Voorjaar', '<admin_user_id>', 'KC-101'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000013', 'Ballet Beginners', '<teacher_alice_id>', 'KC-202'),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000015', 'Impro Workshop', '<staff_user_id>', NULL),
  ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000012', 'Piano Masterclass', '<teacher_bob_id>', 'KC-303');
```

> **Let op**: Placeholders `<admin_user_id>`, `<teacher_alice_id>`, `<staff_user_id>`, `<teacher_bob_id>` vervangen door de echte user-id's uit de bestaande seed (zorg dat die users in seed bestaan).

---

## Stap 3: Reset database & types

**Plan constraints**: Na elke schema-wijziging; nooit `types.ts` handmatig bewerken.

```bash
bun run reset-db:dev
```

Dit regenereert `src/integrations/supabase/types.ts` met de nieuwe tabellen.

---

## Stap 4: Types in `src/types/projects.ts`

**Plan constraints**: Types baseren op Supabase generated types; nieuwe types in `./src/types` voor herbruikbaarheid.

```typescript
import type { Tables } from '@/integrations/supabase/types';

export type ProjectDomain = Tables<'project_domains'>;
export type ProjectLabel = Tables<'project_labels'>;
export type Project = Tables<'projects'>;
```

---

## Stap 5: Projects-pagina (`src/pages/Projects.tsx`)

**Plan constraints**: Eerst `./src/components/ui` bekijken; DataTable voor overzicht; PageSkeleton voor loading; PageHeader + breadcrumb suffix.

- Gebruik **DataTable** uit `src/components/ui/data-table.tsx`
- Kolommen: Naam, Domein, Label, Eigenaar (`UserDisplay`), Kostenplaats, **Status** (badge op basis van `is_active`: actief/inactief)
- **PageHeader** met `NAV_LABELS.projects` en `NAV_ICONS.projects`; breadcrumb suffix instellen
- Loading: **PageSkeleton** variant `header-and-cards`
- Zoeken op naam, filteren op domein/label/status (status = actief/inactief)
- Data: bestaande fetch/query-pattern gebruiken (bijv. React Query + Supabase client), zoals elders in de app
- **Date/time**: Als `created_at`/`updated_at` getoond worden, alleen helpers uit `./src/lib/date` en `./src/lib/time` gebruiken.

---

## Stap 6: ProjectFormDialog (`src/components/projects/ProjectFormDialog.tsx`)

**Plan constraints**: Alleen bestaande UI uit `./src/components/ui` (Input, Select, Textarea, SubmitButton, Dialog).

- Dialog voor aanmaken/bewerken van projecten
- Velden:
  - Naam (input)
  - **Label** (select): toon opties als *"Gitaarles (Muziek)"* zodat één veld volstaat; domain is dan afgeleid. Alternatief: aparte Domein- en Label-select (meer state/validatie).
  - Eigenaar (`UserSelectSingle` uit `@/components/ui/user-select`, optioneel gefilterd op staff/admin rollen)
  - Kostenplaats (input, `.trim() || null`)
  - Beschrijving (textarea)
  - Actief (checkbox, alleen bij bewerken)
- **Domeinen/labels beheren**: Voor de eerste versie **geen** inline "+ Domein" / "+ Label" in de dialog (vereist nested dialogs, refetch, state). In plaats daarvan: aparte beheerpagina’s, bijv. `/settings/project-domains` en `/settings/project-labels`, of onder een bestaande settings-sectie.

---

## Stap 7: Routing, sidebar, breadcrumbs

### nav-labels.ts

**Plan constraints**: Icons alleen uit **react-icons** (bijv. `react-icons/lu`), niet uit `lucide-react`.

```typescript
// Toevoegen aan NAV_LABELS:
projects: 'Projecten',

// Toevoegen aan NAV_ICONS (import uit 'react-icons/lu'):
projects: LuFolderOpen, // of LuFolder
```

### App.tsx
Route toevoegen: `/projects` → `<Projects />`

### Sidebar.tsx
Projects-navitem tonen voor **teachers, staff, admin en site_admin** (niet voor users/students). Eigen sectie na Reports, vóór Beheer:
```typescript
const showProjectsNav = isTeacher || isPrivileged;
// ... in nav: showProjectsNav && <NavItem href="/projects" ... />
```
Op de Projects-pagina: alleen **admin/site_admin** zien knoppen toevoegen, bewerken, verwijderen en instellingen (domeinen & labels).

### breadcrumbs.ts
Breadcrumb configuratie toevoegen voor `/projects`. Eventueel `/projects/:id` alleen toevoegen als er later een projectdetailpagina komt.

---

## Stap 8: Tests

### 8a. RLS-tests (`tests/rls/projects/`)

Bestanden:
- `tests/rls/projects/select.test.ts`
- `tests/rls/projects/insert-update-delete.test.ts`

**Select-tests** (alle drie tabellen):
- ✅ Alle authenticated users kunnen domains/labels/projects lezen
- ❌ Anonieme gebruikers kunnen niets lezen

**FK-constraint-tests** (aanbevolen):
- Insert in `project_labels` met niet-bestaande `domain_id` faalt.
- Insert in `projects` met niet-bestaande `label_id` of `owner_user_id` faalt.

**Insert/Update/Delete-tests voor `project_domains` en `project_labels`**:
- ✅ Admin kan domains/labels aanmaken, bewerken, verwijderen
- ✅ Site_admin kan domains/labels aanmaken, bewerken, verwijderen
- ❌ Staff kan domains/labels NIET aanmaken/bewerken/verwijderen
- ❌ Reguliere user kan domains/labels NIET aanmaken/bewerken/verwijderen

**Insert/Update-tests voor `projects`**:
- ✅ Admin kan projecten aanmaken en bewerken
- ✅ Site_admin kan projecten aanmaken en bewerken
- ❌ Staff kan projecten NIET aanmaken/bewerken
- ❌ Reguliere user/teacher/student kan projecten NIET aanmaken/bewerken

**Delete-tests voor `projects`**:
- ✅ Admin kan projecten verwijderen
- ✅ Site_admin kan projecten verwijderen
- ❌ Staff kan projecten NIET verwijderen
- ❌ Reguliere user kan projecten NIET verwijderen

### 8b. baseline.security.test.ts updates

Toevoegen aan:
- `EXPECTED_RLS_TABLES`: `'project_domains'`, `'project_labels'`, `'projects'`
- `EXPECTED_POLICIES`: alle 12 policy-namen (4 per tabel)

### 8c. seed-data-constants.ts updates

```typescript
export const PROJECT_DOMAINS = {
  TOTAL: 3,
} as const;

export const PROJECT_LABELS = {
  TOTAL: 6,
} as const;

export const PROJECTS = {
  TOTAL: 4,
} as const;
```

---

## Stap 9: Validatie

**Plan constraints**: Verplichte eindstap; doorlopen tot alles groen is.

```bash
bun run check
bun run ci
```

Fix eventuele fouten totdat beide commando's slagen.

---

## Checklist (plan-constraints.mdc)

Vóór implementatie controleren:

- [ ] **DRY**: Eerst inhoud van `./src/lib` en `./src/components` doornemen; geen duplicatie van logica, types of UI; hergebruik bestaande componenten, types en helpers.
- [ ] **Types**: Hergebruik uit `./src/types` of Supabase; nieuwe types alleen in `./src/types` als herbruikbaar; gebaseerd op Supabase-types.
- [ ] **Database**: Bij schema-wijziging staat `bun run reset-db:dev` in het plan (Stap 3); `./src/integrations/supabase/types.ts` nooit handmatig bewerken.
- [ ] **UI**: Eerst `./src/components/ui` bekijken; bestaande componenten gebruiken; PageSkeleton/SectionSkeleton voor loading; pagina's hebben PageHeader bovenaan en breadcrumb suffix.
- [ ] **Icons**: Alleen uit `react-icons` (bijv. `react-icons/lu`); niet uit `lucide-react`.
- [ ] **Data overviews**: DataTable (`data-table.tsx`) gebruikt.
- [ ] **Date/time**: Alleen helpers uit `./src/lib/date` en `./src/lib/time`.
- [ ] **Final step**: `bun run check` daarna `bun run ci` tot beide slagen.
