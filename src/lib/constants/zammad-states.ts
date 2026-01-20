/**
 * Zammad Ticket State Constants
 *
 * Centralized mapping between Zammad state_id and state name strings.
 * This avoids duplicating the mapping logic across multiple API routes.
 *
 * Zammad state_id mapping (from actual Zammad API /api/v1/ticket_states):
 * 1 = new
 * 2 = open
 * 3 = pending reminder
 * 4 = closed
 * 5 = merged
 * 6 = pending close
 * 7 = pending close (alternative, some Zammad versions)
 */

export const ZAMMAD_STATE_IDS = {
    NEW: 1,
    OPEN: 2,
    PENDING_REMINDER: 3,
    CLOSED: 4,
    MERGED: 5,
    PENDING_CLOSE: 6,
} as const

export const ZAMMAD_STATE_NAMES: Record<number, string> = {
    1: 'new',
    2: 'open',
    3: 'pending reminder',
    4: 'closed',
    5: 'merged',
    6: 'pending close',
}

/**
 * Map Zammad state_id to human-readable state string
 * Used for API responses to provide consistent state names
 */
export function mapStateIdToString(stateId: number): string {
    return ZAMMAD_STATE_NAMES[stateId] || 'closed'
}

/**
 * Check if a ticket state is considered "active" (not closed/merged)
 */
export function isActiveState(stateId: number): boolean {
    const activeStates: number[] = [
        ZAMMAD_STATE_IDS.NEW,
        ZAMMAD_STATE_IDS.OPEN,
        ZAMMAD_STATE_IDS.PENDING_REMINDER,
        ZAMMAD_STATE_IDS.PENDING_CLOSE,
    ]
    return activeStates.includes(stateId)
}

/**
 * Get state IDs that should be counted for agent workload
 */
export function getActiveStateIds(): number[] {
    return [
        ZAMMAD_STATE_IDS.NEW,
        ZAMMAD_STATE_IDS.OPEN,
        ZAMMAD_STATE_IDS.PENDING_REMINDER,
        ZAMMAD_STATE_IDS.PENDING_CLOSE,
    ]
}
