# Database Testing (RLS + Auth)

## Hoe het werkt

Tests draaien tegen een **remote Supabase-project** (geen lokale instance). Er zijn twee projecten in gebruik:

- **mcp-test** (`jserlqacarlgtdzrblic`): gebruikt door **CI bij elke PR** en optioneel lokaal via `bun dev:test` / `bun test rls` (credentials in `.env.test` of env).
- **mcp-dev** (`zdvscmogkfyddnnxzkdu`): development; lokaal kun je ook tegen mcp-dev testen als je env daarop wijst.

**In CI** (`pull-request-test-code-and-supabase.yml`):
- Workflow linkt naar **mcp-test** (via secret `SUPABASE_PROJECT_REF`)
- `supabase db reset --linked --yes` (seed wordt toegepast)
- Credentials uit GitHub secrets (moeten van mcp-test zijn) → `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `bun test` draait RLS- en Auth-tests tegen mcp-test

---

## Seed Data voor RLS Tests

Het gelinkte project wordt voor tests gereset en geseeded met `supabase/seed.sql`. De seed bevat:

| Type | Gebruikers |
|------|-----------|
| **site_admin** | `site-admin@test.nl` (1) |
| **admin** | `admin-one@test.nl`, `admin-two@test.nl` (2) |
| **staff** | `staff-one@test.nl` t/m `staff-five@test.nl` (5) |
| **teachers** | `teacher-alice@test.nl` t/m `teacher-jack@test.nl` (10) |
| **students** | `student-001@test.nl` t/m `student-060@test.nl` (60) |
| **users (geen rol)** | `user-001@test.nl` t/m `user-010@test.nl` (10) |

Daarnaast bevat de seed:
- **Lesson types**: Referentiedata voor lestypes
- **Students**: Koppeling van student-gebruikers aan student-records
- **Teachers**: Koppeling van teacher-gebruikers aan teacher-records
- **Lesson agreements**: Lesovereenkomsten tussen studenten en docenten
- **Project domains / labels / projects**: Referentiedata voor de projecten-module

---

## Test Structuur

### Test Fixtures (`tests/rls/fixtures.ts`)

Alle seed data wordt éénmalig opgehaald en gecachet in `fixtures.ts`:

```typescript
fixtures.allProfiles         // Alle profielen
fixtures.allStudents         // Alle student-records
fixtures.allTeachers         // Alle teacher-records
fixtures.allLessonTypes      // Alle lestypes
fixtures.allLessonAgreements // Alle lesovereenkomsten

fixtures.requireUserId(email)                 // user_id op basis van email
fixtures.requireStudentId(email)              // student.id op basis van email
fixtures.requireTeacherId(email)              // teacher.id op basis van email
fixtures.requireLessonTypeId(name)            // lesson_type.id op basis van naam
fixtures.requireAgreementId(student, teacher) // agreement.id op basis van student+teacher
fixtures.allProjectDomains / allProjectLabels / allProjects  // project-referentiedata
```

---

## Wat wordt getest

### RLS Tests (`tests/rls/`)

#### Systeem (`system/`)

- ✅ RLS is enabled op alle verwachte tabellen
- ✅ Alle verwachte policies bestaan
- ✅ Geen onverwachte policies aanwezig
- ✅ Security helper functions bestaan (`is_admin`, `is_teacher`, `is_student`, etc.)
- ✅ Seed data ground truth (correct aantal users per type)
- ✅ Triggers werken correct (immutability, updated_at, site_admin bescherming)
- ✅ Anonieme gebruikers hebben geen toegang tot data

#### Profiles (`profiles/`)

- ✅ SELECT: student ziet eigen profiel + profielen van eigen docenten; teacher ziet eigen profiel + profielen van eigen studenten; staff/admin/site_admin zien alles
- ✅ UPDATE: eigen profiel aanpasbaar, staff/admin/site_admin kunnen alles aanpassen
- ✅ INSERT/DELETE: geblokkeerd voor alle rollen (trigger/cascade)
- ✅ Validatie: telefoonnummer (10 cijfers)

#### User Roles (`user-roles/`)

- ✅ SELECT: admin/staff/site_admin zien alle rollen, overige gebruikers niet
- ✅ INSERT: admin (geen site_admin), site_admin (alles)
- ✅ UPDATE: admin (geen site_admin rollen), site_admin (alles)
- ✅ DELETE: admin (geen site_admin rollen), site_admin (alles)

#### Students (`students/`)

- ✅ SELECT: studenten zien eigen record; docenten zien eigen studenten (via lesson_agreements); staff/admin/site_admin zien alles
- ✅ INSERT: geblokkeerd voor alle rollen (automatisch aangemaakt via triggers op lesson_agreements)
- ✅ UPDATE: alleen admin/site_admin
- ✅ DELETE: geblokkeerd voor alle rollen, inclusief site_admin (automatisch verwijderd via triggers wanneer alle lesson_agreements zijn verwijderd)

#### Teachers (`teachers/`)

- ✅ SELECT: studenten zien eigen docenten (via lesson_agreements); docenten zien eigen record; staff/admin/site_admin zien alles
- ✅ INSERT/UPDATE/DELETE: alleen admin/site_admin

#### Lesson Types (`lesson-types/`)

- ✅ SELECT: alle ingelogde gebruikers (publieke referentiedata)
- ✅ INSERT/UPDATE/DELETE: alleen admin/site_admin

#### Lesson Agreements (`lesson-agreements/`)

- ✅ SELECT: studenten zien eigen overeenkomsten, docenten zien eigen overeenkomsten, staff/admin/site_admin zien alles
- ✅ INSERT/UPDATE/DELETE: alleen staff/admin/site_admin
- ✅ Studenten en docenten kunnen geen overeenkomsten wijzigen

#### Project Domains / Labels / Projects (`projects/`)

- ✅ SELECT: alle ingelogde gebruikers zien domains, labels en projecten
- ✅ INSERT/UPDATE/DELETE domains en labels: alleen admin/site_admin
- ✅ INSERT/UPDATE/DELETE projecten: alleen admin/site_admin (geen staff)
- ✅ Anonieme gebruikers hebben geen toegang

#### Users zonder rol (`users/`)

- ✅ SELECT: alleen eigen profiel, geen toegang tot students/teachers/agreements/roles
- ✅ INSERT/UPDATE/DELETE: alleen eigen profiel updaten, verder niets

### Auth Tests (`tests/auth/`)

- ✅ Password policy enforcement (min. 32 chars, letters+digits+symbols)
- ✅ Wachtwoorden zonder symbolen/cijfers/letters worden geweigerd
- ✅ Valide wachtwoorden worden geaccepteerd (user unconfirmed)
- ✅ OTP/Magic Link sign-in flow
- ✅ User deletion (CASCADE behavior, site_admin bescherming)

---

## Lokaal tests draaien

Lokaal kun je tegen **mcp-test** of **mcp-dev** testen. Zet in je omgeving (bijv. `.env.test`) de variabelen van het project dat je gebruikt:

- `SUPABASE_URL` — URL van het Supabase-project
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (voor bypass RLS in fixtures)
- `SUPABASE_PUBLISHABLE_DEFAULT_KEY` — anon key (voor client)
- `VITE_DEV_LOGIN_PASSWORD` — wachtwoord van seed-users (bijv. `password`)

```bash
# Alle database tests
bun test rls auth

# Alleen RLS tests
bun test rls

# Alleen Auth tests
bun test auth

# Specifieke test categorie
bun test tests/rls/lesson-agreements
bun test tests/rls/teachers
```

---

## Environment Variables

Voor lokaal testen: zet de credentials in `.env.test` of exporteer ze in je shell (zelfde variabelen als in "Lokaal tests draaien"). Voor CI worden ze uit GitHub secrets gezet; zie [secrets.md](./secrets.md).
