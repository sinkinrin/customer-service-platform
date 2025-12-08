/**
 * Region-based Authorization Utilities
 *
 * Provides region permission validation for staff users
 * - Staff can only access tickets from their assigned region
 * - Admin can access all regions
 * - Customer can only access their own tickets
 */

import { getGroupIdByRegion, getRegionByGroupId, type RegionValue } from '@/lib/constants/regions'

/**
 * User interface for region authorization
 * Compatible with both MockUser and AuthUser types
 */
interface RegionAuthUser {
  id: string
  email: string
  role: 'customer' | 'staff' | 'admin'
  region?: string
}

/**
 * Check if a user has permission to access a specific region
 * @param user - The user to check
 * @param region - The region to check access for
 * @returns true if user has access, false otherwise
 */
export function hasRegionAccess(user: RegionAuthUser, region: RegionValue): boolean {
  // Admin can access all regions
  if (user.role === 'admin') {
    return true
  }

  // Staff can only access their assigned region
  if (user.role === 'staff') {
    return user.region === region
  }

  // Customer can access their own region
  if (user.role === 'customer') {
    return user.region === region
  }

  return false
}

/**
 * Check if a user has permission to access a specific Zammad group
 * @param user - The user to check
 * @param groupId - The Zammad group ID to check access for
 * @returns true if user has access, false otherwise
 */
export function hasGroupAccess(user: RegionAuthUser, groupId: number): boolean {
  // Admin can access all groups
  if (user.role === 'admin') {
    return true
  }

  // Use getAccessibleGroupIds which already handles:
  // - Staff: their region's group + Users group (ID=1) for legacy tickets
  // - Customer: Users group (ID=1)
  const accessibleGroupIds = getAccessibleGroupIds(user)
  return accessibleGroupIds.includes(groupId)
}

/**
 * Get the list of group IDs that a user can access
 * @param user - The user to get accessible groups for
 * @returns Array of group IDs the user can access
 */
export function getAccessibleGroupIds(user: RegionAuthUser): number[] {
  // Admin can access all groups
  if (user.role === 'admin') {
    // Return all 8 region group IDs
    return [1, 2, 3, 4, 5, 6, 7, 8]
  }

  // Customers always have access to group ID 1 (Users group)
  // This is where customer-initiated tickets are created
  if (user.role === 'customer') {
    return [1]
  }

  // Staff can access their region's group AND the Users group (ID=1)
  // Users group contains legacy customer tickets created before region-based routing
  if (user.role === 'staff' && user.region) {
    const groupId = getGroupIdByRegion(user.region as RegionValue)
    // Include group 1 (Users) for backward compatibility with legacy tickets
    return groupId === 1 ? [1] : [groupId, 1]
  }

  return []
}

/**
 * Get the list of regions that a user can access
 * @param user - The user to get accessible regions for
 * @returns Array of region values the user can access
 */
export function getAccessibleRegions(user: RegionAuthUser): RegionValue[] {
  // Admin can access all regions
  if (user.role === 'admin') {
    return [
      'asia-pacific',
      'middle-east',
      'africa',
      'north-america',
      'latin-america',
      'europe-zone-1',
      'europe-zone-2',
      'cis',
    ]
  }

  // Staff and customer can only access their region
  if (user.region) {
    return [user.region as RegionValue]
  }

  return []
}

/**
 * Filter tickets by user's accessible regions
 * R5: Customers now see all their tickets regardless of group reassignment
 * @param tickets - Array of tickets to filter
 * @param user - The user to filter for
 * @returns Filtered array of tickets
 */
export function filterTicketsByRegion<T extends { group_id?: number; customer_id?: number }>(
  tickets: T[],
  user: RegionAuthUser
): T[] {
  // Admin can see all tickets
  if (user.role === 'admin') {
    return tickets
  }

  // R5: Customers see all their tickets regardless of group_id
  // Zammad API with X-On-Behalf-Of already filters by customer ownership
  // So we don't need additional group_id filtering for customers
  if (user.role === 'customer') {
    return tickets
  }

  // Staff: Filter by accessible group IDs (region-based)
  const accessibleGroupIds = getAccessibleGroupIds(user)

  return tickets.filter((ticket) => {
    if (!ticket.group_id) {
      return false
    }
    return accessibleGroupIds.includes(ticket.group_id)
  })
}

/**
 * Validate that a user can create a ticket in a specific region
 * @param user - The user attempting to create the ticket
 * @param region - The region to create the ticket in
 * @throws Error if user doesn't have permission
 */
export function validateTicketCreation(user: RegionAuthUser, region: RegionValue): void {
  if (!hasRegionAccess(user, region)) {
    throw new Error(`You do not have permission to create tickets in region: ${region}`)
  }
}

/**
 * Validate that a user can access a specific ticket
 * @param user - The user attempting to access the ticket
 * @param ticketGroupId - The group ID of the ticket
 * @throws Error if user doesn't have permission
 */
export function validateTicketAccess(user: RegionAuthUser, ticketGroupId: number): void {
  if (!hasGroupAccess(user, ticketGroupId)) {
    const region = getRegionByGroupId(ticketGroupId)
    throw new Error(`You do not have permission to access tickets in region: ${region || 'unknown'}`)
  }
}

// ============================================================================
// Conversation Region Authorization
// ============================================================================

/**
 * Interface for conversation with region field
 */
interface ConversationWithRegion {
  id: string
  region?: RegionValue
  customer_id?: string
  customer_email?: string
}

/**
 * Check if a user has permission to access a conversation based on region
 * @param user - The user to check
 * @param conversation - The conversation to check access for
 * @returns true if user has access, false otherwise
 */
export function hasConversationRegionAccess(
  user: RegionAuthUser,
  conversation: ConversationWithRegion
): boolean {
  // Admin can access all conversations
  if (user.role === 'admin') {
    return true
  }

  // Customer can only access their own conversations (regardless of region)
  if (user.role === 'customer') {
    return conversation.customer_email === user.email
  }

  // Staff can only access conversations in their region
  if (user.role === 'staff') {
    // If conversation has no region, allow access (legacy data)
    if (!conversation.region) {
      return true
    }
    return conversation.region === user.region
  }

  return false
}

/**
 * Filter conversations by user's accessible regions
 * @param conversations - Array of conversations to filter
 * @param user - The user to filter for
 * @returns Filtered array of conversations
 */
export function filterConversationsByRegion<T extends ConversationWithRegion>(
  conversations: T[],
  user: RegionAuthUser
): T[] {
  // Admin can see all conversations
  if (user.role === 'admin') {
    return conversations
  }

  // Customer sees only their own conversations
  if (user.role === 'customer') {
    return conversations.filter(c => c.customer_email === user.email)
  }

  // Staff: Filter by region
  if (user.role === 'staff') {
    return conversations.filter(c => {
      // Allow access to conversations without region (legacy data)
      if (!c.region) {
        return true
      }
      return c.region === user.region
    })
  }

  return []
}

/**
 * Validate that a user can access a specific conversation
 * @param user - The user attempting to access the conversation
 * @param conversation - The conversation to access
 * @throws Error if user doesn't have permission
 */
export function validateConversationAccess(
  user: RegionAuthUser,
  conversation: ConversationWithRegion
): void {
  if (!hasConversationRegionAccess(user, conversation)) {
    throw new Error(`You do not have permission to access this conversation in region: ${conversation.region || 'unknown'}`)
  }
}
