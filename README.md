# Mplifi Community Portal

Een React + Vite + Supabase boilerplate met volledige CI/CD setup, RLS testing, en Supabase branching.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Testing**: Bun test runner
- **Linting**: Biome
- **CI/CD**: GitHub Actions + Supabase GitHub Integration

---

## Development Setup

### Twee Supabase Omgevingen

| Omgeving | Project ID | Branching | Gebruik |
|----------|------------|-----------|---------|
| **Lovable Preview** | `zdvscmogkfyddnnxzkdu` (mcp-dev) | ❌ Geen | Directe connectie vanuit Lovable |
| **Production** | `bnagepkxryauifzyoxgo` | ✅ Supabase Pro | PRs en productie deployment |

### Hoe dit werkt

1. **Lovable** is verbonden met `mcp-dev` - een losse development database zonder branching
2. **PRs naar main** triggeren Supabase Preview op de **production** server (met Pro branching)
3. Bij **merge naar main** worden migraties automatisch toegepast op production

### Environment Files

```
.env.development     # Development keys (public)
.env.production      # Production keys (public)
.env.local           # Lokale secrets (niet in repo, voor RLS tests)
```

---

## Git Branching Strategy

```
main (protected)
  ↑
  └── lovable (development branch)
        ↑
        └── feature branches
```

- **`main`**: Protected, alleen via PRs, geen directe pushes
- **`lovable`**: Lovable AI werkt hier, syncs met main via PRs
- Branch protection rules actief op `main`

---

## CI/CD Workflows

### Actieve Workflows

| Workflow | Bestand | Trigger | Doel |
|----------|---------|---------|------|
| **PR CI** | `pull-request-ci.yml` | PRs naar main | Biome linting |
| **PR Tests** | `pull-request-test.yml` | Alle PRs | Unit tests (`tests/code/`) |
| **PR RLS** | `pull-request-rls.yml` | `supabase/migrations/**` | RLS security tests |
| **Formatting** | `formatting.yml` | Manual/callable | Auto-format met Biome |
| **Linting** | `linting.yml` | Manual/callable | Lint + schrijf errors naar `.github/biome-errors.txt` |

### Supabase Preview (Externe Workflow)

De Supabase GitHub App draait automatisch bij PRs met migratie-wijzigingen:

1. Detecteert changes in `supabase/migrations/`
2. Creëert een preview branch op de **production** Supabase project
3. Past migraties toe op de preview branch
4. Rapporteert status als GitHub check "Supabase Preview"

**Instelling**: "Supabase changes only" - preview alleen bij database changes

---

## RLS Testing Flow

### Hoe het werkt

```
PR met migrations
       ↓
Supabase Preview start (creëert preview branch database)
       ↓
pull-request-rls.yml wacht op "Supabase Preview" check
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
Verifieert RLS policies
```

### Seed Data voor RLS Tests

De preview branch wordt automatisch geseeded met testgebruikers uit `supabase/seed.sql`: De seed bevat ook teacher-student relaties voor het testen van RLS policies die afhankelijk zijn van deze koppelingen.

> **Let op**: De Supabase CLI `branches get` command gebruikt nog de legacy naam `SUPABASE_ANON_KEY`. De workflow maakt automatisch een alias naar `SUPABASE_PUBLISHABLE_DEFAULT_KEY` voor forward compatibility.

### Wat wordt getest (alle tests in `tests/rls/`)

- ✅ RLS is enabled op alle verwachte tabellen
- ✅ Alle verwachte policies bestaan
- ✅ Geen onverwachte policies aanwezig
- ✅ Security helper functions bestaan (`is_admin`, `is_teacher`, etc.)
- ✅ Seed data ground truth (correct aantal users per role)
- ✅ RLS policies werken correct per user role

### Lokaal RLS tests draaien

Voor lokale RLS tests heb je een `.env.local` nodig:

```bash
# .env.local (NIET in git!)
SUPABASE_URL=https://zdvscmogkfyddnnxzkdu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret key uit Supabase dashboard>
```

**SUPABASE_SERVICE_ROLE_KEY ophalen:**
1. Ga naar https://supabase.com/dashboard/project/zdvscmogkfyddnnxzkdu/settings/api-keys
2. Kopieer de default secret key ( begint met `sb_secret...`)
3. Zet in `.env.local`

```bash
# Run lokaal
bun test rls --env-file .env.local
```

---

## Secrets Configuratie

### GitHub Secrets

Nodig voor CI workflows. Toe te voegen via:
**GitHub** → Settings → Secrets and variables → Actions → New repository secret

| Secret | Waarde | Gebruik |
|--------|--------|---------|
| `SUPABASE_ACCESS_TOKEN` | Personal access token van Supabase | CLI authenticatie |
| `SUPABASE_PROJECT_ID` | `bnagepkxryauifzyoxgo` | Production project ref |

**Stappen om SUPABASE_ACCESS_TOKEN te krijgen:**
1. Ga naar https://supabase.com/dashboard/account/tokens
2. Klik "Generate new token"
3. Geef naam (bv `github-ci`) en kopieer token
4. Voeg toe als GitHub secret

### Supabase Edge Function Secrets

Voor Edge Functions. Toe te voegen via:
**Supabase Dashboard** → Project Settings → Edge Functions → Secrets

| Secret | Beschrijving |
|--------|--------------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (⚠️ NOOIT `VITE_` prefix!) |

---

## Deployment naar Productie

### Automatische Flow

1. **PR merge naar main** triggert Supabase GitHub Integration
2. Migraties worden automatisch toegepast op production database
3. Edge Functions worden automatisch gedeployed door Lovable

### Handmatige Deployment

```bash
# Link aan production project
supabase link --project-ref bnagepkxryauifzyoxgo

# Push migraties
supabase db push

# Deploy edge functions
supabase functions deploy <function-name>
```

---

## Merge Workflow: Lovable → Main

### Stap 1: Lokale voorbereiding (CLI)

```bash
# Switch naar lovable branch
git switch lovable

# Haal laatste wijzigingen van remote op (fetch)
git fetch origin

# Rebase lovable op de nieuwste origin/main (lineair, geen merge commit)
git rebase origin/main

# --- Mogelijke situatie: rebase conflicts ---
# Als je een conflict krijgt in src/integrations/supabase/types.ts:
# 1. Herstel conflict door types opnieuw te genereren:
#    supabase gen types typescript --linked > src/integrations/supabase/types.ts
# 2. Laat Biome types netjes formatteren
#    biome check --write src/integrations/supabase/types.ts
# 3. Voeg file toe en ga verder met rebase
#    git add src/integrations/supabase/types.ts
#    git rebase --continue
# Herhaal indien meerdere commits conflicten geven

# Types opnieuw genereren na andere wijzigingen (nooit overslaan)
supabase link --project-ref zdvscmogkfyddnnxzkdu
supabase db reset --linked
supabase gen types typescript --linked > src/integrations/supabase/types.ts

# Run Biome check voor de rest van de code (format + lint + fix)
biome check --write .

# Commit en push eventuele fixes
git add .
git commit -m "fix: regenerate and format Supabase types, lint fixes"
git push --force-with-lease origin lovable
```

### Stap 2: Open Pull Request op GitHub

- Ga naar repository op GitHub
- Klik "Compare & pull request" of maak nieuwe PR
- Base: `main` ← Compare: `lovable`
- Voeg beschrijving toe van de wijzigingen

### Stap 3: Wacht op CI Checks

| Check | Beschrijving |
|-------|--------------|
| **Biome Linting** | Code formatting en linting |
| **Unit Tests** | Tests in `tests/code/` |
| **Supabase Preview** | Alleen bij migration changes |
| **RLS Tests** | Alleen bij migration changes |

### Stap 4: Review en Fix

- Bekijk CI resultaten in de PR
- Fix eventuele failures lokaal en push opnieuw

### Stap 5: Merge de PR

- Kies "Squash and merge" of "Merge commit"
- **Delete lovable branch NIET!**

### Stap 6: Post-merge Sync

```bash
# Reset lovable branch naar main (verliest Lovable history awareness!)
git checkout -B lovable origin/main
git push -u origin lovable --force
```

> ⚠️ **Let op**: Deze force push reset de lovable branch volledig naar main. Lovable verliest hierdoor awareness van eerdere commits op de lovable branch.

---

## Disabled Workflows

In `.github/workflows-disabled/`:

| Workflow | Reden disabled |
|----------|----------------|
| `reset-lovable-branch.yml` | Handmatige trigger, niet nodig in normale flow |
| `prevent-protected-folder-changes.yml` | Vervangen door branch protection rules |

---

## Handige Commands

### Git Branch Management

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

### Supabase CLI

```bash
# Link project
supabase link --project-ref <project-id>

# Get branch credentials (voor CI)
supabase --experimental branches get <branch-name> -o env

# Push migraties
supabase db push

# Generate types
supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
```

### Testing

```bash
# Unit tests
bun test code

# RLS tests op remote dev server
bun test rls --env-file .env.local

# Alle tests
bun test --env-file .env.local
```

### Biome Linting

```bash
# Check
biome ci

# Format
biome format --write .

# Lint + fix
biome check --write .
```

---

## Troubleshooting

### RLS tests falen in CI

1. Check of Supabase Preview check geslaagd is
2. Controleer of `supabase branches get` correcte output geeft
3. Kijk naar workflow logs voor credential parsing errors
4. Controleer of seeding is gelukt (`supabase db push --include-seed`)
5. Verifieer dat `SUPABASE_PUBLISHABLE_DEFAULT_KEY` correct is gealiased van `SUPABASE_ANON_KEY`

### Migraties niet toegepast

1. Controleer of PR changes heeft in `supabase/migrations/`
2. Check Supabase GitHub App logs in repository settings
3. Verifieer dat Supabase project correct gelinked is

### Edge Functions errors

1. Check logs: https://supabase.com/dashboard/project/zdvscmogkfyddnnxzkdu/functions
2. Verifieer secrets in Edge Function settings
3. Test lokaal met `supabase functions serve`
