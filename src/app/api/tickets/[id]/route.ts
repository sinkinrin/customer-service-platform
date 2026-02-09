/**
 * Single Ticket API
 *
 * @swagger
 * /api/tickets/{id}:
 *   get:
 *     description: Get detailed information about a specific ticket
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Detailed ticket information including current status
 *       404:
 *         description: Ticket not found
 *   put:
 *     description: Update ticket properties (status, priority, etc.) or add a reply
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               group:
 *                 type: string
 *               state:
 *                 type: string
 *               priority:
 *                 type: string
 *               article:
 *                 type: object
 *                 properties:
 *                   subject:
 *                     type: string
 *                   body:
 *                     type: string
 *                   internal:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Ticket updated successfully
 *   delete:
 *     description: Delete a ticket (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket deleted successfully
 */

import { NextRequest } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'
import { requireAuth } from '@/lib/utils/auth'
import { getApiLogger } from '@/lib/utils/api-logger'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { checkTicketPermission, type AuthUser as PermissionUser, type Ticket as PermissionTicket } from '@/lib/utils/permission'
import { z } from 'zod'
import { checkZammadHealth, getZammadUnavailableMessage, isZammadUnavailableError } from '@/lib/zammad/health-check'
import { transformTicket } from '@/lib/utils/ticket-helpers'

// ============================================================================
// Validation Schemas
// ============================================================================

const updateTicketSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  group: z.string().min(1).optional(),
  state: z.string().optional(),
  priority: z.string().optional(),
  owner_id: z.number().int().optional(),
  pending_time: z.string().optional(), // ISO 8601 datetime string
  article: z.object({
    subject: z.string().min(1),
    body: z.string().min(1),
    internal: z.boolean().default(false),
  }).optional(),
})

// ============================================================================
// GET /api/tickets/[id]
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = getApiLogger('TicketDetailAPI', request)
  try {
    const { id } = await params
    const user = await requireAuth()
    const ticketId = parseInt(id)

    if (isNaN(ticketId)) {
      return errorResponse('INVALID_ID', 'Invalid ticket ID', undefined, 400)
    }

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

    // Admin and Staff users get ticket without X-On-Behalf-Of (staff access is validated by region)
    // Customer uses X-On-Behalf-Of to ensure they can only access their own tickets
    const rawTicket = user.role === 'customer'
      ? await zammadClient.getTicket(ticketId, user.email)
      : await zammadClient.getTicket(ticketId)

    if (!rawTicket) {
      return notFoundResponse('Ticket not found')
    }

    // Use unified permission check for all roles
    const permissionUser: PermissionUser = {
      id: user.id,
      email: user.email,
      role: user.role as 'admin' | 'staff' | 'customer',
      zammad_id: user.zammad_id,
      group_ids: user.group_ids,
      region: user.region,
    }

    const permissionTicket: PermissionTicket = {
      id: rawTicket.id,
      customer_id: rawTicket.customer_id,
      owner_id: rawTicket.owner_id,
      group_id: rawTicket.group_id,
      state_id: rawTicket.state_id,
    }

    const permissionResult = checkTicketPermission({
      user: permissionUser,
      ticket: permissionTicket,
      action: 'view',
    })

    if (!permissionResult.allowed) {
      log.warning('Access denied', { reason: permissionResult.reason })
      // Return 404 for customers to not leak ticket existence, 403 for staff
      if (user.role === 'customer') {
        return notFoundResponse('Ticket not found')
      }
      return errorResponse('FORBIDDEN', 'You do not have permission to access this ticket', undefined, 403)
    }

    // Fetch customer information
    let customerInfo: { name?: string; email?: string } | undefined
    try {
      const customer = await zammadClient.getUser(rawTicket.customer_id)
      const name = customer.firstname && customer.lastname
        ? `${customer.firstname} ${customer.lastname}`.trim()
        : customer.firstname || customer.lastname || undefined
      customerInfo = {
        name,
        email: customer.email,
      }
    } catch (error) {
      log.debug('Failed to fetch customer', { customerId: rawTicket.customer_id, error: error instanceof Error ? error.message : error })
      // Continue without customer info
    }

    // Fetch owner (staff) information
    let ownerInfo: { name?: string } | undefined
    if (rawTicket.owner_id) {
      try {
        const owner = await zammadClient.getUser(rawTicket.owner_id)
        const name = owner.firstname && owner.lastname
          ? `${owner.firstname} ${owner.lastname}`.trim()
          : owner.firstname || owner.lastname || owner.login || undefined
        ownerInfo = { name }
      } catch (error) {
        log.debug('Failed to fetch owner', { ownerId: rawTicket.owner_id, error: error instanceof Error ? error.message : error })
        // Continue without owner info
      }
    }

    // Transform ticket to include priority, state, customer and owner information
    const ticket = transformTicket(rawTicket, customerInfo, ownerInfo)

    // Return response with no-cache headers to prevent stale data
    const response = successResponse({ ticket })
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error) {
    log.error('GET /api/tickets/[id] error', { error: error instanceof Error ? error.message : error })

    // Check if error is authentication error
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    if (error instanceof Error && error.message.includes('404')) {
      return notFoundResponse('Ticket not found')
    }

    // Check if error is due to Zammad being unavailable
    if (isZammadUnavailableError(error)) {
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false },
        503
      )
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to fetch ticket')
  }
}

// ============================================================================
// PUT /api/tickets/[id]
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = getApiLogger('TicketDetailAPI', request)
  try {
    const { id } = await params
    const user = await requireAuth()
    const ticketId = parseInt(id)

    if (isNaN(ticketId)) {
      return errorResponse('INVALID_ID', 'Invalid ticket ID', undefined, 400)
    }

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
    const validationResult = updateTicketSchema.safeParse(body)

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error.errors)
    }

    const updateData = validationResult.data

    // Build update payload
    // Zammad API accepts string values for state and priority, not IDs
    const payload: any = {}
    if (updateData.title) payload.title = updateData.title
    if (updateData.group) payload.group = updateData.group
    if (updateData.state) {
      payload.state = updateData.state

      // If state is "pending reminder" or "pending close", add pending_time (required field)
      const stateLower = updateData.state.toLowerCase()
      if (stateLower === 'pending reminder' || stateLower === 'pending close') {
        // Use provided pending_time if available, otherwise default to 24 hours from now
        if (updateData.pending_time) {
          payload.pending_time = updateData.pending_time
        } else {
          const pendingTime = new Date()
          pendingTime.setHours(pendingTime.getHours() + 24)
          payload.pending_time = pendingTime.toISOString()
        }
      }
    }
    if (updateData.priority) payload.priority = updateData.priority

    // Security: Only admin can modify owner_id (ticket assignment)
    // Staff must use /api/tickets/[id]/assign endpoint which has proper admin-only restriction
    if (updateData.owner_id) {
      if (user.role !== 'admin') {
        return errorResponse('FORBIDDEN', 'Only admin can assign tickets. Use /api/tickets/[id]/assign endpoint.', undefined, 403)
      }
      payload.owner_id = updateData.owner_id
    }

    log.debug('Update payload', { payload })
    log.debug('Original updateData', { updateData })

    // OpenSpec: Validate region/ownership access before update
    // First, fetch the ticket to check permissions
    // Admin and Staff get ticket without X-On-Behalf-Of (staff access is validated by region)
    // Customer uses X-On-Behalf-Of to ensure they can only access their own tickets
    const existingTicket = user.role === 'customer'
      ? await zammadClient.getTicket(ticketId, user.email)
      : await zammadClient.getTicket(ticketId)

    if (!existingTicket) {
      return notFoundResponse('Ticket not found')
    }

    // Use unified permission check for update action
    const permissionUser: PermissionUser = {
      id: user.id,
      email: user.email,
      role: user.role as 'admin' | 'staff' | 'customer',
      zammad_id: user.zammad_id,
      group_ids: user.group_ids,
      region: user.region,
    }

    const permissionTicket: PermissionTicket = {
      id: existingTicket.id,
      customer_id: existingTicket.customer_id,
      owner_id: existingTicket.owner_id,
      group_id: existingTicket.group_id,
      state_id: existingTicket.state_id,
    }

    // Determine the appropriate permission action:
    // - If customer is only closing the ticket (state -> closed), use 'close' action
    // - Otherwise use 'edit' action
    const isCloseOnly = user.role === 'customer' &&
      updateData.state?.toLowerCase() === 'closed' &&
      !updateData.title && !updateData.group && !updateData.priority && !updateData.owner_id

    const permissionResult = checkTicketPermission({
      user: permissionUser,
      ticket: permissionTicket,
      action: isCloseOnly ? 'close' : 'edit',
    })

    if (!permissionResult.allowed) {
      log.warning('Update access denied', { reason: permissionResult.reason })
      if (user.role === 'customer') {
        return notFoundResponse('Ticket not found')
      }
      return errorResponse('FORBIDDEN', 'You do not have permission to update this ticket', undefined, 403)
    }

    // Admin and Staff update without X-On-Behalf-Of (staff access already validated by region)
    // Customer uses X-On-Behalf-Of to ensure they can only update their own tickets
    const rawTicket = user.role === 'customer'
      ? await zammadClient.updateTicket(ticketId, payload, user.email)
      : await zammadClient.updateTicket(ticketId, payload)

    // Add article if provided
    // Admin and Staff create articles without X-On-Behalf-Of
    // Customer uses X-On-Behalf-Of to ensure proper ownership
    if (updateData.article) {
      if (user.role === 'customer') {
        await zammadClient.createArticle(
          {
            ticket_id: ticketId,
            subject: updateData.article.subject,
            body: updateData.article.body,
            content_type: 'text/html',
            type: 'note',
            internal: updateData.article.internal,
          },
          user.email
        )
      } else {
        await zammadClient.createArticle({
          ticket_id: ticketId,
          subject: updateData.article.subject,
          body: updateData.article.body,
          content_type: 'text/html',
          type: 'note',
          internal: updateData.article.internal,
        })
      }
    }

    // Transform ticket to include priority and state strings
    const ticket = transformTicket(rawTicket)

    return successResponse({ ticket })
  } catch (error) {
    log.error('PUT /api/tickets/[id] error', { error: error instanceof Error ? error.message : error })

    // Check if error is authentication error
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    if (error instanceof Error && error.message.includes('404')) {
      return notFoundResponse('Ticket not found')
    }

    // Check if error is due to Zammad being unavailable
    if (isZammadUnavailableError(error)) {
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false },
        503
      )
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to update ticket')
  }
}

// ============================================================================
// DELETE /api/tickets/[id]
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = getApiLogger('TicketDetailAPI', request)
  try {
    const { id } = await params
    const user = await requireAuth()
    const ticketId = parseInt(id)

    if (isNaN(ticketId)) {
      return errorResponse('INVALID_ID', 'Invalid ticket ID', undefined, 400)
    }

    // Only admin users can delete tickets
    if (user.role !== 'admin') {
      return errorResponse('UNAUTHORIZED', 'Only admins can delete tickets', undefined, 403)
    }

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

    // Delete ticket using admin client (no X-On-Behalf-Of)
    await zammadClient.deleteTicket(ticketId)

    return successResponse({ message: 'Ticket deleted successfully' })
  } catch (error) {
    log.error('DELETE /api/tickets/[id] error', { error: error instanceof Error ? error.message : error })

    // Check if error is authentication error
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    if (error instanceof Error && error.message.includes('404')) {
      return notFoundResponse('Ticket not found')
    }

    // Check if error is due to Zammad being unavailable
    if (isZammadUnavailableError(error)) {
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false },
        503
      )
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to delete ticket')
  }
}

