# Supabase Server Setup

Stappenplan om een lege Supabase server werkend te krijgen met deze applicatie.

---

## Stap 1: Nieuw Supabase Project

1. Ga naar [supabase.com/dashboard](https://supabase.com/dashboard)
2. Klik "New Project"
3. Kies organisatie en vul in:
   - **Name**: `mcp-dev` of `mcp-prod`
   - **Database Password**: Genereer en bewaar veilig
   - **Region**: `West EU (Frankfurt)` (dichtbij)
4. Wacht tot project is aangemaakt
5. Noteer de **Project ID** (uit de URL of Project Settings)

---

## Stap 2: Storage Buckets Aanmaken

Storage buckets kunnen **niet** via SQL migraties worden aangemaakt, dus moeten apart geconfigureerd worden **voordat** je de migraties toepast.

**Optie A: Via script (aanbevolen)**

```bash
bun run create-storage-bucket
```

Dit script:
- Maakt de `avatars` bucket aan
- Configureert als public bucket
- Stelt max bestandsgrootte in (5MB)
- Beperkt tot image types (jpeg, png, gif, webp)

**Optie B: Via Dashboard**

1. **Dashboard** → **Storage** → **New bucket**
2. Configureer:
   - **Name**: `avatars`
   - **Public bucket**: ✅ Enabled
   - **Allowed MIME types**: `image/jpeg, image/png, image/gif, image/webp`
   - **File size limit**: `5MB`

---

## Stap 3: Migraties Toepassen

```bash
# Link aan het nieuwe project
supabase link --project-ref <project-id>

# Push alle migraties
supabase db push
```

Dit past toe:
- `20260116145900_baseline.sql` - Basis tabellen en RLS
- `20260116160000_add_security_introspection.sql` - Security helper functies
- `20260117000000_create_avatars_storage.sql` - Storage bucket RLS policies

---

## Stap 4: Authentication Configureren

### Providers inschakelen

**Dashboard** → **Authentication** → **Providers**

- ✅ Email (moet aan staan)
- Andere providers naar wens

### Password & OTP Security

**Dashboard** → **Authentication** → **Policies**

| Instelling | Waarde |
|------------|--------|
| Minimum password length | `32` |
| Password requirements | `letters, digits, and symbols` (meest complexe optie) |
| Email OTP length | `8` |

> ⚠️ **Waarom zo complexe password requirements?**
> 
> Deze applicatie gebruikt uitsluitend **OTP/Magic Link** voor authenticatie. De frontend biedt **geen mogelijkheid** om een wachtwoord in te stellen of te gebruiken.
> 
> Echter, Supabase ondersteunt aan de achterkant technisch gezien wel password-based authenticatie via de API. Om misbruik via directe API calls te voorkomen, stellen we de password requirements zo hoog mogelijk in. Een wachtwoord van 32+ karakters met letters, cijfers én symbolen is praktisch onmogelijk te raden of bruteforcen.

> 💡 **Verificatie via tests**
> 
> De password policy wordt geverifieerd door `tests/auth/password-signup.test.ts`. Deze test controleert dat:
> - Wachtwoorden korter dan 32 karakters worden geweigerd
> - Wachtwoorden zonder symbolen, cijfers, of letters worden geweigerd
> - Alleen wachtwoorden die aan alle eisen voldoen worden geaccepteerd

### URL Configuration

**Dashboard** → **Authentication** → **URL Configuration**

| Veld | Development | Production |
|------|-------------|------------|
| Site URL | `http://localhost:5173` | `https://jouw-domein.nl` |
| Redirect URLs | `http://localhost:5173/auth/callback` | `https://jouw-domein.nl/auth/callback` |

### Auth Settings

**Dashboard** → **Project Settings** → **Auth**

- **JWT Expiry**: 3600 (standaard is prima)
- **Refresh Token Rotation**: ✅ Enabled

---

## Stap 5: Email Templates

Zie [email-templates.md](email-templates.md) voor:
- Magic Link template instellen
- Custom SMTP configureren (Resend)

---

## Stap 6: API Keys Ophalen

**Dashboard** → **Project Settings** → **API**

Noteer:
- **Project URL**: `https://<project-id>.supabase.co`
- **Anon/Public Key**: Voor frontend (`VITE_SUPABASE_ANON_KEY`)
- **Service Role Key**: Voor backend/tests (⚠️ geheim houden!)

---

## Stap 7: Environment Files Aanmaken

### Voor development (.env.development)

```bash
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### Voor lokale tests (.env.local)

```bash
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

---

## Stap 8: Secrets Configureren

Zie [secrets.md](secrets.md) voor:
- GitHub Secrets (voor CI/CD)
- Edge Function Secrets

---

## Stap 9: GitHub Integratie (voor Production)

Voor Supabase branching en preview deployments:

1. **Dashboard** → **Project Settings** → **Integrations**
2. Klik "GitHub" → "Connect"
3. Selecteer repository
4. Configureer:
   - **Production branch**: `main`
   - **Preview branches**: Enabled
   - **Supabase changes only**: ✅ (preview alleen bij migration changes)

---

## Stap 10: Config.toml Bijwerken

Update `supabase/config.toml` met de nieuwe project ID:

```toml
[remotes.nieuw]
project_id = "<nieuwe-project-id>"

[remotes.nieuw.db.seed]
enabled = true  # of false voor production
```

---

## Checklist

- [ ] Project aangemaakt
- [ ] Storage bucket `avatars` aangemaakt (`bun run create-storage-bucket`)
- [ ] Migraties toegepast (`supabase db push`)
- [ ] Email provider ingeschakeld
- [ ] Password requirements op maximum (32 chars, letters+digits+symbols)
- [ ] Password policy tests draaien (`bun test tests/auth/password-signup.test.ts`)
- [ ] Email OTP length op 8
- [ ] URL configuratie correct
- [ ] Email templates ingesteld
- [ ] SMTP geconfigureerd (Resend)
- [ ] API keys opgehaald
- [ ] Environment files aangemaakt
- [ ] GitHub integratie (production)
