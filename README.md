# Mplifi Community Portal

Een React + Vite + Supabase boilerplate met volledige CI/CD setup, RLS testing, en Supabase branching.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Testing**: Bun test runner
- **Linting**: Biome
- **CI/CD**: GitHub Actions + Supabase GitHub Integration

## Quick Start

```bash
# Install dependencies (use npm, not bun - bun install has issues with esbuild on Windows)
npm install

# Run development server
bun dev

# Run tests
bun test
```

## Documentatie

| Onderwerp | Bestand |
|-----------|---------|
| Architectuur & Supabase omgevingen | [docs/architecture.md](docs/architecture.md) |
| Supabase server setup | [docs/supabase-setup.md](docs/supabase-setup.md) |
| Git branching strategy | [docs/git-branching.md](docs/git-branching.md) |
| CI/CD workflows | [docs/cicd-workflows.md](docs/cicd-workflows.md) |
| RLS testing | [docs/rls-testing.md](docs/rls-testing.md) |
| Secrets configuratie | [docs/secrets.md](docs/secrets.md) |
| Deployment | [docs/deployment.md](docs/deployment.md) |
| Merge workflow (Lovable → Main) | [docs/merge-workflow.md](docs/merge-workflow.md) |
| Commands cheat sheet | [docs/commands.md](docs/commands.md) |
| Troubleshooting | [docs/troubleshooting.md](docs/troubleshooting.md) |
| Email templates & SMTP | [docs/email-templates.md](docs/email-templates.md) |

## License

See [LICENSE](LICENSE)
