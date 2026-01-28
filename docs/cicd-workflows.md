# CI/CD Workflows

## Actieve Workflows

| Workflow | Bestand | Trigger | Doel |
|----------|---------|---------|------|
| **PR CI** | `pull-request-ci.yml` | PRs naar main | Biome linting |
| **PR Tests** | `pull-request-test-code.yml` | Alle PRs | Unit tests (`tests/code/`) |
| **PR Supabase** | `pull-request-test-code-and-supabase.yml` | `supabase/**`, `tests/**` + handmatig | Volledige test suite op lokale Supabase |
| **Formatting** | `formatting.yml` | Handmatig/callable | Auto-format met Biome |
| **Linting** | `linting.yml` | Handmatig/callable | Lint + schrijf errors naar `.github/biome-errors.txt` |

### PR Supabase Workflow Details

Draait alle tests tegen een lokale Supabase instance in GitHub Actions:

- **Path filter**: Draait alleen bij wijzigingen in `supabase/**` of `tests/**`
- **Handmatige trigger**: Kan ook handmatig gestart worden via `workflow_dispatch`
- **Docker images**: Download Supabase images bij elke run (~3-5 min)
- **Environment**: Credentials worden dynamisch opgehaald van draaiende Supabase instance (zie [secrets.md](./secrets.md))
- **Vereiste secret**: `RESEND_API_KEY` voor email tests (SMTP config)

---

## Uitgeschakelde Workflows

Te vinden in `.github/workflows-disabled/`:

| Workflow | Reden uitgeschakeld |
|----------|---------------------|
| `pull-request-database.yml` | Vervangen door lokale Supabase workflow (geen preview branches meer) |
| `reset-lovable-branch.yml` | Handmatige trigger, niet nodig in normale flow |
| `prevent-protected-folder-changes.yml` | Vervangen door branch protection rules |
