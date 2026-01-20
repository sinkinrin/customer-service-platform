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
import { mapStateIdToString } from '@/lib/constants/zammad-states'
import { checkZammadHealth, getZammadUnavailableMessage, isZammadUnavailableError } from '@/lib/zammad/health-check'
import { getVerifiedZammadUser, setVerifiedZammadUser } from '@/lib/cache/zammad-user-cache'

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

// mapStateIdToString is now imported from @/lib/constants/zammad-states

/**
 * Transform Zammad ticket to include priority, state, and customer information
 */
function transformTicket(ticket: RawZammadTicket, customerInfo?: { name?: string; email?: string }) {
  return {
    ...ticket,
    priority: mapPriorityIdToString(ticket.priority_id),
    state: mapStateIdToString(ticket.state_id),
    customer: customerInfo?.name || customerInfo?.email || `Customer #${ticket.customer_id}`,
    customer_email: customerInfo?.email,
  }
}
import { getGroupIdByRegion, type RegionValue } from '@/lib/constants/regions'
import { filterTicketsByPermission, type AuthUser as PermissionUser, type Ticket as PermissionTicket } from '@/lib/utils/permission'

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

    // Validate limit (increased to 200 to support dashboard/list statistics)
    if (limit < 1 || limit > 200) {
      return errorResponse('INVALID_LIMIT', 'Limit must be between 1 and 200', undefined, 400)
    }

    // Check Zammad health before proceeding
    const healthCheck = await checkZammadHealth()
    if (!healthCheck.isHealthy) {
      console.warn('[Tickets Search API] Zammad service unavailable:', healthCheck.error)
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false },
        503
      )
    }

    // Ensure user exists in Zammad before searching (for non-admin users)
    // Use cache to skip redundant verification calls
    if (user.role !== 'admin') {
      const cachedUserId = getVerifiedZammadUser(user.email, user.role, user.region)
      if (cachedUserId) {
        console.log('[DEBUG] Zammad user verified from cache:', cachedUserId)
      } else {
        try {
          const zammadUser = await ensureZammadUser(user.email, user.full_name, user.role, user.region)
          if (zammadUser?.id) {
            setVerifiedZammadUser(user.email, user.role, zammadUser.id, user.region)
            console.log('[DEBUG] Zammad user verified and cached:', zammadUser.id)
          }
        } catch (error) {
          console.warn('[Tickets API] Failed to ensure Zammad user:', error)
          // Continue anyway, search might still work
        }
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
    } else if (user.role === 'customer') {
      // Customer: Search tickets on behalf of user (only their own tickets)
      console.log('[DEBUG] Search API - Calling searchTickets for customer:', user.email)
      result = await zammadClient.searchTickets(query, limit, user.email)
      console.log('[DEBUG] Search API - Result:', JSON.stringify(result, null, 2))
    } else {
      // Staff: Search ALL tickets without X-On-Behalf-Of, then filter by permission
      // Using X-On-Behalf-Of would only return tickets where staff is assigned/has explicit access
      // Staff needs to see all customer-created tickets in their region
      console.log('[DEBUG] Search API - Fetching all tickets for staff, will filter by permission')
      result = await zammadClient.searchTickets(query, limit * 2) // Get more to account for permission filtering
      console.log('[DEBUG] Search API - Before permission filter:', result.tickets?.length || 0, 'tickets')

      // Apply unified permission filtering for staff (same as /api/tickets list)
      // This ensures consistent filtering between list and search APIs
      if (result.tickets) {
        const permissionUser: PermissionUser = {
          id: user.id,
          email: user.email,
          role: user.role as 'admin' | 'staff' | 'customer',
          zammad_id: user.zammad_id,
          group_ids: user.group_ids,
          region: user.region,
        }
        result.tickets = filterTicketsByPermission(result.tickets as unknown as PermissionTicket[], permissionUser) as unknown as typeof result.tickets
        result.tickets_count = result.tickets.length
      }
      console.log('[DEBUG] Search API - After permission filter:', result.tickets?.length || 0, 'tickets')
    }

    console.log('[DEBUG] Search API - Returning tickets count:', result.tickets?.length || 0)

    // Collect unique customer IDs (to avoid duplicate fetches)
    const tickets = result.tickets || []
    const customerIds = [...new Set(tickets.map((t: any) => t.customer_id))]

    // In-memory cache for this request to avoid duplicate fetches
    const customerMap = new Map<number, { name?: string; email?: string }>()

    // Optimization: Fetch customers in parallel using efficient batch method
    // Increased concurrency to 50 for faster loading
    const CONCURRENCY_LIMIT = 50

    try {
      const customers = await zammadClient.getUsersByIds(customerIds, CONCURRENCY_LIMIT)

      // Populate customer map
      for (const customer of customers) {
        const name = customer.firstname && customer.lastname
          ? `${customer.firstname} ${customer.lastname}`.trim()
          : customer.firstname || customer.lastname || undefined
        customerMap.set(customer.id, {
          name,
          email: customer.email,
        })
      }
    } catch (error) {
      console.error('[Search API] Error in parallel customer fetching:', error)
      // Continue even if fetch fails
    }

    // Transform tickets to include priority, state, and customer information
    const transformedTickets = tickets.map((ticket: any) =>
      transformTicket(ticket, customerMap.get(ticket.customer_id))
    )

    return successResponse({
      tickets: transformedTickets,
      total: result.tickets_count || 0,
      query,
      limit,
    })
  } catch (error) {
    console.error('GET /api/tickets/search error:', error)

    // Check if error is authentication error
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    // Check if error is due to Zammad being unavailable
    if (isZammadUnavailableError(error)) {
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false },
        503
      )
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to search tickets')
  }
}

