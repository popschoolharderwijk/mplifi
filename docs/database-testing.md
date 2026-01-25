# Database Testing (RLS + Auth)

## Hoe het werkt

```
PR met migrations, tests/rls/**, of tests/auth/**
       ↓
Supabase Preview start (creëert preview branch database)
       ↓
pull-request-database.yml wacht op "Supabase Preview" check
       ↓
Haalt credentials op: supabase branches get -o env
       ↓
Maakt key alias: SUPABASE_ANON_KEY → SUPABASE_PUBLISHABLE_DEFAULT_KEY
       ↓
Linkt CLI naar preview branch (niet hoofdproject!)
       ↓
Seedt preview database: supabase db push --include-seed
       ↓
Tests draaien tegen preview branch met seed data
       ↓
Verifieert RLS policies + Auth policies
```

---

## Seed Data voor RLS Tests

De preview branch wordt automatisch geseeded met testgebruikers uit `supabase/seed.sql`. De seed bevat ook teacher-student relaties voor het testen van RLS policies die afhankelijk zijn van deze koppelingen.

> **Let op**: De Supabase CLI `branches get` command gebruikt nog de legacy naam `SUPABASE_ANON_KEY`. De workflow maakt automatisch een alias naar `SUPABASE_PUBLISHABLE_DEFAULT_KEY` voor forward compatibility.

---

## Wat wordt getest

### RLS Tests (`tests/rls/`)

- ✅ RLS is enabled op alle verwachte tabellen
- ✅ Alle verwachte policies bestaan
- ✅ Geen onverwachte policies aanwezig
- ✅ Security helper functions bestaan (`is_admin`, `is_teacher`, etc.)
- ✅ Seed data ground truth (correct aantal users per role)
- ✅ RLS policies werken correct per user role

### Auth Tests (`tests/auth/`)

- ✅ Password policy enforcement (min. 32 chars, letters+digits+symbols)
- ✅ Wachtwoorden zonder symbolen/cijfers/letters worden geweigerd
- ✅ Valide wachtwoorden worden geaccepteerd (user unconfirmed)

---

## Lokaal tests draaien

Voor lokale database tests heb je een `.env.local` nodig. Zie [supabase-setup.md](supabase-setup.md) Stap 6 voor het aanmaken van dit bestand.

```bash
# Alle database tests
bun test rls auth --env-file .env.local

# Alleen RLS tests
bun test rls --env-file .env.local

# Alleen Auth tests
bun test auth --env-file .env.local
```
