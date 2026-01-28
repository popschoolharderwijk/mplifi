# Secrets Configuratie

## GitHub Secrets

Nodig voor CI workflows. Toe te voegen via:
**GitHub** → Settings → Secrets and variables → Actions → New repository secret

| Secret | Waarde | Gebruik |
|--------|--------|---------|
| `RESEND_API_KEY` | API key van Resend.com | Email verzenden in tests (SMTP config) |

### RESEND_API_KEY verkrijgen

1. Ga naar https://resend.com/api-keys
2. Maak een nieuwe API key aan
3. Voeg toe als GitHub secret

---

## Lokale Supabase Credentials (CI)

Voor lokale Supabase testing in CI worden credentials **dynamisch opgehaald** van de draaiende instance via `supabase status -o json`. Dit zorgt ervoor dat JWT keys altijd matchen met de secret van de lokale instance.

| Variabele | Bron | Notities |
|-----------|------|----------|
| `SUPABASE_URL` | `supabase status` → `API_URL` | Lokale API endpoint |
| `SUPABASE_PUBLISHABLE_DEFAULT_KEY` | `supabase status` → `ANON_KEY` | Anon key van draaiende instance |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase status` → `SERVICE_ROLE_KEY` | Service key van draaiende instance |

Zie `.github/workflows/pull-request-test-code-and-supabase.yml` voor implementatie.

⚠️ **Commit nooit production keys!** Production credentials horen in GitHub Secrets of Supabase Dashboard.

---

## Supabase Edge Function Secrets

Voor Edge Functions. Toe te voegen via:
**Supabase Dashboard** → Project Settings → Edge Functions → Secrets

| Secret | Beschrijving |
|--------|--------------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (⚠️ NOOIT `VITE_` prefix!) |
