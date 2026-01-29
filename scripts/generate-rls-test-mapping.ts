/**
 * Build-time script to generate RLS test mapping
 * This script parses all test files and generates a JSON mapping file
 * that can be imported by the frontend.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface TestInfo {
	filePath: string;
	describeBlock: string;
	testName: string;
	tableName?: string;
	operation?: string;
}

interface PolicyTestMapping {
	[policyName: string]: TestInfo[];
}

async function findTestFiles(dir: string, baseDir: string = dir): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await findTestFiles(fullPath, baseDir)));
		} else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
			files.push(fullPath);
		}
	}

	return files;
}

function parseTestFile(content: string, filePath: string): TestInfo[] {
	const tests: TestInfo[] = [];

	// Extract describe blocks with their positions
	const describeRegex = /describe\(['"]([^'"]+)['"]/g;
	const itRegex = /it\(['"]([^'"]+)['"]/g;

	const describeBlocks: Array<{ block: string; startIndex: number }> = [];

	for (const describeMatch of content.matchAll(describeRegex)) {
		describeBlocks.push({
			block: describeMatch[1],
			startIndex: describeMatch.index ?? 0,
		});
	}

	// Find all it blocks and associate them with their describe block
	for (const itMatch of content.matchAll(itRegex)) {
		const testName = itMatch[1];
		const testIndex = itMatch.index ?? 0;

		// Find the closest describe block before this test
		let currentDescribe = '';
		for (let i = describeBlocks.length - 1; i >= 0; i--) {
			if (describeBlocks[i].startIndex < testIndex) {
				currentDescribe = describeBlocks[i].block;
				break;
			}
		}

		// Extract table and operation from describe block if it follows "RLS: table OPERATION" pattern
		const rlsMatch = currentDescribe.match(/RLS:\s*(\w+)\s+(\w+)/i);
		const tableName = rlsMatch?.[1];
		const operation = rlsMatch?.[2];

		tests.push({
			filePath,
			describeBlock: currentDescribe,
			testName,
			tableName,
			operation,
		});
	}

	return tests;
}

async function generateMapping() {
	const testsBaseDir = join(process.cwd(), 'tests');
	const rlsTestsDir = join(testsBaseDir, 'rls');
	const testFiles = await findTestFiles(rlsTestsDir);

	const allTests: TestInfo[] = [];

	for (const filePath of testFiles) {
		const content = await readFile(filePath, 'utf-8');
		// Make path relative from tests directory
		const relativePath = filePath
			.replace(testsBaseDir, '')
			.replace(/^[/\\]/, '')
			.replace(/\\/g, '/');
		const tests = parseTestFile(content, relativePath);
		allTests.push(...tests);
	}

	// Generate policy name patterns based on test information
	const mapping: PolicyTestMapping = {};

	// Known policy patterns from baseline migration
	const knownPolicies = [
		// Profiles
		'profiles_select_own',
		'profiles_select_admin',
		'profiles_select_staff',
		'profiles_select_teacher_students',
		'profiles_update_own',
		'profiles_update_admin',
		'profiles_update_staff',
		// User roles
		'roles_select_own',
		'roles_select_admin',
		'roles_select_staff',
		'roles_select_teacher_students',
		'roles_update_site_admin',
		// Teacher students
		'teacher_students_select_own',
		'teacher_students_insert_own',
		'teacher_students_delete_own',
		'teacher_students_select_admin',
		'teacher_students_select_staff',
	];

	// Map tests to policies
	for (const policy of knownPolicies) {
		mapping[policy] = [];
	}

	for (const test of allTests) {
		if (!test.tableName || !test.operation) {
			continue;
		}

		// Normalize table name
		const normalizedTable = test.tableName === 'user_roles' ? 'roles' : test.tableName;
		const normalizedOperation = test.operation.toUpperCase();

		// Match tests to policies
		for (const policy of knownPolicies) {
			const policyLower = policy.toLowerCase();
			const policyTable = policyLower.split('_')[0]; // profiles, roles, teacher_students
			const policyOp = policyLower.includes('select')
				? 'SELECT'
				: policyLower.includes('insert')
					? 'INSERT'
					: policyLower.includes('update')
						? 'UPDATE'
						: policyLower.includes('delete')
							? 'DELETE'
							: '';

			const tableMatch =
				policyTable === normalizedTable.toLowerCase() ||
				(normalizedTable === 'roles' && policyTable === 'roles');

			const operationMatch = policyOp === normalizedOperation;

			if (tableMatch && operationMatch) {
				// Check if test is relevant to this policy based on test name
				const testLower = test.testName.toLowerCase();
				const policySuffix = policyLower.split('_').slice(2).join('_'); // own, admin, staff, etc.

				let isRelevant = false;

				if (policySuffix === 'own' && (testLower.includes('own') || testLower.includes('sees only'))) {
					isRelevant = true;
				} else if (
					policySuffix === 'admin' &&
					(testLower.includes('admin') || testLower.includes('site_admin'))
				) {
					isRelevant = true;
				} else if (policySuffix === 'staff' && testLower.includes('staff')) {
					isRelevant = true;
				} else if (policySuffix === 'teacher_students' && testLower.includes('teacher')) {
					isRelevant = true;
				} else if (policySuffix === 'site_admin' && testLower.includes('site_admin')) {
					isRelevant = true;
				}

				// Also match if describe block matches
				if (test.describeBlock.toLowerCase().includes(policySuffix)) {
					isRelevant = true;
				}

				if (isRelevant) {
					if (!mapping[policy].some((t) => t.filePath === test.filePath && t.testName === test.testName)) {
						mapping[policy].push(test);
					}
				}
			}
		}
	}

	// Write mapping to public directory so it can be fetched
	const outputPath = join(process.cwd(), 'public', 'rls-test-mapping.json');
	const output = JSON.stringify(mapping, null, 2);
	await writeFile(outputPath, output, 'utf-8');

	console.log(`Generated RLS test mapping with ${Object.keys(mapping).length} policies`);
	console.log(`Total tests mapped: ${Object.values(mapping).reduce((sum, tests) => sum + tests.length, 0)}`);
}

generateMapping().catch(console.error);
