/**
 * Shared test utilities and helper functions.
 */

/**
 * Generate a unique test email address.
 * Uses timestamp and random string to ensure uniqueness across test runs.
 *
 * @param prefix - Optional prefix for the email (default: 'test')
 * @returns A unique email address in the format: {prefix}-{timestamp}-{random}@example.com
 */
export function generateTestEmail(prefix = 'test') {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}
