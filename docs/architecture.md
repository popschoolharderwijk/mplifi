# Architectuur

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Testing**: Bun test runner
- **Linting**: Biome
- **CI/CD**: GitHub Actions

---

## Supabase Omgevingen

Dit project gebruikt twee aparte Supabase omgevingen:

| Omgeving | Project ID | Gebruik |
|----------|------------|---------|
| **Development** | `zdvscmogkfyddnnxzkdu` (mcp-dev) | Directe connectie vanuit Lovable |
| **Production** | `bnagepkxryauifzyoxgo` | Productie deployment |

### Hoe dit werkt

1. **Lovable** is verbonden met `mcp-dev` - een losse development database
2. **CI tests** draaien tegen een **lokale Supabase** instance (niet remote)
3. Bij **merge naar main** worden migraties handmatig toegepast op production via `supabase db push`
