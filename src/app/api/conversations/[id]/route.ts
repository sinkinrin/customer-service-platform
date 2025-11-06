/**
 * Single Conversation API
 *
 * GET /api/conversations/[id] - Get conversation details
 * PUT /api/conversations/[id] - Update conversation
 * DELETE /api/conversations/[id] - Delete conversation (admin only)
 *
 * Implementation: Uses Zammad tickets with 'conversation' tag
 */

import { NextRequest } from 'next/server'
import { requireAuth, requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { UpdateConversationSchema } from '@/types/api.types'
import { zammadClient } from '@/lib/zammad/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()

    // Parse ticket ID
    const ticketId = parseInt(params.id)
    if (isNaN(ticketId)) {
      return notFoundResponse('Invalid conversation ID')
    }

    // Get ticket from Zammad
    const ticket = await zammadClient.getTicket(ticketId, user.email)

    if (!ticket) {
      return notFoundResponse('Conversation not found')
    }

    // Verify it's a conversation (has 'conversation' tag)
    const tags = await zammadClient.getTags(ticketId, user.email)
    if (!tags.includes('conversation')) {
      return notFoundResponse('Conversation not found')
    }

    // Transform to conversation format
    const conversation = {
      id: ticket.id.toString(),
      customer_id: ticket.customer_id?.toString() || user.id,
      staff_id: ticket.owner_id?.toString() || null,
      business_type_id: null,
      status: ticket.state_id === 1 ? 'waiting' : ticket.state_id === 2 ? 'active' : 'closed',
      message_count: ticket.article_count || 0,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      last_message_at: ticket.updated_at,
    }

    return successResponse(conversation)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch conversation', error.message)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()

    // Parse ticket ID
    const ticketId = parseInt(params.id)
    if (isNaN(ticketId)) {
      return notFoundResponse('Invalid conversation ID')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateConversationSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    // Get ticket from Zammad
    const ticket = await zammadClient.getTicket(ticketId, user.email)

    if (!ticket) {
      return notFoundResponse('Conversation not found')
    }

    // Verify it's a conversation
    const tags = await zammadClient.getTags(ticketId, user.email)
    if (!tags.includes('conversation')) {
      return notFoundResponse('Conversation not found')
    }

    // Check permissions
    const isStaffOrAdmin = user.role === 'staff' || user.role === 'admin'

    if (!isStaffOrAdmin) {
      return forbiddenResponse('You do not have permission to update this conversation')
    }

    // Map status to Zammad state_id
    let state_id = ticket.state_id
    if (validation.data.status) {
      if (validation.data.status === 'waiting') state_id = 1
      if (validation.data.status === 'active') state_id = 2
      if (validation.data.status === 'closed') state_id = 4
    }

    // Update ticket
    const updated = await zammadClient.updateTicket(ticketId, { state_id }, user.email)

    // Transform to conversation format
    const conversation = {
      id: updated.id.toString(),
      customer_id: updated.customer_id?.toString() || user.id,
      staff_id: updated.owner_id?.toString() || null,
      business_type_id: null,
      status: updated.state_id === 1 ? 'waiting' : updated.state_id === 2 ? 'active' : 'closed',
      message_count: updated.article_count || 0,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      last_message_at: updated.updated_at,
    }

    return successResponse(conversation)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to update conversation', error.message)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(['admin'])

    // Parse ticket ID
    const ticketId = parseInt(params.id)
    if (isNaN(ticketId)) {
      return notFoundResponse('Invalid conversation ID')
    }

    // Delete ticket from Zammad
    await zammadClient.deleteTicket(ticketId, user.email)

    return successResponse({ message: 'Conversation deleted successfully' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error.message === 'Forbidden') {
      return forbiddenResponse('Only admins can delete conversations')
    }
    return serverErrorResponse('Failed to delete conversation', error.message)
  }
}

