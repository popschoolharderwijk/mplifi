# CI/CD Workflows

## Actieve Workflows

| Workflow | Bestand | Trigger | Doel |
|----------|---------|---------|------|
| **PR CI** | `pull-request-ci.yml` | PRs naar main | Biome + Squawk linting |
| **PR Tests** | `pull-request-test-code.yml` | Alle PRs | Unit tests (`tests/code/`) |
| **PR Supabase** | `pull-request-test-code-and-supabase.yml` | `supabase/**`, `tests/**` + handmatig | DB lint + volledige test suite |
| **Formatting** | `formatting.yml` | Handmatig/callable | Auto-format met Biome |
| **Linting** | `linting.yml` | Handmatig/callable | Lint + schrijf errors naar `.github/biome-errors.txt` |

---

## Linting

Er zijn drie linters actief in dit project:

| Linter | Wat het checkt | Waar | Commando |
|--------|----------------|------|----------|
| **Biome** | TypeScript/JS code style & errors | `pull-request-ci.yml` | `biome ci .` |
| **Squawk** | SQL migratie-veiligheid (drops, locks, backward compat) | `pull-request-ci.yml` | `bun run lint:sql` |
| **supabase db lint** | PL/pgSQL code quality, SQL injection | `pull-request-test-code-and-supabase.yml` | `supabase db lint --linked` |

### Squawk (SQL migraties)

[Squawk](https://squawkhq.com/) lint statisch de `.sql` bestanden in `supabase/migrations/`. Vangt o.a.:
- Gevaarlijke operaties: `DROP TABLE`, `DROP DATABASE`, `TRUNCATE CASCADE`
- Lock-problemen: indexen zonder `CONCURRENTLY`
- Backward compatibility issues

```bash
# Lokaal draaien
bun run lint:sql
```

- **Config**: `.squawk.toml` (PG versie, excluded rules)
- **Regel negeren**: `-- squawk-ignore rule-name` boven de SQL statement

### supabase db lint (PL/pgSQL)

Powered by [plpgsql_check](https://github.com/okbob/plpgsql_check). Checkt tegen een **live database**:
- Type-fouten in functies
- Unused variables, dead code
- SQL injection in `EXECUTE` statements

```bash
# Tegen gelinkte dev database
supabase db lint --linked

# Alleen errors (geen warnings)
supabase db lint --linked --level error

# Specifieke schema
supabase db lint --linked --schema public
```

### PR Supabase Workflow Details

Draait alle tests tegen **mcp-test** in GitHub Actions:

- **Path filter**: Draait alleen bij wijzigingen in `supabase/**` of `tests/**` (rapporteert altijd status)
- **Handmatige trigger**: Kan ook handmatig gestart worden via `workflow_dispatch`
- **Project**: Link naar **mcp-test** via secret `SUPABASE_PROJECT_REF` (zie [secrets.md](./secrets.md)); daarna `supabase db reset --linked --yes` voor een schone database met seed
- **Credentials**: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY` uit GitHub secrets (moeten van hetzelfde mcp-test project zijn)
- **Vereiste secret**: `RESEND_API_KEY` voor e-mailtests (SMTP)

---

## Uitgeschakelde Workflows

Te vinden in `.github/workflows-disabled/`:

| Workflow | Reden uitgeschakeld |
|----------|---------------------|
| `pull-request-database.yml` | Vervangen door workflow die tegen gelinkte Supabase draait (geen preview branches meer) |
| `reset-lovable-branch.yml` | Handmatige trigger, niet nodig in normale flow |
| `prevent-protected-folder-changes.yml` | Vervangen door branch protection rules |
