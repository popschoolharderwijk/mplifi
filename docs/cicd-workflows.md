# CI/CD Workflows

## Actieve Workflows

| Workflow | Bestand | Trigger | Doel |
|----------|---------|---------|------|
| **PR CI** | `pull-request-ci.yml` | PRs naar main | Biome linting |
| **PR Tests** | `pull-request-test.yml` | Alle PRs | Unit tests (`tests/code/`) |
| **PR Database** | `pull-request-database.yml` | `supabase/migrations/**`, `tests/rls/**`, `tests/auth/**` | RLS + Auth tests |
| **Formatting** | `formatting.yml` | Manual/callable | Auto-format met Biome |
| **Linting** | `linting.yml` | Manual/callable | Lint + schrijf errors naar `.github/biome-errors.txt` |

---

## Supabase Preview (Externe Workflow)

De Supabase GitHub App draait automatisch bij PRs met migratie-wijzigingen:

1. Detecteert changes in `supabase/migrations/`
2. Creëert een preview branch op de **production** Supabase project
3. Past migraties toe op de preview branch
4. Rapporteert status als GitHub check "Supabase Preview"

**Instelling**: "Supabase changes only" - preview alleen bij database changes

---

## Disabled Workflows

In `.github/workflows-disabled/`:

| Workflow | Reden disabled |
|----------|----------------|
| `reset-lovable-branch.yml` | Handmatige trigger, niet nodig in normale flow |
| `prevent-protected-folder-changes.yml` | Vervangen door branch protection rules |
