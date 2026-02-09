/**
 * Shared ticket helper functions
 *
 * Extracted from tickets/route.ts and tickets/search/route.ts
 * to eliminate duplication and ensure consistent behavior.
 */

import { mapStateIdToString } from '@/lib/constants/zammad-states'
import type { ZammadTicket as RawZammadTicket } from '@/lib/zammad/types'
import type { AuthUser as PermissionUser } from '@/lib/utils/permission'

// ============================================================================
// Priority / Status / Sort Helpers
// ============================================================================

/**
 * Map priority_id to priority string for frontend compatibility
 */
export function mapPriorityIdToString(priorityId: number): string {
  switch (priorityId) {
    case 1:
      return '1 low'
    case 2:
      return '2 normal'
    case 3:
      return '3 high'
    default:
      return '2 normal'
  }
}

/**
 * Map status name to Zammad state_id search query fragment
 */
export function getStatusSearchQuery(status?: string | null): string | null {
  if (!status) return null
  if (status === 'open') return '(state_id:1 OR state_id:2)'
  if (status === 'closed') return 'state_id:4'
  if (status === 'new') return 'state_id:1'
  if (status === 'pending') return '(state_id:3 OR state_id:7)'
  return null
}

export function mapSortField(sort: string): string {
  if (sort === 'updated_at') return 'updated_at'
  if (sort === 'priority') return 'priority_id'
  return 'created_at'
}

export function mapSortOrder(order: string): 'asc' | 'desc' {
  return order === 'asc' ? 'asc' : 'desc'
}

// ============================================================================
// Ticket Transformation
// ============================================================================

/**
 * Transform Zammad ticket to include priority, state, customer and owner information
 */
export function transformTicket(
  ticket: RawZammadTicket,
  customerInfo?: { name?: string; email?: string },
  ownerInfo?: { name?: string }
) {
  return {
    ...ticket,
    priority: mapPriorityIdToString(ticket.priority_id),
    state: mapStateIdToString(ticket.state_id),
    customer: customerInfo?.name || customerInfo?.email || `Customer #${ticket.customer_id}`,
    customer_email: customerInfo?.email,
    owner_name: ownerInfo?.name || (ticket.owner_id ? `Staff #${ticket.owner_id}` : undefined),
  }
}

// ============================================================================
// Staff Visibility Query
// ============================================================================

/**
 * Build Zammad DSL query fragment that restricts ticket visibility for Staff users.
 *
 * Staff can see:
 * - Tickets assigned to them (owner_id = their zammad_id)
 * - Tickets in their region groups (group_id in their group_ids)
 * - But NOT unassigned tickets (owner_id null/0/1)
 *
 * Returns null when the user has no visibility scope at all.
 */
export function buildStaffVisibilityQuery(user: PermissionUser): string | null {
  const clauses: string[] = []

  if (typeof user.zammad_id === 'number') {
    clauses.push(`owner_id:${user.zammad_id}`)
  }

  const groupIds = (user.group_ids || []).filter((id): id is number => Number.isFinite(id))
  if (groupIds.length === 1) {
    clauses.push(`group_id:${groupIds[0]}`)
  } else if (groupIds.length > 1) {
    clauses.push(`group_id:(${groupIds.join(' OR ')})`)
  }

  if (clauses.length === 0) {
    return null
  }

  // Keep staff visibility aligned with current permission semantics:
  // - staff can see assigned tickets
  // - staff can see regional tickets
  // - staff cannot see unassigned (owner_id null/0/1)
  return `(${clauses.join(' OR ')}) AND NOT owner_id:null AND NOT owner_id:0 AND NOT owner_id:1`
}
