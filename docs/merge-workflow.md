# Merge Workflow: Lovable → Main

## Stap 1: Lokale voorbereiding (CLI)

```bash
# Switch naar lovable branch
git switch lovable

# Haal laatste wijzigingen van remote op (fetch)
git fetch origin

# Rebase lovable op de nieuwste origin/main (lineair, geen merge commit)
git rebase origin/main

# --- Mogelijke situatie: rebase conflicts ---
# Als je een conflict krijgt in src/integrations/supabase/types.ts:
# 1. Herstel conflict door types opnieuw te genereren:
#    supabase gen types typescript --linked > src/integrations/supabase/types.ts
# 2. Laat Biome types netjes formatteren
#    biome check --write src/integrations/supabase/types.ts
# 3. Voeg file toe en ga verder met rebase
#    git add src/integrations/supabase/types.ts
#    git rebase --continue
# Herhaal indien meerdere commits conflicten geven

# Types opnieuw genereren na andere wijzigingen (nooit overslaan)
supabase link --project-ref zdvscmogkfyddnnxzkdu
supabase db reset --linked
supabase gen types typescript --linked > src/integrations/supabase/types.ts

# Run Biome check voor de rest van de code (format + lint + fix)
biome check --write .

# Commit en push eventuele fixes
git add .
git commit -m "fix: regenerate and format Supabase types, lint fixes"
git push --force-with-lease origin lovable
```

---

## Stap 2: Open Pull Request op GitHub

- Ga naar repository op GitHub
- Klik "Compare & pull request" of maak nieuwe PR
- Base: `main` ← Compare: `lovable`
- Voeg beschrijving toe van de wijzigingen

---

## Stap 3: Wacht op CI Checks

| Check | Beschrijving |
|-------|--------------|
| **Biome Linting** | Code formatting en linting |
| **Unit Tests** | Tests in `tests/code/` |
| **Supabase Preview** | Alleen bij migration changes |
| **Database Tests** | RLS + Auth tests (bij migration/test changes) |

---

## Stap 4: Review en Fix

- Bekijk CI resultaten in de PR
- Fix eventuele failures lokaal en push opnieuw

---

## Stap 5: Merge de PR

- Kies "Squash and merge" of "Merge commit"
- **Delete lovable branch NIET!**

---

## Stap 6: Post-merge Sync

```bash
# Reset lovable branch naar main (verliest Lovable history awareness!)
git checkout -B lovable origin/main
git push -u origin lovable --force
```

> ⚠️ **Let op**: Deze force push reset de lovable branch volledig naar main. Lovable verliest hierdoor awareness van eerdere commits op de lovable branch.
