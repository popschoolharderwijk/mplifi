# Troubleshooting

## Database tests falen in CI (RLS/Auth)

1. Check of `supabase start` succesvol is (zie workflow logs)
2. Controleer of credentials correct geëxporteerd zijn via `supabase status`
3. Controleer of seeding is gelukt
4. Verifieer dat `RESEND_API_KEY` secret is ingesteld in GitHub
5. Voor Auth tests: controleer of password policy correct is in `config.toml`

---

## Migraties niet toegepast

1. Controleer of je lokaal `supabase db push` hebt gedraaid
2. Check of de migratie files in `supabase/migrations/` staan
3. Verifieer dat Supabase project correct gelinked is (`supabase link`)

---

## Lokale Supabase start niet

1. Check of Docker draait
2. Probeer `supabase stop` en dan `supabase start`
3. Check disk space (Docker images zijn ~2-3GB)
4. Bekijk logs: `docker logs supabase_db_mcp`

---

## Edge Functions errors

1. Check logs: https://supabase.com/dashboard/project/<project-id>/functions
2. Verifieer secrets in Edge Function settings
3. Test lokaal met `supabase functions serve`

---

## Email verzenden faalt

1. Controleer of `RESEND_API_KEY` correct is ingesteld
2. Verifieer SMTP config in `supabase/config.toml`
3. Check Resend dashboard voor delivery status
