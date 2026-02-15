/**
 * Reset lovable branch to match origin/main.
 * Uses Bun Shell (bash-like, cross-platform).
 *
 * Run from project root: bun run scripts/reset-lovable.ts
 */

import { $ } from 'bun';

// Enable throwing on non-zero exit codes
$.throws(true);

const projectRoot = import.meta.dir + '/..';
$.cwd(projectRoot);

// Check for uncommitted changes
const status = await $`git status --porcelain`.text();
if (status.trim() !== '') {
	console.error('Error: You have uncommitted changes. Please commit or stash them first.');
	process.exit(1);
}

console.log('Switch to main...');
await $`git switch main`;

console.log('Fetch origin...');
await $`git fetch origin`;

// Check if main is in sync with origin/main
const localMain = (await $`git rev-parse main`.text()).trim();
const originMain = (await $`git rev-parse origin/main`.text()).trim();

if (localMain !== originMain) {
	console.error('Error: main is not in sync with origin/main.');
	console.error(`  Local main:  ${localMain}`);
	console.error(`  Origin main: ${originMain}`);
	console.error('Please pull or push your changes first.');
	process.exit(1);
}

console.log('Main is up-to-date with origin/main.');

console.log('Reset lovable branch to origin/main...');
await $`git checkout -B lovable origin/main`;

console.log('Force push lovable...');
await $`git push -u origin lovable --force`;

console.log('Switch back to main...');
await $`git switch main`;

console.log('Done.');
