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
import { validateTicketCreation } from '@/lib/utils/region-auth'
import { filterTicketsByPermission, type AuthUser as PermissionUser, type Ticket as PermissionTicket } from '@/lib/utils/permission'
import { getGroupIdByRegion, type RegionValue } from '@/lib/constants/regions'
import { z } from 'zod'
import type { ZammadTicket as RawZammadTicket } from '@/lib/zammad/types'
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
 * Zammad state_id mapping (from actual Zammad API /api/v1/ticket_states):
 * 1 = new
 * 2 = open
 * 3 = pending reminder
 * 4 = closed
 * 5 = merged
 * 6 = pending close
 * Note: 'removed' state does not exist in this Zammad instance
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
      return 'pending close'
    default:
      return 'closed' // Default to closed for unknown states
  }
}

/**
 * Transform Zammad ticket to include priority, state, and customer information
 */
function transformTicket(
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
  priority_id: z.number().int().min(1).max(3).optional().default(2),
  region: z.string().optional(), // Optional region override (defaults to user's region)
  article: z.object({
    subject: z.string().min(1),
    body: z.string().min(1),
    type: z.enum(['note', 'email', 'phone', 'web']).default('note'),
    internal: z.boolean().default(false),
    attachments: z.array(z.object({
      filename: z.string(),
      data: z.string(), // base64 encoded
      'mime-type': z.string(),
    })).optional(),
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
    const priority = searchParams.get('priority') // 1, 2, 3 (low, normal, high)
    const sort = searchParams.get('sort') || 'created_at' // created_at, updated_at, priority
    const order = searchParams.get('order') || 'desc' // asc, desc
    const limit = parseInt(searchParams.get('limit') || '50')
    const customerEmail = searchParams.get('customer_email') // Filter by customer email

    // Get tickets based on user role
    // P1 Fix: Use getAllTickets to handle Zammad pagination (default 50 per page)
    let tickets
    if (user.role === 'admin') {
      // Admin: Get all tickets without X-On-Behalf-Of
      // Use getAllTickets to iterate through all pages
      tickets = await zammadClient.getAllTickets()
    } else if (user.role === 'customer') {
      // Customer: Use search with X-On-Behalf-Of to get only their tickets
      // When using X-On-Behalf-Of, Zammad automatically filters to the user's tickets
      console.log('[DEBUG] GET /api/tickets - Searching tickets for customer:', user.email)
      const searchResponse = await zammadClient.searchTickets('state:*', 1000, user.email)
      tickets = searchResponse.tickets  // Extract tickets array from response object
      console.log('[DEBUG] GET /api/tickets - Found', tickets?.length || 0, 'tickets for customer')
    } else {
      // Staff: Get ALL tickets without X-On-Behalf-Of, then filter by region
      // Using X-On-Behalf-Of would only return tickets where staff is assigned/has explicit access
      // Staff needs to see all customer-created tickets in their region
      // P1 Fix: Use getAllTickets to iterate through all pages
      console.log('[DEBUG] GET /api/tickets - Fetching all tickets for staff, will filter by region')
      tickets = await zammadClient.getAllTickets()
    }

    // Use unified permission filter for all roles
    // This ensures:
    // - Customer only sees their own tickets (by customer_id)
    // - Staff only sees assigned or regional tickets (unassigned hidden)
    // - Admin sees all tickets
    console.log('[DEBUG] GET /api/tickets - Before permission filter:', tickets.length, 'tickets')
    console.log('[DEBUG] GET /api/tickets - User role:', user.role, 'Region:', user.region, 'Zammad ID:', user.zammad_id)
    
    // Build permission user object
    const permissionUser: PermissionUser = {
      id: user.id,
      email: user.email,
      role: user.role as 'admin' | 'staff' | 'customer',
      zammad_id: user.zammad_id,
      group_ids: user.group_ids,
      region: user.region,
    }
    
    let filteredTickets = filterTicketsByPermission(tickets as unknown as PermissionTicket[], permissionUser)
    console.log('[DEBUG] GET /api/tickets - After permission filter:', filteredTickets.length, 'tickets')

    if (filteredTickets.length > 0) {
      console.log('[DEBUG] GET /api/tickets - Sample ticket group_ids:', filteredTickets.slice(0, 3).map((t: any) => t.group_id))
    }

    // Filter by status if provided
    if (status) {
      filteredTickets = filteredTickets.filter((ticket: any) => {
        if (status === 'open') return ticket.state_id === 2
        if (status === 'closed') return ticket.state_id === 4
        if (status === 'new') return ticket.state_id === 1
        if (status === 'pending') return ticket.state_id === 3 || ticket.state_id === 7
        return true
      })
    }

    // Filter by priority if provided
    if (priority) {
      const priorityId = parseInt(priority, 10)
      if (!isNaN(priorityId)) {
        filteredTickets = filteredTickets.filter((ticket: any) => ticket.priority_id === priorityId)
      }
    }

    // Sort tickets
    filteredTickets.sort((a: any, b: any) => {
      let comparison = 0
      if (sort === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (sort === 'updated_at') {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      } else if (sort === 'priority') {
        comparison = a.priority_id - b.priority_id
      }
      return order === 'desc' ? -comparison : comparison
    })

    // Apply limit
    const limitedTickets = filteredTickets.slice(0, limit)

    // Collect unique customer IDs (to avoid duplicate fetches)
    const customerIds = [...new Set(limitedTickets.map((t: any) => t.customer_id))]
    // Collect unique owner IDs
    const ownerIds = [...new Set(limitedTickets.map((t: any) => t.owner_id).filter(Boolean))]

    // In-memory cache for this request to avoid duplicate fetches
    const customerMap = new Map<number, { name?: string; email?: string }>()
    const ownerMap = new Map<number, { name?: string }>()

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

    // Fetch owner (staff) information
    const ownerChunks: number[][] = []
    for (let i = 0; i < ownerIds.length; i += CONCURRENCY_LIMIT) {
      ownerChunks.push(ownerIds.slice(i, i + CONCURRENCY_LIMIT))
    }

    try {
      for (const chunk of ownerChunks) {
        await Promise.all(
          chunk.map(async (ownerId) => {
            try {
              const owner = await zammadClient.getUser(ownerId)
              const name = owner.firstname && owner.lastname
                ? `${owner.firstname} ${owner.lastname}`.trim()
                : owner.firstname || owner.lastname || owner.login || undefined
              ownerMap.set(ownerId, { name })
            } catch (error) {
              console.error(`[DEBUG] Failed to fetch owner ${ownerId}:`, error)
            }
          })
        )
      }
    } catch (error) {
      console.error('[DEBUG] Error fetching owner information:', error)
    }

    // Transform tickets to include priority, state, customer and owner information
    let transformedTickets = limitedTickets.map((ticket: any) =>
      transformTicket(
        ticket,
        customerMap.get(ticket.customer_id),
        ticket.owner_id ? ownerMap.get(ticket.owner_id) : undefined
      )
    )

    // Filter by customer email if provided (post-transform filter)
    if (customerEmail) {
      transformedTickets = transformedTickets.filter((ticket: any) => 
        ticket.customer_email?.toLowerCase() === customerEmail.toLowerCase()
      )
    }

    return successResponse({
      tickets: transformedTickets,
      total: customerEmail ? transformedTickets.length : filteredTickets.length,
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
    // P2 Fix: Use target region for staff group assignment, not user.region
    // This ensures staff creating tickets in a specific region get proper permissions
    const zammadUser = await ensureZammadUser(user.email, user.full_name, user.role, region)
    console.log('[DEBUG] POST /api/tickets - Zammad user ID:', zammadUser.id)

    // Determine group ID based on user's region
    // All users (customer/staff/admin) create tickets in their region's group
    // This ensures staff can see tickets created by customers in their region
    const groupId = getGroupIdByRegion(region)
    console.log('[DEBUG] POST /api/tickets - Using region group:', groupId, 'for region:', region)

    // Create ticket with X-On-Behalf-Of to ensure correct sender identity
    // This shows the actual user's name instead of the API token user (e.g., "Howen Support")
    const isCustomer = user.role === 'customer'
    const ticket = await zammadClient.createTicket(
      {
        title: ticketData.title,
        group: ticketData.group,
        group_id: groupId, // Assign to appropriate group based on user role
        customer_id: zammadUser.id, // Use customer_id instead of customer email
        state_id: 1, // new - required for ticket creation (state_id: 2 'open' is not allowed for new tickets)
        priority_id: ticketData.priority_id,
        article: {
          subject: ticketData.article.subject,
          body: ticketData.article.body,
          type: ticketData.article.type,
          internal: ticketData.article.internal,
          // Set sender to Customer when customer creates ticket, otherwise Agent
          sender: isCustomer ? 'Customer' : 'Agent',
          // Set origin_by_id for customers to properly attribute the article
          ...(isCustomer && { origin_by_id: zammadUser.id }),
          // Pass attachments if provided (base64 encoded for Zammad)
          ...(ticketData.article.attachments && { attachments: ticketData.article.attachments }),
        },
      },
      user.email  // Pass user email for X-On-Behalf-Of to show correct sender name
    )

    console.log('[DEBUG] POST /api/tickets - Created ticket:', ticket.id)

    // OpenSpec: New tickets remain UNASSIGNED by default
    // Auto-assignment is now only triggered via /api/tickets/auto-assign endpoint
    // This ensures unassigned tickets are only visible to Admin (per permission rules)
    console.log('[DEBUG] POST /api/tickets - Ticket created without assignment (unassigned)')

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

