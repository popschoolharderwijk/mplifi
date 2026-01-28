# CI/CD Workflows

## Active Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **PR CI** | `pull-request-ci.yml` | PRs to main | Biome linting |
| **PR Tests** | `pull-request-test.yml` | All PRs | Unit tests (`tests/code/`) |
| **PR Supabase** | `pull-request-supabase.yml` | `supabase/**`, `tests/**` + manual | Full test suite on local Supabase |
| **Formatting** | `formatting.yml` | Manual/callable | Auto-format with Biome |
| **Linting** | `linting.yml` | Manual/callable | Lint + write errors to `.github/biome-errors.txt` |

### PR Supabase Workflow Details

Runs all tests against a local Supabase instance in GitHub Actions:

- **Path filter**: Only runs when `supabase/**` or `tests/**` files change
- **Manual trigger**: Can also be triggered manually via `workflow_dispatch`
- **Docker images**: Downloads Supabase images on each run (~3-5 min)
- **Environment**: Credentials are dynamically fetched from running Supabase instance (see [secrets.md](./secrets.md))
- **Required secret**: `RESEND_API_KEY` for email tests (SMTP config)

---

## Supabase Preview (External Workflow)

The Supabase GitHub App runs automatically on PRs with migration changes:

1. Detects changes in `supabase/migrations/`
2. Creates a preview branch on the **production** Supabase project
3. Applies migrations to the preview branch
4. Reports status as GitHub check "Supabase Preview"

**Setting**: "Supabase changes only" - preview only on database changes

---

## Disabled Workflows

Located in `.github/workflows-disabled/`:

| Workflow | Reason disabled |
|----------|-----------------|
| `pull-request-database.yml` | Replaced by `pull-request-supabase.yml` (local Supabase instead of preview branches) |
| `reset-lovable-branch.yml` | Manual trigger, not needed in normal flow |
| `prevent-protected-folder-changes.yml` | Replaced by branch protection rules |
