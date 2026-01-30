# Deployment naar Productie

Na het mergen van een PR naar `main`, moeten wijzigingen handmatig naar production worden gepusht.

---

## Wanneer deployen?

| Wijziging | Actie nodig |
|-----------|-------------|
| Database migraties (`supabase/migrations/`) | `supabase db push` |
| Auth/config wijzigingen (`supabase/config.toml`) | `supabase config push` |
| Edge Functions | `supabase functions deploy` |
| Alleen frontend code | Geen actie (Lovable deployt automatisch) |

---

## Stap 1: Link aan Production

```bash
supabase link --project-ref bnagepkxryauifzyoxgo
```

---

## Stap 2: Push Migraties

```bash
# Bekijk welke migraties worden toegepast
supabase db push --dry-run

# Push migraties naar production
supabase db push
```

---

## Stap 3: Push Config (indien gewijzigd)

```bash
# Bekijk diff van config wijzigingen
supabase config push

# Review de changes en type 'Y' om te bevestigen
```

> ⚠️ **Let op**: `config push` overschrijft remote settings. Review altijd de diff!

---

## Stap 4: Deploy Edge Functions (indien aanwezig)

```bash
# Deploy specifieke function
supabase functions deploy <function-name>

# Deploy alle functions
supabase functions deploy
```

### Beschikbare Edge Functions

| Function | Doel | Vereiste secrets |
|----------|------|------------------|
| `delete-user` | AVG: accounts verwijderen (self-service + admin) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (automatisch beschikbaar) |

**Gebruik `delete-user`:**
- Zonder body: gebruiker verwijdert eigen account
- Met `{ "userId": "..." }`: admin/site_admin verwijdert ander account

### Edge Functions Structuur

Edge Functions gebruiken een gedeelde CORS helper voor browser invocations:

- **`_shared/cors.ts`**: Gedeelde CORS headers voor alle Edge Functions
  - Gebaseerd op [Supabase's aanbevolen CORS setup](https://supabase.com/docs/guides/functions/cors)
  - Gebruikt `'*'` voor `Access-Control-Allow-Origin` (development)
  - Alle Edge Functions importeren `corsHeaders` uit `../_shared/cors.ts`

**Nieuwe Edge Function aanmaken:**
1. Maak folder aan in `supabase/functions/<function-name>/`
2. Maak `index.ts` aan
3. Importeer `corsHeaders` uit `../_shared/cors.ts`
4. Handle OPTIONS requests voor CORS preflight
5. Gebruik `corsHeaders` in alle Response headers

**Voorbeeld:**
```typescript
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  return new Response(JSON.stringify({ data: '...' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
```

### Edge Function Configuratie

Edge Functions kunnen geconfigureerd worden in `supabase/config.toml`:

```toml
[functions.delete-user]
verify_jwt = false  # Of true voor gateway-level JWT verificatie
```

> ⚠️ **Let op**: Met `verify_jwt = false` moet de Edge Function zelf JWT validatie uitvoeren. De gateway blokkeert dan geen requests.

---

## Checklist

- [ ] PR gemerged naar `main`
- [ ] `supabase link --project-ref bnagepkxryauifzyoxgo`
- [ ] `supabase db push` (bij migratie wijzigingen)
- [ ] `supabase config push` (bij config wijzigingen)
- [ ] `supabase functions deploy` (bij edge function wijzigingen)
- [ ] Productie getest
