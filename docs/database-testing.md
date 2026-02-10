# Database Testing (RLS + Auth)

## Hoe het werkt

Tests draaien tegen een **lokale Supabase instance** in CI:

```
PR met wijzigingen in supabase/** of tests/**
       ↓
pull-request-test-code-and-supabase.yml triggert
       ↓
Start lokale Supabase (supabase start -x ...)
       ↓
Exporteert credentials van draaiende instance
       ↓
Draait seed.sql (test users + relaties)
       ↓
Tests draaien tegen lokale Supabase
       ↓
Verifieert RLS policies + Auth policies
```

---

## Seed Data voor RLS Tests

De lokale Supabase wordt automatisch geseeded met testgebruikers uit `supabase/seed.sql`. De seed bevat:

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

- ✅ SELECT: eigen profiel zichtbaar, staff/admin/site_admin zien alles
- ✅ UPDATE: eigen profiel aanpasbaar, staff/admin/site_admin kunnen alles aanpassen
- ✅ INSERT/DELETE: geblokkeerd voor alle rollen (trigger/cascade)
- ✅ Validatie: telefoonnummer (10 cijfers)

#### User Roles (`user-roles/`)

- ✅ SELECT: admin/staff/site_admin zien alle rollen, overige gebruikers niet
- ✅ INSERT: admin (geen site_admin), site_admin (alles)
- ✅ UPDATE: admin (geen site_admin rollen), site_admin (alles)
- ✅ DELETE: admin (geen site_admin rollen), site_admin (alles)

#### Students (`students/`)

- ✅ SELECT: studenten zien eigen record, staff/admin/site_admin zien alles
- ✅ INSERT: geblokkeerd voor alle rollen (automatisch aangemaakt via triggers op lesson_agreements)
- ✅ UPDATE: alleen admin/site_admin
- ✅ DELETE: geblokkeerd voor alle rollen, inclusief site_admin (automatisch verwijderd via triggers wanneer alle lesson_agreements zijn verwijderd)

#### Teachers (`teachers/`)

- ✅ SELECT: alleen staff/admin/site_admin
- ✅ INSERT/UPDATE/DELETE: alleen admin/site_admin

#### Lesson Types (`lesson-types/`)

- ✅ SELECT: alle ingelogde gebruikers (publieke referentiedata)
- ✅ INSERT/UPDATE/DELETE: alleen admin/site_admin

#### Lesson Agreements (`lesson-agreements/`)

- ✅ SELECT: studenten zien eigen overeenkomsten, docenten zien eigen overeenkomsten, staff/admin/site_admin zien alles
- ✅ INSERT/UPDATE/DELETE: alleen staff/admin/site_admin
- ✅ Studenten en docenten kunnen geen overeenkomsten wijzigen

#### Teacher Viewed by Student (`teachers/teacher-viewed-by-student`)

- ✅ Studenten zien alleen docenten waarmee zij een overeenkomst hebben
- ✅ Alleen beperkte velden zichtbaar (naam, avatar, telefoon — geen email)
- ✅ Docenten zien niets via de view
- ✅ Staff/admin/site_admin zien alle docenten

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

Start eerst lokale Supabase:

```bash
# Start Supabase (minimale services voor testing)
supabase start -x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,studio,postgres-meta,supavisor

# Of start alle services
supabase start
```

Dan tests draaien:

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

Voor lokaal testen zijn credentials automatisch beschikbaar via `supabase status`. Voor CI, zie [secrets.md](./secrets.md).
