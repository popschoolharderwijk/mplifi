# Architectuur

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Testing**: Bun test runner
- **Linting**: Biome
- **CI/CD**: GitHub Actions

---

## Database Schema

### Overzicht

```
auth.users
    ├── profiles        (1:1, via trigger on_auth_user_created)
    ├── user_roles      (0..1:1, optioneel — alleen voor site_admin/admin/staff)
    ├── students        (0..1:1, optioneel — leerling-registratie)
    └── teachers        (0..1:1, optioneel — docent-registratie)

students ──┐
teachers ──┼── lesson_agreements (N:M via koppeltabel)
lesson_types ─┘

project_domains ── project_labels ── projects (eigenaar: auth.users)
agenda_events (source: manual | lesson_agreement | project) ── agenda_participants
```

Agenda: `agenda_events` kan gekoppeld zijn aan een lesovereenkomst (`source_type = 'lesson_agreement'`), een project (`source_type = 'project'`) of handmatig (`source_type = 'manual'`). Deelnemers via `agenda_participants`.

### Tabellen

| Tabel | Beschrijving |
|-------|-------------|
| `profiles` | Gebruikersprofiel (naam, email, telefoon, avatar). Automatisch aangemaakt via trigger bij registratie. |
| `user_roles` | Expliciete rollen (`site_admin`, `admin`, `staff`). Eén rol per gebruiker. |
| `students` | Leerling-registratie. Koppelt een `auth.users` aan een student-record. **Automatisch beheerd**: wordt aangemaakt wanneer de eerste lesovereenkomst wordt ingevoegd en automatisch verwijderd wanneer alle lesovereenkomsten zijn verwijderd. Kan niet handmatig worden aangemaakt of verwijderd. |
| `teachers` | Docent-registratie. Koppelt een `auth.users` aan een teacher-record. |
| `lesson_types` | Lestypes (bijv. "Gitaar", "Piano"). Referentiedata, zichtbaar voor alle ingelogde gebruikers. |
| `lesson_agreements` | Lesovereenkomsten tussen student en docent. Bevat dag, tijd, start/einddatum, actief-status en notities. |
| `project_domains` | Categorieën voor projecten (bijv. "Muziek", "Dans"). SELECT voor alle ingelogden; INSERT/UPDATE/DELETE alleen admin/site_admin. |
| `project_labels` | Subcategorieën binnen een domein (bijv. "Gitaar", "Piano"). Beheer alleen admin/site_admin. |
| `projects` | Projecten met label, eigenaar, kostenplaats. SELECT voor alle ingelogden; INSERT/UPDATE/DELETE alleen admin/site_admin. |
| `agenda_events` | Agenda-items (handmatig, les of project). Bevat source_type/source_id, start/eind, recurring. |
| `agenda_participants` | Koppelt deelnemers (auth.users) aan agenda_events. |
| `agenda_event_deviations` | Afwijkingen op recurring events (verplaatsen, afzeggen). |

### Views

| View | Beschrijving |
|------|-------------|
| `view_profiles_with_display_name` | Profielgegevens met berekend `display_name`. Gebruikt `security_invoker = on` zodat RLS op profiles wordt gerespecteerd. |

---

## Rollen en Permissies

De applicatie gebruikt een role-based access control (RBAC) systeem met de volgende rollen:

| Rol | Beschrijving |
|-----|-------------|
| `site_admin` | Volledige toegang, kan alle rollen beheren |
| `admin` | Kan gebruikers en rollen beheren (behalve site_admin) |
| `staff` | Kan gebruikersgegevens inzien, lesovereenkomsten beheren |
| *(geen rol)* | Standaard gebruiker, alleen eigen profiel |

> 📝 **Docenten en leerlingen** worden **niet** via `user_roles` geïdentificeerd, maar via de `teachers` en `students` tabellen. Een gebruiker kan zowel een rol (admin/staff) als een teacher/student record hebben.

### Role Management Permissies

| Actie | admin | site_admin |
|-------|-------|------------|
| Rollen toewijzen (INSERT) | ✅ (geen site_admin) | ✅ |
| Rollen wijzigen (UPDATE) | ✅ (geen site_admin) | ✅ |
| Rollen verwijderen (DELETE) | ✅ (geen site_admin) | ✅ |
| Eigen rol wijzigen | ❌ | ❌ |

> ⚠️ **Bescherming**: De laatste `site_admin` kan niet worden verwijderd of gedemoteerd (database trigger).

---

## RLS Permissies per Tabel

### profiles

| Actie | student | teacher | staff | admin | site_admin |
|-------|:-------:|:-------:|:-----:|:-----:|:----------:|
| SELECT | ✅ (eigen + eigen docenten) | ✅ (eigen + eigen studenten) | ✅ (alle) | ✅ (alle) | ✅ (alle) |
| UPDATE | ✅ (eigen) | ✅ (eigen) | ✅ (alle) | ✅ (alle) | ✅ (alle) |
| INSERT | ❌ (trigger) | ❌ (trigger) | ❌ (trigger) | ❌ (trigger) | ❌ (trigger) |
| DELETE | ❌ (cascade) | ❌ (cascade) | ❌ (cascade) | ❌ (cascade) | ❌ (cascade) |

> **Eigen docenten** = profielen van teachers waarmee de student een lesson_agreement heeft. **Eigen studenten** = profielen van studenten waarmee de teacher een lesson_agreement heeft.

### students

| Actie | student | teacher | staff | admin | site_admin |
|-------|:-------:|:-------:|:-----:|:-----:|:----------:|
| SELECT | ✅ (eigen) | ✅ (eigen studenten) | ✅ | ✅ | ✅ |
| INSERT | ❌ | ❌ | ❌ | ❌ | ❌ |
| UPDATE | ❌ | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Eigen studenten** = studenten waarmee de teacher een lesson_agreement heeft. Students kunnen **NIET** handmatig worden verwijderd; ze worden automatisch aangemaakt/verwijderd via triggers op lesson_agreements.

### teachers

| Actie | student | teacher | staff | admin | site_admin |
|-------|:-------:|:-------:|:-----:|:-----:|:----------:|
| SELECT | ✅ (eigen docenten) | ✅ (eigen) | ✅ | ✅ | ✅ |
| INSERT | ❌ | ❌ | ❌ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

> **Eigen docenten** = teachers waarmee de student een lesson_agreement heeft.

### lesson_types

| Actie | iedereen (ingelogd) | staff | admin | site_admin |
|-------|:-------------------:|:-----:|:-----:|:----------:|
| SELECT | ✅ | ✅ | ✅ | ✅ |
| INSERT | ❌ | ❌ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ✅ | ✅ |

### lesson_agreements

| Actie | student | teacher | staff | admin | site_admin |
|-------|:-------:|:-------:|:-----:|:-----:|:----------:|
| SELECT | ✅ (eigen) | ✅ (eigen) | ✅ (alle) | ✅ (alle) | ✅ (alle) |
| INSERT | ❌ | ❌ | ✅ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ✅ | ✅ | ✅ |

> **Eigen** = student ziet alleen overeenkomsten waar zij de student zijn; teacher ziet alleen overeenkomsten waar zij de docent zijn.

---

## Helper Functions

| Functie | Beschrijving | Security |
|---------|-------------|----------|
| `is_site_admin(uuid)` | Check of gebruiker site_admin is | `SECURITY DEFINER` |
| `is_admin(uuid)` | Check of gebruiker admin is | `SECURITY DEFINER` |
| `is_staff(uuid)` | Check of gebruiker staff is | `SECURITY DEFINER` |
| `is_student(uuid)` | Check of gebruiker een student-record heeft | `SECURITY DEFINER` |
| `is_teacher(uuid)` | Check of gebruiker een teacher-record heeft | `SECURITY DEFINER` |
| `get_teacher_user_id(uuid)` | Haal teacher user_id op basis van user_id | `SECURITY DEFINER` |
| `can_delete_user(uuid, uuid)` | Check of gebruiker een ander account mag verwijderen | `SECURITY DEFINER` |

> Alle helper functions gebruiken `SECURITY DEFINER` met vaste `search_path` om search_path injection te voorkomen. Toegang is beperkt tot `authenticated` gebruikers.

---

## Automatisch Lifecycle Management

### Students

Students worden **automatisch beheerd** via database triggers:

- **Aanmaken**: Wanneer een `lesson_agreement` wordt ingevoegd, wordt automatisch een `student` record aangemaakt voor de `student_user_id` (als deze nog niet bestaat).
- **Verwijderen**: Wanneer alle `lesson_agreements` voor een student zijn verwijderd, wordt het `student` record automatisch verwijderd.
- **Geen handmatige beheer**: Students kunnen **NIET** handmatig worden aangemaakt of verwijderd, zelfs niet door `site_admin`. Er zijn geen INSERT of DELETE policies op de `students` tabel.

**Design rationale**: Students zijn een **gevolg** van lesovereenkomsten, niet een voorwaarde. Dit voorkomt orphaned student records en zorgt voor automatisch lifecycle management.

**CASCADE gedrag**:
- Als een `auth.users` record wordt verwijderd, worden alle bijbehorende `lesson_agreements` automatisch verwijderd (via `ON DELETE CASCADE`).
- Wanneer alle `lesson_agreements` zijn verwijderd, wordt de `student` automatisch verwijderd door de trigger.

---

## Security: SECURITY DEFINER Views en Functions

### Overzicht

PostgreSQL views en functions kunnen `SECURITY DEFINER` gebruiken, wat betekent dat ze draaien met de rechten van de eigenaar (meestal `postgres`) in plaats van de aanroepende gebruiker. Dit kan RLS policies omzeilen en is daarom een security risico.

### Beveiligingsmaatregelen

1. **Whitelist in baseline tests**: Alle SECURITY DEFINER views moeten expliciet worden toegevoegd aan `ALLOWED_SECURITY_DEFINER_VIEWS` in `tests/rls/system/baseline.security.test.ts`. Nieuwe views zonder `security_invoker = on` zullen de CI tests laten falen.

2. **Verplichte documentatie**: Elke SECURITY DEFINER view/function moet documentatie bevatten over:
   - Waarom SECURITY DEFINER nodig is
   - Welke auth.uid() checks worden uitgevoerd
   - Welke kolommen worden geëxposeerd
   - Verwijzing naar relevante tests

3. **Automatische tests**: De baseline security tests verifiëren dat:
   - Geen onverwachte SECURITY DEFINER views bestaan
   - Alle toegestane SECURITY DEFINER views correct zijn gedocumenteerd
   - Views met `security_invoker = on` RLS respecteren

### Toegestane SECURITY DEFINER Views

Geen. Alle views gebruiken `security_invoker = on` of zijn verwijderd; studenten zien hun teachers via RLS op de `teachers`- en `profiles`-tabellen.

### Linter Warnings

De Supabase linter rapporteert warnings voor SECURITY DEFINER views. Voor views in de whitelist zijn dit **false positives** omdat:
- De security expliciet is geïmplementeerd via `auth.uid()` checks
- Tests in `tests/rls/` verifiëren dat unauthorized access wordt geblokkeerd
- De whitelist entry vereist expliciete goedkeuring

---

## Supabase Omgevingen

Dit project gebruikt drie aparte Supabase omgevingen:

| Omgeving | Project ID | Gebruik |
|----------|------------|---------|
| **mcp-test** | `jserlqacarlgtdzrblic` | Testproject: `bun dev:test` en **CI/PR-checks** (workflow linkt via `SUPABASE_PROJECT_REF`) |
| **mcp-dev** | `zdvscmogkfyddnnxzkdu` | Development: Lovable / `bun dev`, en lokaal `reset-db:dev` |
| **Production** | `bnagepkxryauifzyoxgo` | Productie deployment (`bun prod`) |

### Hoe dit werkt

1. **Lovable** is verbonden met **mcp-dev** — development database.
2. **Lokaal testen** (`bun dev:test` of `bun test rls`): gebruik **mcp-test** of mcp-dev via `.env.test` (SUPABASE_URL etc.).
3. **CI bij een PR**: de workflow **pull-request-test-code-and-supabase** linkt naar **mcp-test** (via GitHub secret `SUPABASE_PROJECT_REF`), doet `supabase db reset --linked --yes`, en draait daar alle tests. Zie [secrets.md](./secrets.md) en [cicd-workflows.md](./cicd-workflows.md).
4. Bij **merge naar main** worden migraties handmatig toegepast op production via `supabase db push`.
