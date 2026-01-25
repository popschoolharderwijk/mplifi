# Handige Commands

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
# Link project
supabase link --project-ref <project-id>

# Get branch credentials (voor CI)
supabase --experimental branches get <branch-name> -o env

# Push migraties
supabase db push

# Generate types
supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
```

---

## Storage Buckets

```bash
# Maak avatars storage bucket aan (vereist .env.local met SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY)
bun run create-storage-bucket
```

> ⚠️ Storage buckets kunnen niet via SQL migraties worden aangemaakt. Run dit script **voor** je de storage RLS migratie toepast.

---

## User Management

```bash
# Maak nieuwe gebruiker aan (passwordless, alleen OTP/Magic Link)
# Configureer in .env.local:
#   CREATE_USER_EMAIL=user@example.com
#   CREATE_USER_FIRST_NAME=Voornaam
#   CREATE_USER_LAST_NAME=Achternaam
bun run createuser
```

---

## Testing

```bash
# Unit tests
bun test code

# RLS tests op remote dev server
bun test rls --env-file .env.local

# Alle tests
bun test --env-file .env.local
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
