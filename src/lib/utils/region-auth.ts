/**
 * Region-based Authorization Utilities
 * 
 * Provides region permission validation for staff users
 * - Staff can only access tickets from their assigned region
 * - Admin can access all regions
 * - Customer can only access their own tickets
 */

import { MockUser } from '@/lib/mock-auth'
import { getGroupIdByRegion, getRegionByGroupId, type RegionValue } from '@/lib/constants/regions'

/**
 * Check if a user has permission to access a specific region
 * @param user - The user to check
 * @param region - The region to check access for
 * @returns true if user has access, false otherwise
 */
export function hasRegionAccess(user: MockUser, region: RegionValue): boolean {
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
export function hasGroupAccess(user: MockUser, groupId: number): boolean {
  // Admin can access all groups
  if (user.role === 'admin') {
    return true
  }

  // Get region from group ID
  const region = getRegionByGroupId(groupId)
  if (!region) {
    return false
  }

  return hasRegionAccess(user, region)
}

/**
 * Get the list of group IDs that a user can access
 * @param user - The user to get accessible groups for
 * @returns Array of group IDs the user can access
 */
export function getAccessibleGroupIds(user: MockUser): number[] {
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

  // Staff can only access their region's group
  if (user.role === 'staff' && user.region) {
    const groupId = getGroupIdByRegion(user.region as RegionValue)
    return [groupId]
  }

  return []
}

/**
 * Get the list of regions that a user can access
 * @param user - The user to get accessible regions for
 * @returns Array of region values the user can access
 */
export function getAccessibleRegions(user: MockUser): RegionValue[] {
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
 * @param tickets - Array of tickets to filter
 * @param user - The user to filter for
 * @returns Filtered array of tickets
 */
export function filterTicketsByRegion<T extends { group_id?: number }>(
  tickets: T[],
  user: MockUser
): T[] {
  // Admin can see all tickets
  if (user.role === 'admin') {
    return tickets
  }

  // Get accessible group IDs
  const accessibleGroupIds = getAccessibleGroupIds(user)

  // Filter tickets by group_id
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
export function validateTicketCreation(user: MockUser, region: RegionValue): void {
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
export function validateTicketAccess(user: MockUser, ticketGroupId: number): void {
  if (!hasGroupAccess(user, ticketGroupId)) {
    const region = getRegionByGroupId(ticketGroupId)
    throw new Error(`You do not have permission to access tickets in region: ${region || 'unknown'}`)
  }
}

