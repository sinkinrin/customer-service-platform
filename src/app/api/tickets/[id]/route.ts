/**
 * Single Ticket API
 *
 * GET    /api/tickets/[id] - Get ticket by conversation ID
 * PUT    /api/tickets/[id] - Update ticket
 * DELETE /api/tickets/[id] - Delete ticket (admin only)
 */

import { NextRequest } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { z } from 'zod'
import type { ZammadTicket as RawZammadTicket } from '@/lib/zammad/types'
import { broadcastEvent } from '@/lib/sse/ticket-broadcaster'

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
 * Map state string to state_id for Zammad API
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function mapStateStringToId(state: string): number {
  switch (state.toLowerCase()) {
    case 'new':
      return 1
    case 'open':
      return 2
    case 'pending reminder':
      return 3
    case 'pending close':
      return 4
    case 'closed':
      return 5
    default:
      return 2 // Default to open if unknown
  }
}

/**
 * Map priority string to priority_id for Zammad API
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function mapPriorityStringToId(priority: string): number {
  switch (priority.toLowerCase()) {
    case '1 low':
      return 1
    case '2 normal':
      return 2
    case '3 high':
      return 3
    default:
      return 2 // Default to normal if unknown
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
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const ticketId = parseInt(params.id)

    if (isNaN(ticketId)) {
      return errorResponse('INVALID_ID', 'Invalid ticket ID', undefined, 400)
    }

    // Admin users get ticket without X-On-Behalf-Of, others use X-On-Behalf-Of
    const rawTicket = user.role === 'admin'
      ? await zammadClient.getTicket(ticketId)
      : await zammadClient.getTicket(ticketId, user.email)

    if (!rawTicket) {
      return notFoundResponse('Ticket not found')
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
      console.error(`[DEBUG] Failed to fetch customer ${rawTicket.customer_id}:`, error)
      // Continue without customer info
    }

    // Transform ticket to include priority, state, and customer information
    const ticket = transformTicket(rawTicket, customerInfo)

    return successResponse({ ticket })
  } catch (error) {
    console.error('GET /api/tickets/[id] error:', error)

    if (error instanceof Error && error.message.includes('404')) {
      return notFoundResponse('Ticket not found')
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

// ============================================================================
// PUT /api/tickets/[id]
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const ticketId = parseInt(params.id)

    if (isNaN(ticketId)) {
      return errorResponse('INVALID_ID', 'Invalid ticket ID', undefined, 400)
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
    if (updateData.owner_id) payload.owner_id = updateData.owner_id

    console.log('[DEBUG] PUT /api/tickets/[id] - Update payload:', JSON.stringify(payload, null, 2))
    console.log('[DEBUG] PUT /api/tickets/[id] - Original updateData:', JSON.stringify(updateData, null, 2))

    // Admin users update without X-On-Behalf-Of, others use X-On-Behalf-Of
    const rawTicket = user.role === 'admin'
      ? await zammadClient.updateTicket(ticketId, payload)
      : await zammadClient.updateTicket(ticketId, payload, user.email)

    // Add article if provided
    if (updateData.article) {
      if (user.role === 'admin') {
        await zammadClient.createArticle({
          ticket_id: ticketId,
          subject: updateData.article.subject,
          body: updateData.article.body,
          type: 'note',
          internal: updateData.article.internal,
        })
      } else {
        await zammadClient.createArticle(
          {
            ticket_id: ticketId,
            subject: updateData.article.subject,
            body: updateData.article.body,
            type: 'note',
            internal: updateData.article.internal,
          },
          user.email
        )
      }
    }

    // Transform ticket to include priority and state strings
    const ticket = transformTicket(rawTicket)

    // R1: Broadcast ticket updated event via SSE
    try {
      broadcastEvent({
        type: 'ticket_updated',
        data: {
          id: ticket.id,
          number: ticket.number,
          title: ticket.title,
          state_id: rawTicket.state_id,
          priority_id: rawTicket.priority_id,
          group_id: rawTicket.group_id,
        },
      })
      console.log('[SSE] Broadcasted ticket_updated event for ticket:', ticket.id)
    } catch (error) {
      console.error('[SSE] Failed to broadcast ticket update:', error)
    }

    return successResponse({ ticket })
  } catch (error) {
    console.error('PUT /api/tickets/[id] error:', error)

    if (error instanceof Error && error.message.includes('404')) {
      return notFoundResponse('Ticket not found')
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

// ============================================================================
// DELETE /api/tickets/[id]
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const ticketId = parseInt(params.id)

    if (isNaN(ticketId)) {
      return errorResponse('INVALID_ID', 'Invalid ticket ID', undefined, 400)
    }

    // Only admin users can delete tickets
    if (user.role !== 'admin') {
      return errorResponse('UNAUTHORIZED', 'Only admins can delete tickets', undefined, 403)
    }

    // Delete ticket using admin client (no X-On-Behalf-Of)
    await zammadClient.deleteTicket(ticketId)

    // R1: Broadcast ticket deleted event via SSE
    try {
      broadcastEvent({
        type: 'ticket_deleted',
        data: {
          id: ticketId,
        },
      })
      console.log('[SSE] Broadcasted ticket_deleted event for ticket:', ticketId)
    } catch (error) {
      console.error('[SSE] Failed to broadcast ticket deletion:', error)
    }

    return successResponse({ message: 'Ticket deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/tickets/[id] error:', error)

    if (error instanceof Error && error.message.includes('404')) {
      return notFoundResponse('Ticket not found')
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

