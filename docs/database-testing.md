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

De lokale Supabase wordt automatisch geseeded met testgebruikers uit `supabase/seed.sql`. De seed bevat gebruikers met verschillende rollen (site_admin, admin, staff, teacher) en gebruikers zonder rol voor het testen van RLS policies.

---

## Wat wordt getest

### RLS Tests (`tests/rls/`)

- ✅ RLS is enabled op alle verwachte tabellen
- ✅ Alle verwachte policies bestaan (incl. `roles_insert_admin`, `roles_update_admin`, `roles_delete_admin`)
- ✅ Geen onverwachte policies aanwezig
- ✅ Security helper functions bestaan (`is_admin`, `is_teacher`, etc.)
- ✅ Seed data ground truth (correct aantal users per role)
- ✅ RLS policies werken correct per user role
- ✅ Role management: admin kan rollen beheren (behalve site_admin)
- ✅ Role management: site_admin kan alle rollen beheren

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
```

---

## Environment Variables

Voor lokaal testen zijn credentials automatisch beschikbaar via `supabase status`. Voor CI, zie [secrets.md](./secrets.md).
