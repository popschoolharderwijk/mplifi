# Troubleshooting

## Database tests falen in CI (RLS/Auth)

1. Controleer of alle vereiste GitHub secrets aanwezig zijn: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`
2. Controleer of `supabase db reset --linked --yes` in de workflow is geslaagd (seed wordt dan toegepast)
3. Verifieer dat `RESEND_API_KEY` secret is ingesteld in GitHub (voor email-tests)
4. Voor Auth tests: controleer of password policy correct is in `config.toml`

---

## Migraties niet toegepast

1. Controleer of je lokaal `supabase db push` hebt gedraaid
2. Check of de migratie files in `supabase/migrations/` staan
3. Verifieer dat Supabase project correct gelinked is (`supabase link`)

---

## Tests falen lokaal (RLS/Auth)

1. Zet in je omgeving (of `.env.test`) de credentials van het project waar je tegen test: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `VITE_DEV_LOGIN_PASSWORD` (seed-users: wachtwoord `password`). Gebruik **mcp-test**-credentials om hetzelfde als CI te gebruiken, of **mcp-dev** als je daar tegen ontwikkelt.
2. Optioneel: voor mcp-dev kun je `bun run reset-db:dev` draaien voor een schone database met seed.

---

## Edge Functions errors

1. Check logs: https://supabase.com/dashboard/project/<project-id>/functions
2. Verifieer secrets in Edge Function settings
3. Test lokaal met `supabase functions serve`

### verify_jwt = true geeft 401 bij POST

**Probleem**: Met `verify_jwt = true` in `config.toml` krijgen POST requests een 401 Unauthorized, zelfs met een geldige JWT.

**Oorzaak**: De JWT gebruikt ES256 (asymmetrische signing), maar de Supabase Edge Runtime lijkt dit niet correct te verifiëren.

**Oplossing**: Gebruik `verify_jwt = false` en verifieer de JWT handmatig in de Edge Function via `supabase.auth.getUser()`. Dit werkt correct en controleert ook de sessie-status.

```typescript
// In de Edge Function:
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
```

> 📝 Zie ook de FIXME in `supabase/config.toml` voor meer context.

---

## Email verzenden faalt

1. Controleer of `RESEND_API_KEY` correct is ingesteld
2. Verifieer SMTP config in `supabase/config.toml`
3. Check Resend dashboard voor delivery status
