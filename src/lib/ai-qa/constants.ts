/**
 * AI QA Review Constants
 *
 * Timeout and rate limit settings for the QA review tool.
 */

/** Retest FastGPT call timeout in milliseconds */
export const FASTGPT_RETEST_TIMEOUT = 15_000

/** Maximum retest calls per user per minute */
export const RETEST_RATE_LIMIT = 5

/** Maximum rows for CSV export */
export const MAX_EXPORT_ROWS = 5000

/** Default page size for Q&A rounds listing */
export const DEFAULT_PAGE_SIZE = 50

/** Maximum page size for Q&A rounds listing */
export const MAX_PAGE_SIZE = 200

/** Default date range: 7 days */
export const DEFAULT_DATE_RANGE_DAYS = 7
