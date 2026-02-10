# Handige Commands

## Development Omgevingen

Er zijn 3 omgevingen geconfigureerd:

| Command | Omgeving | Env bestand | Gebruik |
|---------|----------|-------------|---------|
| `bun dev` | Remote development | `.env.development` | Lovable branch, remote dev server |
| `bun dev:local` | Lokale Supabase | `.env.localdev` | Lokaal testen met `supabase start` |
| `bun prod` | Productie | `.env.production` | Productie server |

### Env bestanden aanmaken

**`.env.development`** (remote dev):
```env
VITE_SUPABASE_URL=https://xyz-dev.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Dev login bypass (optioneel, zie "Dev Login Bypass" sectie)
VITE_DEV_LOGIN_EMAIL=dev@example.com
VITE_DEV_LOGIN_PASSWORD=your-dev-password
```

**`.env.localdev`** (lokale Supabase):
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJ...lokale-anon-key

# Voor scripts (createuser, create-storage-bucket)
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=eyJ...lokale-service-key

# Dev login bypass (optioneel, zie "Dev Login Bypass" sectie)
VITE_DEV_LOGIN_EMAIL=dev@example.com
VITE_DEV_LOGIN_PASSWORD=your-dev-password
```

**`.env.production`** (productie):
```env
VITE_SUPABASE_URL=https://xyz-prod.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> 💡 Alleen `.env` staat in `.gitignore`. De `.env.localdev`, `.env.development` en `.env.production` bestanden worden wel gecommit (zonder secrets).

### Lokale Supabase credentials ophalen

Na `supabase start` verschijnen de credentials in de terminal. Je kunt ze ook opvragen met:

```bash
supabase status
```

| Waarde | URL | Gebruik |
|--------|-----|---------|
| `API URL` | `http://localhost:54321` | → `VITE_SUPABASE_URL` én `SUPABASE_URL` |
| `Studio URL` | `http://localhost:54323` | Supabase Dashboard (database, auth, etc.) |
| `anon key` | | → `VITE_SUPABASE_ANON_KEY` |
| `service_role key` | | → `SUPABASE_SERVICE_ROLE_KEY` (voor scripts) |

> ⚠️ **Let op**: De API draait op poort **54321**, het Dashboard op poort **54323**. Dit zijn verschillende poorten!

---

## Git Branch Management

```bash
# Reset lovable branch naar main (verliest Lovable history awareness!)
git checkout -B lovable origin/main
git push -u origin lovable --force

# Complete history reset (orphan branch) - DESTRUCTIEF
git checkout main
git pull origin main
git checkout --orphan temp-main
git add -A
git commit -m "Initial commit"
git branch -D main
git branch -m main
git push --force origin main
```

---

## Supabase CLI

```bash
# Link aan remote dev project (mcp-dev)
supabase link --project-ref zdvscmogkfyddnnxzkdu

# Of gebruik --linked flag voor gelinkte project
supabase <command> --linked

# Push migraties naar remote dev
supabase db push --linked

# Push config naar remote dev
supabase config push --linked

# Generate types voor gelinkte project
supabase gen types typescript --linked > src/integrations/supabase/types.ts

# Voor lokale testing (alleen voor CI/tests):
supabase start
supabase start -x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,studio,postgres-meta,supavisor
supabase stop
```

> 💡 **Development workflow**: Gebruik `--linked` voor alle commando's die werken met de remote dev instance (mcp-dev). Lokale Supabase wordt alleen gebruikt voor CI tests.

---

## Storage Buckets

```bash
# Maak avatars storage bucket aan (vereist .env met SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY)
bun run create-storage-bucket
```

> ⚠️ Storage buckets kunnen niet via SQL migraties worden aangemaakt. Run dit script **voor** je de storage RLS migratie toepast.

---

## User Management

```bash
# Maak nieuwe gebruiker aan (of update bestaande)
# Configureer in .env.localdev of .env.development:
#   SUPABASE_URL=http://localhost:54321          (verplicht, API URL)
#   SUPABASE_SERVICE_ROLE_KEY=eyJ...             (verplicht, service role key)
#   VITE_DEV_LOGIN_EMAIL=user@example.com        (verplicht)
#   VITE_DEV_LOGIN_PASSWORD=wachtwoord           (optioneel, zonder = passwordless user)
#   DEV_LOGIN_FIRST_NAME=Voornaam                (optioneel)
#   DEV_LOGIN_LAST_NAME=Achternaam               (optioneel)
bun run createuser
```

**Twee modes:**
- **Met wachtwoord**: User kan inloggen via Dev Login knop én Magic Link/OTP
- **Zonder wachtwoord**: User kan alleen inloggen via Magic Link/OTP

> 💡 Bij een bestaande user worden wachtwoord en naam geüpdatet (zowel in `auth.users` als `profiles` tabel).

---

## Dev Login Bypass

In development omgevingen (`localdev` en `development`) verschijnt een "Dev Login" knop op de login pagina. Hiermee kun je direct inloggen zonder Magic Link/OTP te hoeven afwachten.

### Rol Selectie

De Dev Login knop heeft een dropdown waarmee je kunt kiezen uit verschillende rollen:
- **Site Admin** (`site-admin@test.nl`) - Standaard geselecteerd
- **Admin** (`admin-one@test.nl`)
- **Teacher** (`teacher-alice@test.nl`)
- **Staff** (`staff-one@test.nl`)
- **Student** (`student-001@test.nl`)
- **User (geen rol)** (`user-001@test.nl`)

Deze users komen uit de seed data (`supabase/seed.sql`) en zijn beschikbaar in de remote dev instance (mcp-dev).

### Configuratie

**Optioneel** - Voeg toe aan `.env.development` als je een custom wachtwoord wilt gebruiken:

```env
VITE_DEV_LOGIN_PASSWORD=your-custom-password
```

Als `VITE_DEV_LOGIN_PASSWORD` niet is ingesteld, wordt het standaard seed wachtwoord gebruikt (`password`).

### Beveiliging

- De Dev Login knop wordt **volledig verwijderd** uit production builds (Vite dead-code elimination)
- Werkt alleen in development modes (`localdev` en `development`)
- Extra runtime check als fallback

---

## Testing

```bash
# Unit tests (geen Supabase nodig)
bun test code

# RLS tests (lokale Supabase moet draaien)
bun test rls

# Auth tests (lokale Supabase moet draaien)
bun test auth

# Alle tests
bun test
```

---

## Biome Linting

```bash
# Check
biome ci

# Format
biome format --write .

# Lint + fix
biome check --write .
```
