/**
 * Constants for agenda utils unit tests.
 * These values are derived from the test setup (mock agreements, date ranges)
 * and are NOT from seed data. Used to avoid hardcoded values in assertions.
 */
export const AGENDA_UTILS_TEST = {
	/** Mondays in February 2025 */
	MONDAYS_IN_FEB_2025: 4,

	/** Daily events Feb 10–14 (5 days) */
	DAILY_EVENTS_FEB_10_14: 5,

	/** Recurring deviation events: Feb 20, 27, Mar 6, 13, 20, 27, Apr 3 (weekly from actual_date in range) */
	RECURRING_DEVIATION_EVENTS_FEB_MAR_APR: 7,

	/** Deviation events with recurring_end_date 2025-03-02: Feb 20, Feb 27 */
	DEVIATION_EVENTS_UNTIL_2025_03_02: 2,

	/** Monthly events Jan 6–Apr 30 (first Monday of each month) */
	MONTHLY_EVENTS_JAN_6_APR_30: 4,
} as const;
