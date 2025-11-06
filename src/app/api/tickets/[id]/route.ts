/**
 * Single Ticket API
 * 
 * GET    /api/tickets/[id] - Get ticket by conversation ID
 * PUT    /api/tickets/[id] - Update ticket
 * DELETE /api/tickets/[id] - Delete ticket (not implemented)
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

// ============================================================================
// Validation Schemas
// ============================================================================

const updateTicketSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  group: z.string().min(1).optional(),
  state: z.string().optional(),
  priority: z.string().optional(),
  owner_id: z.number().int().optional(),
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
    const user = await requireAuth(request)
    const ticketId = parseInt(params.id)

    if (isNaN(ticketId)) {
      return errorResponse('Invalid ticket ID', 400)
    }

    // Admin users get ticket without X-On-Behalf-Of, others use X-On-Behalf-Of
    const ticket = user.role === 'admin'
      ? await zammadClient.getTicket(ticketId)
      : await zammadClient.getTicket(ticketId, user.email)

    if (!ticket) {
      return notFoundResponse('Ticket not found')
    }

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
    const user = await requireAuth(request)
    const ticketId = parseInt(params.id)

    if (isNaN(ticketId)) {
      return errorResponse('Invalid ticket ID', 400)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateTicketSchema.safeParse(body)

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error.errors)
    }

    const updateData = validationResult.data

    // Build update payload
    const payload: any = {}
    if (updateData.title) payload.title = updateData.title
    if (updateData.group) payload.group = updateData.group
    if (updateData.state) payload.state = updateData.state
    if (updateData.priority) payload.priority = updateData.priority
    if (updateData.owner_id) payload.owner_id = updateData.owner_id

    // Admin users update without X-On-Behalf-Of, others use X-On-Behalf-Of
    const ticket = user.role === 'admin'
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
  { params: _params }: { params: { id: string } }
) {
  try {
    const _user = await requireAuth(request)

    // Note: Deleting tickets is not recommended in production
    // This endpoint is not implemented
    return errorResponse('Deleting tickets is not supported', 405)
  } catch (error) {
    console.error('DELETE /api/tickets/[id] error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

