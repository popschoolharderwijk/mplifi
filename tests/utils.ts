/**
 * Shared test utilities and helper functions.
 */

/**
 * Email domain for dynamically generated test accounts.
 * Using real domain since production Supabase rejects @example.com
 */
export const TEST_EMAIL_DOMAIN = 'popschoolharderwijk.nl';

/**
 * Generate a unique test email address.
 * Uses timestamp and random string to ensure uniqueness across test runs.
 *
 * @param prefix - Optional prefix for the email (default: 'test')
 * @returns A unique email address in the format: {prefix}-{timestamp}-{random}@popschoolharderwijk.nl
 */
export function generateTestEmail(prefix = 'test') {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@${TEST_EMAIL_DOMAIN}`;
}
