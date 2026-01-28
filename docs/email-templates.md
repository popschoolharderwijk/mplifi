# Email Templates Configuratie

De `email-templates` map bevat de email templates die in Supabase moeten worden ingesteld.

## Waar instellen in Supabase Dashboard

1. Ga naar [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecteer je project (dev of prod)
3. Navigeer naar: **Authentication** → **Email**
4. Klik op **Magic Link**

## Template instellen

### Subject (onderwerp)
```
Je inloglink
```

### Body (HTML)
Kopieer de volledige inhoud van `magic-link.html` in dit mapje en plak deze in het "Body" veld.

## Beschikbare variabelen

| Variabele | Beschrijving |
|-----------|--------------|
| `{{ .ConfirmationURL }}` | De volledige Magic Link URL |
| `{{ .Token }}` | De OTP code |
| `{{ .TokenHash }}` | Hash van de token (voor URLs) |
| `{{ .SiteURL }}` | Je geconfigureerde Site URL |
| `{{ .Email }}` | Het emailadres van de gebruiker |

## Belangrijk: Doe dit voor BEIDE omgevingen

- **Development**: `zdvscmogkfyddnnxzkdu`
- **Production**: `bnagepkxryauifzyoxgo`

---

## Custom SMTP (Resend)

We gebruiken [Resend](https://resend.com) als custom SMTP provider voor betrouwbare email delivery.

### SMTP via config.toml

Alle SMTP settings worden beheerd via `supabase/config.toml` en gepusht naar remote projects. **Geen handmatige Dashboard configuratie nodig!**

De SMTP configuratie staat in de `[auth.email.smtp]` sectie:

> 📝 **Belangrijk**: De `pass = "env(RESEND_API_KEY)"` syntax betekent dat de API key uit een environment variable wordt gelezen. Zorg dat `RESEND_API_KEY` in je `.env` bestand staat.

### Resend Setup

1. Maak een account aan op [resend.com](https://resend.com)
2. Ga naar **Settings** → **API Keys** en maak een nieuwe API key aan
3. Ga naar **Settings** → **Domains** en verifieer je domein (DNS records toevoegen)
4. Voeg de API key toe aan je `.env` bestand:
   
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### SMTP Settings Pushen

Na het configureren van `config.toml` en het toevoegen van `RESEND_API_KEY` aan `.env`, push de settings naar je remote project:

```bash
# Link aan het project (als nog niet gedaan)
supabase link --project-ref <project-id>

# Push configuratie naar remote
supabase config push

# Review de changes die gepusht worden
# Type 'Y' om te bevestigen
```

> ⚠️ **Let op**: De sender email (`admin_email`) moet een geverifieerd domein zijn in Resend.
> Voor development kun je `xxx@resend.dev` gebruiken (Resend test domain).
