# Secrets Configuratie

## GitHub Secrets

Nodig voor CI workflows. Voeg ze toe via:

**[GitHub Actions Secrets → popschoolharderwijk/mcp](https://github.com/popschoolharderwijk/mcp/settings/secrets/actions)**

Voor de PR-test (code + Supabase) moeten deze **6 secrets** zijn ingevuld:

| Secret | Waarde | Gebruik |
|--------|--------|---------|
| `SUPABASE_ACCESS_TOKEN` | Access token van Supabase (Account → Access Tokens) | `supabase link` en `supabase db reset --linked` in CI |
| `SUPABASE_PROJECT_REF` | Project ref van **mcp-test** (bijv. `jserlqacarlgtdzrblic`) | CI linkt hiernaar; `supabase db reset --linked` gebruikt dit project |
| `SUPABASE_URL` | API URL van **mcp-test** (bijv. `https://jserlqacarlgtdzrblic.supabase.co`) | Omgeving voor `bun test` in CI |
| `SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Anon key van **mcp-test** | Omgeving voor `bun test` in CI |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key van **mcp-test** | Omgeving voor `bun test` in CI |
| `RESEND_API_KEY` | API key van Resend.com | SMTP/e-mail (o.a. OTP) in het gekoppelde Supabase-project; ook lokaal nodig voor `supabase config push --linked`. |

Verkrijgen Resend: https://resend.com/api-keys

### Waar haal je de waarden vandaan?

- **SUPABASE_ACCESS_TOKEN**: [Supabase Dashboard](https://supabase.com/dashboard) → avatar → Account settings → Access Tokens → Generate new token
- **SUPABASE_PROJECT_REF**, **SUPABASE_URL**, **SUPABASE_PUBLISHABLE_DEFAULT_KEY**, **SUPABASE_SERVICE_ROLE_KEY**: Supabase Dashboard → test project → Settings → API (project ref = deel vóór `.supabase.co` in de URL)
- **RESEND_API_KEY**: https://resend.com/api-keys

De PR-workflow (**pull-request-test-code-and-supabase**) gebruikt **mcp-test**: de workflow linkt via `SUPABASE_PROJECT_REF` naar mcp-test, voert `supabase db reset --linked --yes` uit (schone database + seed), en draait daar alle tests. Zie [cicd-workflows.md](./cicd-workflows.md) en `.github/workflows/pull-request-test-code-and-supabase.yml`.

⚠️ **Commit nooit production of test keys!** Credentials horen in GitHub Secrets of Supabase Dashboard.

---

## Supabase Edge Function Secrets

Voor Edge Functions. Toe te voegen via:
**Supabase Dashboard** → Project Settings → Edge Functions → Secrets

### Automatisch Beschikbare Environment Variables

Supabase stelt automatisch de volgende environment variables beschikbaar in Edge Functions (geen handmatige configuratie nodig):

| Variabele | Beschrijving | Bron |
|-----------|--------------|------|
| `SUPABASE_URL` | Project API URL | Automatisch geïnjecteerd |
| `SUPABASE_ANON_KEY` | Anon/public key | Automatisch geïnjecteerd |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Automatisch geïnjecteerd |
| `SUPABASE_DB_URL` | Database connection string | Automatisch geïnjecteerd |

> 💡 **Tip**: Deze variabelen zijn altijd beschikbaar via `Deno.env.get()`. Je hoeft ze niet handmatig toe te voegen als secrets.

### Optionele Secrets

Voor custom configuratie kun je extra secrets toevoegen:

| Secret | Beschrijving | Voorbeeld |
|--------|--------------|-----------|
| `CUSTOM_API_KEY` | Externe API key | Voor integraties met derde partijen |
| `ALLOWED_ORIGINS` | Comma-separated origins voor CORS | `"http://localhost:5173,https://app.example.com"` |

> ⚠️ **Belangrijk**: De automatisch beschikbare variabelen hebben **geen** `VITE_` prefix. Gebruik altijd de exacte namen zoals hierboven.

---

## Dev Login Bypass (alleen development)

Voor snelle login in development omgevingen zonder Magic Link/OTP. Toe te voegen aan `.env.test` en/of `.env.development`:

### Frontend variabelen (voor de Dev Login knop)

| Variabele | Verplicht | Beschrijving |
|-----------|-----------|--------------|
| `VITE_DEV_LOGIN_PASSWORD` | Nee | Wachtwoord voor directe login (zonder = knop disabled) |

### Script variabelen (voor `bun run create-user`)

| Variabele | Verplicht | Beschrijving |
|-----------|-----------|--------------|
| `SUPABASE_URL` | Ja | API URL van mcp-dev of mcp-test (bijv. `https://zdvscmogkfyddnnxzkdu.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Ja | Service role key van Supabase |
| `DEV_LOGIN_FIRST_NAME` | Nee | Voornaam voor user metadata en profiles |
| `DEV_LOGIN_LAST_NAME` | Nee | Achternaam voor user metadata en profiles |

**Voorbeeld `.env.test`:**
```env
# Supabase connectie
VITE_SUPABASE_URL=https://jserlqacarlgtdzrblic.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...

# Dev login bypass
VITE_DEV_LOGIN_PASSWORD=mijn-test-wachtwoord
```

**Voorbeeld `.env.development` (voor create-user script):**
```env
# Supabase connectie
VITE_SUPABASE_URL=https://zdvscmogkfyddnnxzkdu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Voor create-user script
SUPABASE_URL=https://zdvscmogkfyddnnxzkdu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

DEV_LOGIN_EMAIL=dev@example.com
DEV_LOGIN_PASSWORD=mijn-dev-wachtwoord
DEV_LOGIN_FIRST_NAME=Dev
DEV_LOGIN_LAST_NAME=User
```

Maak de user aan met: `bun run create-user`

> ⚠️ De `VITE_*` variabelen worden **nooit** gebruikt in production. De Dev Login knop wordt volledig uit production builds verwijderd via Vite's dead-code elimination.