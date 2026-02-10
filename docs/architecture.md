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

teachers + profiles ──► teacher_viewed_by_student (view, beperkte velden)
```

### Tabellen

| Tabel | Beschrijving |
|-------|-------------|
| `profiles` | Gebruikersprofiel (naam, email, telefoon, avatar). Automatisch aangemaakt via trigger bij registratie. |
| `user_roles` | Expliciete rollen (`site_admin`, `admin`, `staff`). Eén rol per gebruiker. |
| `students` | Leerling-registratie. Koppelt een `auth.users` aan een student-record. **Automatisch beheerd**: wordt aangemaakt wanneer de eerste lesovereenkomst wordt ingevoegd en automatisch verwijderd wanneer alle lesovereenkomsten zijn verwijderd. Kan niet handmatig worden aangemaakt of verwijderd. |
| `teachers` | Docent-registratie. Koppelt een `auth.users` aan een teacher-record. |
| `lesson_types` | Lestypes (bijv. "Gitaar", "Piano"). Referentiedata, zichtbaar voor alle ingelogde gebruikers. |
| `lesson_agreements` | Lesovereenkomsten tussen student en docent. Bevat dag, tijd, start/einddatum, actief-status en notities. |

### Views

| View | Beschrijving |
|------|-------------|
| `teacher_viewed_by_student` | Beperkte docent-informatie voor leerlingen. Toont alleen: `teacher_id`, `first_name`, `last_name`, `avatar_url`, `phone_number`. Geen email of andere gevoelige velden. |

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

| Actie | Eigen profiel | staff | admin | site_admin |
|-------|:------------:|:-----:|:-----:|:----------:|
| SELECT | ✅ | ✅ (alle) | ✅ (alle) | ✅ (alle) |
| UPDATE | ✅ | ✅ (alle) | ✅ (alle) | ✅ (alle) |
| INSERT | ❌ (trigger) | ❌ (trigger) | ❌ (trigger) | ❌ (trigger) |
| DELETE | ❌ (cascade) | ❌ (cascade) | ❌ (cascade) | ❌ (cascade) |

### students

| Actie | student | teacher | staff | admin | site_admin |
|-------|:-------:|:-------:|:-----:|:-----:|:----------:|
| SELECT | ✅ (eigen) | ❌ | ✅ | ✅ | ✅ |
| INSERT | ❌ | ❌ | ❌ | ❌ | ❌ |
| UPDATE | ❌ | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Belangrijk**: Students kunnen **NIET** handmatig worden verwijderd, zelfs niet door site_admin. Students worden automatisch aangemaakt wanneer een lesovereenkomst wordt ingevoegd en automatisch verwijderd wanneer alle lesovereenkomsten zijn verwijderd. Om een student te verwijderen, moeten eerst alle bijbehorende lesovereenkomsten worden verwijderd.

### teachers

| Actie | student | teacher | staff | admin | site_admin |
|-------|:-------:|:-------:|:-----:|:-----:|:----------:|
| SELECT | ❌ | ❌ | ✅ | ✅ | ✅ |
| INSERT | ❌ | ❌ | ❌ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

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

### teacher_viewed_by_student (view)

| Actie | student | teacher | staff | admin | site_admin |
|-------|:-------:|:-------:|:-----:|:-----:|:----------:|
| SELECT | ✅ (eigen docenten) | ❌ | ✅ (alle) | ✅ (alle) | ✅ (alle) |

> **Eigen docenten** = alleen docenten waarmee de student een actieve lesovereenkomst heeft.

---

## Helper Functions

| Functie | Beschrijving | Security |
|---------|-------------|----------|
| `is_site_admin(uuid)` | Check of gebruiker site_admin is | `SECURITY DEFINER` |
| `is_admin(uuid)` | Check of gebruiker admin is | `SECURITY DEFINER` |
| `is_staff(uuid)` | Check of gebruiker staff is | `SECURITY DEFINER` |
| `is_student(uuid)` | Check of gebruiker een student-record heeft | `SECURITY DEFINER` |
| `is_teacher(uuid)` | Check of gebruiker een teacher-record heeft | `SECURITY DEFINER` |
| `get_student_id(uuid)` | Haal student ID op basis van user_id | `SECURITY DEFINER` |
| `get_teacher_id(uuid)` | Haal teacher ID op basis van user_id | `SECURITY DEFINER` |
| `get_teachers_viewed_by_student()` | Retourneer beperkte docent-info voor huidige gebruiker | `SECURITY DEFINER` |
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

## Supabase Omgevingen

Dit project gebruikt twee aparte Supabase omgevingen:

| Omgeving | Project ID | Gebruik |
|----------|------------|---------|
| **Development** | `zdvscmogkfyddnnxzkdu` (mcp-dev) | Directe connectie vanuit Lovable |
| **Production** | `bnagepkxryauifzyoxgo` | Productie deployment |

### Hoe dit werkt

1. **Lovable** is verbonden met `mcp-dev` - een losse development database
2. **CI tests** draaien tegen een **lokale Supabase** instance
3. Bij **merge naar main** worden migraties handmatig toegepast op production via `supabase db push`
