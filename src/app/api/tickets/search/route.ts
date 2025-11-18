/**
 * Ticket Search API
 * 
 * GET /api/tickets/search - Search tickets
 */

import { NextRequest } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import type { ZammadTicket as RawZammadTicket } from '@/lib/zammad/types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map priority_id to priority string for frontend compatibility
 */
function mapPriorityIdToString(priorityId: number): string {
  switch (priorityId) {
    case 1:
      return '1 low'
    case 2:
      return '2 normal'
    case 3:
      return '3 high'
    default:
      return '2 normal' // Default to normal if unknown
  }
}

/**
 * Map state_id to state string for frontend compatibility
 * Zammad state_id mapping (from Zammad API documentation):
 * 1 = new
 * 2 = open
 * 3 = pending reminder
 * 4 = closed
 * 5 = merged
 * 6 = removed
 * 7 = pending close
 */
function mapStateIdToString(stateId: number): string {
  switch (stateId) {
    case 1:
      return 'new'
    case 2:
      return 'open'
    case 3:
      return 'pending reminder'
    case 4:
      return 'closed'
    case 5:
      return 'merged'
    case 6:
      return 'removed'
    case 7:
      return 'pending close'
    default:
      return 'closed' // Default to closed for unknown states
  }
}

/**
 * Transform Zammad ticket to include priority and state strings
 */
function transformTicket(ticket: RawZammadTicket) {
  return {
    ...ticket,
    priority: mapPriorityIdToString(ticket.priority_id),
    state: mapStateIdToString(ticket.state_id),
  }
}
import { getGroupIdByRegion, type RegionValue } from '@/lib/constants/regions'

// Helper function to ensure user exists in Zammad
async function ensureZammadUser(email: string, fullName: string, role: string, region?: string) {
  try {
    // Try to search for user by email
    const searchResult = await zammadClient.searchUsers(`email:${email}`)
    if (searchResult && searchResult.length > 0) {
      console.log('[DEBUG] User already exists in Zammad:', searchResult[0].id)
      return searchResult[0]
    }

    // User doesn't exist, create them
    console.log('[DEBUG] Creating new user in Zammad:', email)
    const [firstname, ...lastnameArr] = fullName.split(' ')
    const lastname = lastnameArr.join(' ') || firstname

    // Determine Zammad roles
    let zammadRoles: string[]
    if (role === 'admin') {
      zammadRoles = ['Admin', 'Agent']
    } else if (role === 'staff') {
      zammadRoles = ['Agent']
    } else {
      zammadRoles = ['Customer']
    }

    // Prepare group_ids for staff (assign to region group)
    let groupIds: Record<string, string[]> | undefined
    if (role === 'staff' && region) {
      const groupId = getGroupIdByRegion(region as RegionValue)
      groupIds = {
        [groupId.toString()]: ['full']  // Full permission for staff in their region
      }
      console.log('[DEBUG] Setting group_ids for staff user:', groupIds)
    }

    const newUser = await zammadClient.createUser({
      login: email,
      email,
      firstname,
      lastname,
      roles: zammadRoles,
      group_ids: groupIds,
      active: true,
      verified: true,
    })

    console.log('[DEBUG] Created new Zammad user:', newUser.id)
    return newUser
  } catch (error) {
    console.error('[ERROR] Failed to ensure Zammad user:', error)
    throw error
  }
}

// ============================================================================
// GET /api/tickets/search
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!query) {
      return errorResponse('INVALID_QUERY', 'Query parameter is required', undefined, 400)
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      return errorResponse('INVALID_LIMIT', 'Limit must be between 1 and 100', undefined, 400)
    }

    // Check if Zammad is enabled
    const zammadEnabled = process.env.ZAMMAD_ENABLED !== 'false'

    if (!zammadEnabled) {
      console.log('[Tickets API] Zammad disabled, returning empty results')
      return successResponse([])
    }

    // Ensure user exists in Zammad before searching (for non-admin users)
    if (user.role !== 'admin') {
      try {
        await ensureZammadUser(user.email, user.full_name, user.role, user.region)
      } catch (error) {
        console.warn('[Tickets API] Failed to ensure Zammad user:', error)
        // Continue anyway, search might still work
      }
    }

    // Admin users search all tickets, other users search only their tickets
    console.log('[DEBUG] Search API - Raw query:', query)
    console.log('[DEBUG] Search API - User role:', user.role)
    console.log('[DEBUG] Search API - Limit:', limit)

    let result
    if (user.role === 'admin') {
      // Admin: Search all tickets without X-On-Behalf-Of
      console.log('[DEBUG] Search API - Calling searchTickets for admin')
      result = await zammadClient.searchTickets(query, limit)
      console.log('[DEBUG] Search API - Result:', JSON.stringify(result, null, 2))
    } else {
      // Customer/Staff: Search tickets on behalf of user
      console.log('[DEBUG] Search API - Calling searchTickets for user:', user.email)
      result = await zammadClient.searchTickets(query, limit, user.email)
      console.log('[DEBUG] Search API - Result:', JSON.stringify(result, null, 2))
    }

    console.log('[DEBUG] Search API - Returning tickets count:', result.tickets?.length || 0)

    // Transform tickets to include priority and state strings
    const transformedTickets = (result.tickets || []).map((ticket: any) => transformTicket(ticket))

    return successResponse({
      tickets: transformedTickets,
      total: result.tickets_count || 0,
      query,
      limit,
    })
  } catch (error) {
    console.error('GET /api/tickets/search error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

