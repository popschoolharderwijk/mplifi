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

// Check if lovable already points to the same commit as main
const lovableExists = (await $`git branch --list lovable`.text()).trim() !== '';
if (lovableExists) {
	const currentLovable = (await $`git rev-parse lovable`.text()).trim();
	const originLovable = (await $`git rev-parse origin/lovable`.text()).trim();
	
	if (currentLovable === localMain && originLovable === localMain) {
		const shortRef = localMain.slice(0, 7);
		console.log(`\nNothing to do. main and lovable already point to ${shortRef}.`);
		process.exit(0);
	}

	// Check if lovable has commits that are not in main (would be lost)
	const lovableOnlyCommits = (await $`git log main..origin/lovable --oneline`.text()).trim();
	if (lovableOnlyCommits !== '') {
		const commitCount = lovableOnlyCommits.split('\n').length;
		console.warn(`\nWarning: lovable has ${commitCount} commit(s) not in main that will be lost:`);
		console.warn(lovableOnlyCommits);
		console.warn('');
		
		// Prompt for confirmation
		process.stdout.write('Continue with reset? [y/N] ');
		const response = await new Promise<string>((resolve) => {
			process.stdin.once('data', (data) => resolve(data.toString().trim().toLowerCase()));
		});
		
		if (response !== 'y' && response !== 'yes') {
			console.log('Aborted.');
			process.exit(0);
		}
	}
}

console.log('Reset lovable branch to origin/main...');
await $`git checkout -B lovable origin/main`;

console.log('Force push lovable...');
await $`git push -u origin lovable --force`;

console.log('Switch back to main...');
await $`git switch main`;

// Verify lovable and main point to the same commit
const lovableRef = (await $`git rev-parse lovable`.text()).trim();
const shortRef = localMain.slice(0, 7);

if (localMain !== lovableRef) {
	console.error('\nError: lovable and main do not point to the same commit!');
	console.error(`  main:    ${localMain}`);
	console.error(`  lovable: ${lovableRef}`);
	process.exit(1);
}

console.log(`\nDone. main and lovable both point to ${shortRef}.`);
process.exit(0);
