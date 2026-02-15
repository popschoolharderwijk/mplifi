/**
 * Reset local Supabase development DB, regenerate TypeScript types, and run Biome.
 * Uses Bun Shell (bash-like, cross-platform).
 *
 * Run from project root: bun run scripts/reset-db.ts
 */

import { $ } from 'bun';

const projectRoot = import.meta.dir + '/..';
$.cwd(projectRoot);

console.log('Linking Supabase project...');
await $`supabase link --project-ref zdvscmogkfyddnnxzkdu`;

console.log('Resetting database...');
await $`supabase db reset --linked --yes`;

console.log('Generating TypeScript types...');
await $`supabase gen types typescript --linked > src/integrations/supabase/types.ts`;

console.log('Running Biome check...');
await $`biome check --write ./src/integrations/supabase/types.ts`;

console.log('Done.');
