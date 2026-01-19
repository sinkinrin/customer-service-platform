/**
 * Zammad System Constants
 *
 * Centralized constants for Zammad role IDs, state IDs, and priority IDs.
 * These values are defined by the Zammad system and should not be changed
 * unless the Zammad configuration is updated.
 *
 * @see docs/architecture/authorization-system-v2.md
 * @see docs/architecture/authorization-system-v3-complete.md
 */

/**
 * Zammad Role IDs
 * Retrieved from Zammad API: GET /api/v1/roles
 */
export const ZAMMAD_ROLES = {
  ADMIN: 1,
  AGENT: 2,
  CUSTOMER: 3,
} as const

/**
 * Zammad Ticket State IDs
 * Retrieved from Zammad API: GET /api/v1/ticket_states
 */
export const ZAMMAD_STATES = {
  NEW: 1,
  OPEN: 2,
  PENDING_REMINDER: 3,
  CLOSED: 4,
  MERGED: 5,
  PENDING_CLOSE: 6,
} as const

/**
 * Zammad Ticket Priority IDs
 * Retrieved from Zammad API: GET /api/v1/ticket_priorities
 */
export const ZAMMAD_PRIORITIES = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
} as const

/**
 * Zammad System User ID
 * Represents "unassigned" state for ticket owner
 */
export const ZAMMAD_SYSTEM_USER_ID = 1

export type ZammadRoleId = (typeof ZAMMAD_ROLES)[keyof typeof ZAMMAD_ROLES]
export type ZammadStateId = (typeof ZAMMAD_STATES)[keyof typeof ZAMMAD_STATES]
export type ZammadPriorityId = (typeof ZAMMAD_PRIORITIES)[keyof typeof ZAMMAD_PRIORITIES]
