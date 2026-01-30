# Architectuur

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Testing**: Bun test runner
- **Linting**: Biome
- **CI/CD**: GitHub Actions

---

## Rollen en Permissies

De applicatie gebruikt een role-based access control (RBAC) systeem met de volgende rollen:

| Rol | Beschrijving |
|-----|-------------|
| `site_admin` | Volledige toegang, kan alle rollen beheren |
| `admin` | Kan gebruikers en rollen beheren (behalve site_admin) |
| `staff` | Kan gebruikersgegevens inzien |
| `teacher` | Beperkte toegang tot eigen gegevens |
| *(geen rol)* | Standaard gebruiker, alleen eigen profiel |

### Role Management Permissies

| Actie | admin | site_admin |
|-------|-------|------------|
| Rollen toewijzen (INSERT) | ✅ (geen site_admin) | ✅ |
| Rollen wijzigen (UPDATE) | ✅ (geen site_admin) | ✅ |
| Rollen verwijderen (DELETE) | ✅ (geen site_admin) | ✅ |
| Eigen rol wijzigen | ❌ | ❌ |

> ⚠️ **Bescherming**: De laatste `site_admin` kan niet worden verwijderd of gedemoteerd (database trigger).

---

## Supabase Omgevingen

Dit project gebruikt twee aparte Supabase omgevingen:

| Omgeving | Project ID | Gebruik |
|----------|------------|---------|
| **Development** | `zdvscmogkfyddnnxzkdu` (mcp-dev) | Directe connectie vanuit Lovable |
| **Production** | `bnagepkxryauifzyoxgo` | Productie deployment |

### Hoe dit werkt

1. **Lovable** is verbonden met `mcp-dev` - een losse development database
2. **CI tests** draaien tegen een **lokale Supabase** instance
3. Bij **merge naar main** worden migraties handmatig toegepast op production via `supabase db push`
