/**
 * RLS Test Parser Utility
 *
 * This utility parses test files to map RLS policies to their corresponding tests.
 * Since we can't read files directly in the browser, this parser expects test content
 * as a string (which can be fetched via an API or imported as text).
 */

export interface TestInfo {
	filePath: string;
	describeBlock: string;
	testName: string;
	tableName?: string;
	operation?: string;
}

export interface PolicyTestMapping {
	[policyName: string]: TestInfo[];
}

/**
 * Parse a test file content and extract test information
 */
export function parseTestFile(content: string, filePath: string): TestInfo[] {
	const tests: TestInfo[] = [];

	// Extract describe blocks
	const describeRegex = /describe\(['"]([^'"]+)['"]/g;
	const itRegex = /it\(['"]([^'"]+)['"]/g;

	const describeBlocks: Array<{ block: string; startIndex: number }> = [];

	// Find all describe blocks
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

/**
 * Map policy names to tests based on naming patterns
 */
export function mapPoliciesToTests(
	policies: Array<{ table_name: string; policy_name: string; command: string }>,
	tests: TestInfo[],
): Map<string, TestInfo[]> {
	const mapping = new Map<string, TestInfo[]>();

	// Initialize mapping for all policies
	for (const policy of policies) {
		mapping.set(policy.policy_name, []);
	}

	// Map tests to policies
	for (const test of tests) {
		if (!test.tableName || !test.operation) {
			continue;
		}

		// Normalize table name (profiles -> profiles, user_roles -> roles in policy names)
		const normalizedTable = test.tableName === 'user_roles' ? 'roles' : test.tableName;
		const normalizedOperation = test.operation.toUpperCase();

		// Find matching policies
		for (const policy of policies) {
			const policyName = policy.policy_name.toLowerCase();
			const policyTable = policy.table_name.toLowerCase();
			const policyCommand = policy.command.toUpperCase();

			// Match patterns:
			// - profiles_select_* matches "RLS: profiles SELECT"
			// - roles_update_* matches "RLS: user_roles UPDATE"
			// - teacher_students_insert_* matches "RLS: teacher_students INSERT"

			const tableMatch =
				policyTable === test.tableName ||
				(normalizedTable === 'roles' && policyTable === 'user_roles' && policyName.startsWith('roles_'));

			const operationMatch =
				policyCommand === normalizedOperation || policyName.includes(normalizedOperation.toLowerCase());

			if (tableMatch && operationMatch) {
				const existing = mapping.get(policy.policy_name) || [];
				// Avoid duplicates
				if (!existing.some((t) => t.filePath === test.filePath && t.testName === test.testName)) {
					existing.push(test);
					mapping.set(policy.policy_name, existing);
				}
			}
		}
	}

	// Also try direct matching based on test descriptions
	for (const test of tests) {
		const testLower = test.testName.toLowerCase();

		for (const policy of policies) {
			const policyName = policy.policy_name.toLowerCase();

			// Direct matches: "site_admin sees all profiles" -> profiles_select_admin
			if ((testLower.includes('site_admin') || testLower.includes('admin')) && policyName.includes('admin')) {
				const existing = mapping.get(policy.policy_name) || [];
				if (!existing.some((t) => t.filePath === test.filePath && t.testName === test.testName)) {
					existing.push(test);
					mapping.set(policy.policy_name, existing);
				}
			}

			// Match by role mentions in test names
			const roles = ['site_admin', 'admin', 'staff', 'teacher', 'student'];
			for (const role of roles) {
				if (testLower.includes(role) && policyName.includes(role.replace('_', ''))) {
					const existing = mapping.get(policy.policy_name) || [];
					if (!existing.some((t) => t.filePath === test.filePath && t.testName === test.testName)) {
						existing.push(test);
						mapping.set(policy.policy_name, existing);
					}
				}
			}
		}
	}

	return mapping;
}

/**
 * Fetch the pre-generated test mapping
 * The mapping is generated at build time by scripts/generate-rls-test-mapping.ts
 */
export async function fetchTestMapping(): Promise<Map<string, TestInfo[]>> {
	try {
		const response = await fetch('/rls-test-mapping.json');
		if (!response.ok) {
			console.warn('Could not fetch RLS test mapping. Run: bun run scripts/generate-rls-test-mapping.ts');
			return new Map();
		}

		const mapping: PolicyTestMapping = await response.json();
		const map = new Map<string, TestInfo[]>();

		for (const [policyName, tests] of Object.entries(mapping)) {
			map.set(policyName, tests);
		}

		return map;
	} catch (error) {
		console.warn('Error fetching RLS test mapping:', error);
		return new Map();
	}
}
