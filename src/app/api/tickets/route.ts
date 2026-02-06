/**
 * Tickets API
 *
 * @swagger
 * /api/tickets:
 *   get:
 *     description: Returns a list of tickets
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, closed, new, pending]
 *         description: Filter tickets by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *         description: Filter tickets by priority (1=low, 2=normal, 3=high)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of tickets to return
 *     responses:
 *       200:
 *         description: A list of tickets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     tickets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           title:
 *                             type: string
 *                           state:
 *                             type: string
 *                           priority:
 *                             type: string
 *   post:
 *     description: Create a new ticket
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - article
 *             properties:
 *               title:
 *                 type: string
 *               group:
 *                 type: string
 *               priority_id:
 *                 type: integer
 *                 enum: [1, 2, 3]
 *               article:
 *                 type: object
 *                 required:
 *                   - subject
 *                   - body
 *                 properties:
 *                   subject:
 *                     type: string
 *                   body:
 *                     type: string
 *                   type:
 *                     type: string
 *                     default: note
 *     responses:
 *       201:
 *         description: Ticket created successfully
 */

import { NextRequest } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/utils/auth'
import { getApiLogger } from '@/lib/utils/api-logger'
import {
  successResponse,
  validationErrorResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response'
import { validateTicketCreation } from '@/lib/utils/region-auth'
import { filterTicketsByPermission, type AuthUser as PermissionUser, type Ticket as PermissionTicket } from '@/lib/utils/permission'
import { getGroupIdByRegion, type RegionValue } from '@/lib/constants/regions'
import { mapStateIdToString } from '@/lib/constants/zammad-states'
import { z } from 'zod'
import type { ZammadTicket as RawZammadTicket } from '@/lib/zammad/types'
import { checkZammadHealth, getZammadUnavailableMessage, isZammadUnavailableError } from '@/lib/zammad/health-check'
import { notifyTicketCreated } from '@/lib/notification'
import { autoAssignSingleTicket, handleAssignmentNotification } from '@/lib/ticket/auto-assign'

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

function getStatusSearchQuery(status?: string | null): string | null {
  if (!status) return null
  if (status === 'open') return 'state_id:2'
  if (status === 'closed') return 'state_id:4'
  if (status === 'new') return 'state_id:1'
  if (status === 'pending') return '(state_id:3 OR state_id:7)'
  return null
}

function buildTicketsSearchQuery(options: {
  status?: string | null
  priority?: string | null
  customerEmail?: string | null
  staffConstraint?: string | null
}): string {
  const parts: string[] = ['state:*']

  const statusQuery = getStatusSearchQuery(options.status)
  if (statusQuery) {
    parts.push(statusQuery)
  }

  if (options.priority) {
    const priorityId = parseInt(options.priority, 10)
    if (!Number.isNaN(priorityId)) {
      parts.push(`priority_id:${priorityId}`)
    }
  }

  if (options.customerEmail) {
    parts.push(`customer.email:${options.customerEmail}`)
  }

  if (options.staffConstraint) {
    parts.push(options.staffConstraint)
  }

  return parts.join(' AND ')
}

function buildStaffVisibilityQuery(user: PermissionUser): string | null {
  const clauses: string[] = []
  const userZammadId = user.zammad_id

  if (typeof userZammadId === 'number') {
    clauses.push(`owner_id:${userZammadId}`)
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
  // - staff cannot see unassigned (owner_id 0/1)
  return `(${clauses.join(' OR ')}) AND NOT owner_id:0 AND NOT owner_id:1`
}

// Helper function to ensure user exists in Zammad
async function ensureZammadUser(
  email: string,
  fullName: string,
  role: string,
  region?: string,
  requestId?: string
) {
  const { createApiLogger } = await import('@/lib/utils/api-logger')
  const log = createApiLogger('TicketsAPI', requestId)

  try {
    // Try to search for user by email
    const searchResult = await zammadClient.searchUsers(`email:${email}`)
    if (searchResult && searchResult.length > 0) {
      log.debug('User already exists in Zammad', { userId: searchResult[0].id })
      return searchResult[0]
    }

    // User doesn't exist, create them
    log.debug('Creating new user in Zammad', { email })
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
      log.debug('Setting group_ids for staff user', { groupIds })
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

    log.debug('Created new Zammad user', { userId: newUser.id })
    return newUser
  } catch (error) {
    log.error('Failed to ensure Zammad user', { error: error instanceof Error ? error.message : error })
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
    // Legacy: base64 embedded attachments
    attachments: z.array(z.object({
      filename: z.string(),
      data: z.string(), // base64 encoded
      'mime-type': z.string(),
    })).optional(),
    // New: Reference pre-uploaded attachments by ID (recommended)
    attachment_ids: z.array(z.number()).optional(),
    // New: Reference cached form uploads from upload_caches API
    form_id: z.string().optional(),
  }),
})

// ============================================================================
// GET /api/tickets
// ============================================================================

export async function GET(request: NextRequest) {
  const log = getApiLogger('TicketsAPI', request)

  try {
    const user = await requireAuth()
    log.info('Fetching tickets', { userId: user.id, role: user.role })

    // Check Zammad health before proceeding
    const healthCheck = await checkZammadHealth()
    if (!healthCheck.isHealthy) {
      log.warning('Zammad service unavailable', { error: healthCheck.error })
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
    const page = parseInt(searchParams.get('page') || '1')
    const customerEmail = searchParams.get('customer_email') // Filter by customer email

    if (!Number.isFinite(limit) || limit < 1 || limit > 200) {
      return validationErrorResponse([{ path: ['limit'], message: 'Limit must be between 1 and 200' }])
    }

    if (!Number.isFinite(page) || page < 1) {
      return validationErrorResponse([{ path: ['page'], message: 'Page must be greater than or equal to 1' }])
    }

    // Build permission user object
    const permissionUser: PermissionUser = {
      id: user.id,
      email: user.email,
      role: user.role as 'admin' | 'staff' | 'customer',
      zammad_id: user.zammad_id,
      group_ids: user.group_ids,
      region: user.region,
    }

    const staffConstraint = user.role === 'staff' ? buildStaffVisibilityQuery(permissionUser) : null
    if (user.role === 'staff' && !staffConstraint) {
      log.warning('Staff user has no visibility scope, returning empty list', {
        userId: user.id,
        region: user.region,
      })
      return successResponse({ tickets: [], total: 0 })
    }

    const query = buildTicketsSearchQuery({
      status,
      priority,
      customerEmail,
      staffConstraint,
    })

    const onBehalfOf = user.role === 'customer' ? user.email : undefined

    const [searchResult, total] = await Promise.all([
      zammadClient.searchTickets(query, limit, onBehalfOf, page),
      zammadClient.searchTicketsTotalCount(query, onBehalfOf),
    ])

    log.debug('Fetched paged ticket candidates', {
      query,
      page,
      limit,
      ticketCount: searchResult.tickets?.length || 0,
      total,
      role: user.role,
    })

    // Keep region-auth / permission filter as final authority on ticket visibility.
    const filteredTickets = filterTicketsByPermission(
      (searchResult.tickets || []) as unknown as PermissionTicket[],
      permissionUser
    )

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

    // Collect unique customer IDs (to avoid duplicate fetches)
    const customerIds = [...new Set(filteredTickets.map((t: any) => t.customer_id))]
    // Collect unique owner IDs
    const ownerIds = [...new Set(filteredTickets.map((t: any) => t.owner_id).filter(Boolean))]

    // In-memory cache for this request to avoid duplicate fetches
    const customerMap = new Map<number, { name?: string; email?: string }>()
    const ownerMap = new Map<number, { name?: string }>()

    // Optimization: Fetch customers and owners in parallel using efficient batch method
    // Increased concurrency to 50 for faster loading
    const CONCURRENCY_LIMIT = 50

    try {
      const [customers, owners] = await Promise.all([
        zammadClient.getUsersByIds(customerIds, CONCURRENCY_LIMIT),
        zammadClient.getUsersByIds(ownerIds, CONCURRENCY_LIMIT)
      ])

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

      // Populate owner map
      for (const owner of owners) {
        const name = owner.firstname && owner.lastname
          ? `${owner.firstname} ${owner.lastname}`.trim()
          : owner.firstname || owner.lastname || owner.login || undefined
        ownerMap.set(owner.id, { name })
      }
    } catch (error) {
      log.error('Error in parallel user fetching', { error: error instanceof Error ? error.message : error })
      // Continue even if fetch fails, fields will just be missing
    }

    // Transform tickets to include priority, state, customer and owner information
    const transformedTickets = filteredTickets.map((ticket: any) =>
      transformTicket(
        ticket,
        customerMap.get(ticket.customer_id),
        ticket.owner_id ? ownerMap.get(ticket.owner_id) : undefined
      )
    )

    // Fetch ratings for all tickets from Prisma
    const ticketIds = transformedTickets.map((t: any) => t.id)
    const ratingMap = new Map<number, 'positive' | 'negative'>()
    try {
      const ratings = await prisma.ticketRating.findMany({
        where: { ticketId: { in: ticketIds } },
        select: { ticketId: true, rating: true },
      })
      for (const r of ratings) {
        ratingMap.set(r.ticketId, r.rating as 'positive' | 'negative')
      }
    } catch (error) {
      log.warning('Could not load ratings', { error: error instanceof Error ? error.message : error })
      // Continue without ratings
    }

    // Add rating to transformed tickets
    const ticketsWithRating = transformedTickets.map((ticket: any) => ({
      ...ticket,
      rating: ratingMap.get(ticket.id) || null,
    }))

    return successResponse({
      tickets: ticketsWithRating,
      total,
    })
  } catch (error) {
    log.error('Failed to fetch tickets', { error: error instanceof Error ? error.message : error })

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
  const log = getApiLogger('TicketsAPI', request)

  try {
    const user = await requireAuth()

    // Check Zammad health before proceeding
    const healthCheck = await checkZammadHealth()
    if (!healthCheck.isHealthy) {
      log.warning('Zammad service unavailable', { error: healthCheck.error })
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false },
        503
      )
    }

    // Parse and validate request body
    const body = await request.json()
    log.debug('Request body received', { title: body.title, region: body.region })
    log.debug('User context', { userId: user.id, role: user.role, region: user.region })

    const validationResult = createTicketSchema.safeParse(body)

    if (!validationResult.success) {
      log.warning('Validation failed', { errors: validationResult.error.errors })
      return validationErrorResponse(validationResult.error.errors)
    }

    const ticketData = validationResult.data

    // Determine region (use provided region or user's region, default to 'asia-pacific' for admin)
    log.debug('Region resolution', {
      ticketDataRegion: ticketData.region,
      userRegion: user.region,
      userRole: user.role
    })
    const region = (ticketData.region || user.region || 'asia-pacific') as RegionValue
    log.debug('Determined region', { region })

    // Validate user has permission to create ticket in this region
    try {
      validateTicketCreation(user, region)
    } catch (error) {
      log.warning('Permission validation failed', { error: error instanceof Error ? error.message : error })
      return validationErrorResponse([{
        path: ['region'],
        message: error instanceof Error ? error.message : 'Permission denied'
      }])
    }

    // Ensure user exists in Zammad before creating ticket
    // P2 Fix: Use target region for staff group assignment, not user.region
    // This ensures staff creating tickets in a specific region get proper permissions
    const zammadUser = await ensureZammadUser(user.email, user.full_name, user.role, region, log.requestId)
    log.debug('Zammad user verified', { zammadUserId: zammadUser.id })

    // Determine group ID based on user's region
    // All users (customer/staff/admin) create tickets in their region's group
    // This ensures staff can see tickets created by customers in their region
    const groupId = getGroupIdByRegion(region)
    log.debug('Using region group', { groupId, region })

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
          // Support both legacy base64 attachments and new attachment_ids/form_id
          ...(ticketData.article.attachments && { attachments: ticketData.article.attachments }),
          ...(ticketData.article.attachment_ids && { attachment_ids: ticketData.article.attachment_ids }),
          ...(ticketData.article.form_id && { form_id: ticketData.article.form_id }),
        },
      },
      user.email  // Pass user email for X-On-Behalf-Of to show correct sender name
    )

    log.info('Ticket created', { ticketId: ticket.id, ticketNumber: ticket.number })

    try {
      await notifyTicketCreated({
        recipientUserId: user.id,
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        ticketTitle: ticket.title,
      })
    } catch (notifyError) {
      log.error('Failed to create in-app notification for ticket creation', { error: notifyError instanceof Error ? notifyError.message : notifyError })
    }

    // Auto-assign to available Staff in the ticket's region
    const requestId = log.requestId
    const assignResult = requestId
      ? await autoAssignSingleTicket(ticket.id, ticket.number, ticket.title, groupId, requestId)
      : await autoAssignSingleTicket(ticket.id, ticket.number, ticket.title, groupId)

    if (assignResult.success) {
      log.info('Ticket auto-assigned', { ticketNumber: ticket.number, assignedTo: assignResult.assignedTo?.name })
    } else {
      log.warning('Ticket auto-assign failed', { ticketNumber: ticket.number, error: assignResult.error })
    }

    // Send notifications asynchronously (don't block response)
    const notifyPromise = requestId
      ? handleAssignmentNotification(assignResult, ticket.id, ticket.number, ticket.title, region, requestId)
      : handleAssignmentNotification(assignResult, ticket.id, ticket.number, ticket.title, region)

    notifyPromise.catch(err => log.error('Assignment notification error', { error: err instanceof Error ? err.message : err }))

    return successResponse(
      {
        ticket,
      },
      201
    )
  } catch (error) {
    log.error('Failed to create ticket', { error: error instanceof Error ? error.message : error })

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

