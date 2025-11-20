/**
 * Tickets API
 * 
 * GET  /api/tickets - Get all tickets
 * POST /api/tickets - Create a new ticket
 */

import { NextRequest } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  validationErrorResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response'
import { filterTicketsByRegion, validateTicketCreation } from '@/lib/utils/region-auth'
import { getGroupIdByRegion, type RegionValue } from '@/lib/constants/regions'
import { z } from 'zod'
import type { ZammadTicket as RawZammadTicket } from '@/lib/zammad/types'
import { broadcastEvent } from '@/lib/sse/ticket-broadcaster'
import { checkZammadHealth, getZammadUnavailableMessage, isZammadUnavailableError } from '@/lib/zammad/health-check'

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
// Validation Schemas
// ============================================================================

const createTicketSchema = z.object({
  title: z.string().min(1).max(255),
  group: z.string().min(1).optional().default('Support'),
  priority_id: z.number().int().min(1).max(4).optional().default(2),
  region: z.string().optional(), // Optional region override (defaults to user's region)
  article: z.object({
    subject: z.string().min(1),
    body: z.string().min(1),
    type: z.enum(['note', 'email', 'phone', 'web']).default('note'),
    internal: z.boolean().default(false),
  }),
})

// ============================================================================
// GET /api/tickets
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Check Zammad health before proceeding
    const healthCheck = await checkZammadHealth()
    if (!healthCheck.isHealthy) {
      console.warn('[Tickets API] Zammad service unavailable:', healthCheck.error)
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false },
        503
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // open, closed, etc.
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get tickets based on user role
    let tickets
    if (user.role === 'admin') {
      // Admin: Get all tickets without X-On-Behalf-Of
      tickets = await zammadClient.getTickets()
    } else if (user.role === 'customer') {
      // Customer: Use search with X-On-Behalf-Of to get only their tickets
      // When using X-On-Behalf-Of, Zammad automatically filters to the user's tickets
      console.log('[DEBUG] GET /api/tickets - Searching tickets for customer:', user.email)
      const searchResponse = await zammadClient.searchTickets('state:*', 1000, user.email)
      tickets = searchResponse.tickets  // Extract tickets array from response object
      console.log('[DEBUG] GET /api/tickets - Found', tickets?.length || 0, 'tickets for customer')
    } else {
      // Staff: Get tickets on behalf of user (filtered by region later)
      tickets = await zammadClient.getTickets(user.email)
    }

    // Filter by region (staff can only see their region, admin sees all)
    console.log('[DEBUG] GET /api/tickets - Before region filter:', tickets.length, 'tickets')
    console.log('[DEBUG] GET /api/tickets - User role:', user.role, 'Region:', user.region)
    let filteredTickets = filterTicketsByRegion(tickets, user)
    console.log('[DEBUG] GET /api/tickets - After region filter:', filteredTickets.length, 'tickets')

    if (filteredTickets.length > 0) {
      console.log('[DEBUG] GET /api/tickets - Sample ticket group_ids:', filteredTickets.slice(0, 3).map((t: any) => t.group_id))
    }

    // Filter by status if provided
    if (status) {
      filteredTickets = filteredTickets.filter((ticket: any) => {
        if (status === 'open') return ticket.state_id === 2
        if (status === 'closed') return ticket.state_id === 4
        return true
      })
    }

    // Apply limit
    const limitedTickets = filteredTickets.slice(0, limit)

    // Collect unique customer IDs (to avoid duplicate fetches)
    const customerIds = [...new Set(limitedTickets.map((t: any) => t.customer_id))]

    // In-memory cache for this request to avoid duplicate fetches
    const customerMap = new Map<number, { name?: string; email?: string }>()

    // Fetch customer information with concurrency limit to avoid overwhelming Zammad
    const CONCURRENCY_LIMIT = 5  // Process 5 customers at a time
    const chunks: number[][] = []
    for (let i = 0; i < customerIds.length; i += CONCURRENCY_LIMIT) {
      chunks.push(customerIds.slice(i, i + CONCURRENCY_LIMIT))
    }

    try {
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (customerId) => {
            try {
              const customer = await zammadClient.getUser(customerId)
              const name = customer.firstname && customer.lastname
                ? `${customer.firstname} ${customer.lastname}`.trim()
                : customer.firstname || customer.lastname || undefined
              customerMap.set(customerId, {
                name,
                email: customer.email,
              })
            } catch (error) {
              console.error(`[DEBUG] Failed to fetch customer ${customerId}:`, error)
              // Keep entry empty if fetch fails
            }
          })
        )
      }
    } catch (error) {
      console.error('[DEBUG] Error fetching customer information:', error)
      // Continue even if batch fetch fails
    }

    // Transform tickets to include priority, state, and customer information
    const transformedTickets = limitedTickets.map((ticket: any) =>
      transformTicket(ticket, customerMap.get(ticket.customer_id))
    )

    return successResponse({
      tickets: transformedTickets,
      total: filteredTickets.length,
    })
  } catch (error) {
    console.error('GET /api/tickets error:', error)

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

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to fetch tickets')
  }
}

// ============================================================================
// POST /api/tickets
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Check Zammad health before proceeding
    const healthCheck = await checkZammadHealth()
    if (!healthCheck.isHealthy) {
      console.warn('[Tickets API] Zammad service unavailable:', healthCheck.error)
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false },
        503
      )
    }

    // Parse and validate request body
    const body = await request.json()
    console.log('[DEBUG] POST /api/tickets - Request body:', JSON.stringify(body, null, 2))
    console.log('[DEBUG] POST /api/tickets - User:', JSON.stringify(user, null, 2))

    const validationResult = createTicketSchema.safeParse(body)

    if (!validationResult.success) {
      console.error('[ERROR] POST /api/tickets - Validation failed:', validationResult.error.errors)
      return validationErrorResponse(validationResult.error.errors)
    }

    const ticketData = validationResult.data

    // Determine region (use provided region or user's region, default to 'asia-pacific' for admin)
    const region = (ticketData.region || user.region || 'asia-pacific') as RegionValue
    console.log('[DEBUG] POST /api/tickets - Determined region:', region)

    // Validate user has permission to create ticket in this region
    try {
      validateTicketCreation(user, region)
    } catch (error) {
      console.error('[ERROR] POST /api/tickets - Permission validation failed:', error)
      return validationErrorResponse([{
        path: ['region'],
        message: error instanceof Error ? error.message : 'Permission denied'
      }])
    }

    // Ensure user exists in Zammad before creating ticket
    const zammadUser = await ensureZammadUser(user.email, user.full_name, user.role, user.region)
    console.log('[DEBUG] POST /api/tickets - Zammad user ID:', zammadUser.id)

    // Determine group ID based on user role
    // For customers: use default "Users" group (ID 1) which all customers can access
    // For staff/admin: use region-specific group
    let groupId: number
    if (user.role === 'customer') {
      groupId = 1 // Users group - accessible to all customers
      console.log('[DEBUG] POST /api/tickets - Using default Users group for customer')
    } else {
      groupId = getGroupIdByRegion(region)
      console.log('[DEBUG] POST /api/tickets - Using region group for staff/admin:', groupId)
    }

    // Create ticket (using admin token, customer field will set the owner)
    const ticket = await zammadClient.createTicket({
      title: ticketData.title,
      group: ticketData.group,
      group_id: groupId, // Assign to appropriate group based on user role
      customer_id: zammadUser.id, // Use customer_id instead of customer email
      state_id: 2, // open
      priority_id: ticketData.priority_id,
      article: {
        subject: ticketData.article.subject,
        body: ticketData.article.body,
        type: ticketData.article.type,
        internal: ticketData.article.internal,
      },
    })

    console.log('[DEBUG] POST /api/tickets - Created ticket:', ticket.id)

    // R1: Broadcast ticket created event via SSE
    try {
      broadcastEvent({
        type: 'ticket_created',
        data: {
          id: ticket.id,
          number: ticket.number,
          title: ticket.title,
          state_id: ticket.state_id,
          priority_id: ticket.priority_id,
          group_id: ticket.group_id,
        },
      })
      console.log('[SSE] Broadcasted ticket_created event for ticket:', ticket.id)
    } catch (error) {
      console.error('[SSE] Failed to broadcast ticket creation:', error)
    }

    return successResponse(
      {
        ticket,
      },
      201
    )
  } catch (error) {
    console.error('POST /api/tickets error:', error)

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

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to create ticket')
  }
}

