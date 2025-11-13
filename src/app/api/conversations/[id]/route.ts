/**
 * Single Conversation API
 *
 * GET /api/conversations/[id] - Get conversation details
 * PUT /api/conversations/[id] - Update conversation
 * DELETE /api/conversations/[id] - Delete conversation (admin only)
 *
 * Implementation: Uses local file storage
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
import {
  getConversation,
  updateConversation,
  deleteConversation,
  getConversationMessages,
} from '@/lib/local-conversation-storage'
import { broadcastConversationEvent } from '@/app/api/sse/conversations/route'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Get conversation from local storage
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Verify access: customer can only access their own conversations
    if (user.role === 'customer' && conversation.customer_email !== user.email) {
      return notFoundResponse('Conversation not found')
    }

    // Get message count
    const messages = await getConversationMessages(conversationId)
    const messageCount = messages.length

    // Transform to API format with customer and staff information
    const response = {
      id: conversation.id,
      customer_id: conversation.customer_id,
      customer_email: conversation.customer_email,
      staff_id: conversation.staff_id || null,
      business_type_id: null,
      status: conversation.status,
      mode: conversation.mode,
      zammad_ticket_id: conversation.zammad_ticket_id,
      transferred_at: conversation.transferred_at,
      transfer_reason: conversation.transfer_reason,
      message_count: messageCount,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      last_message_at: conversation.last_message_at,
      customer: {
        id: conversation.customer_id,
        full_name: conversation.customer_email?.split('@')[0] || 'Customer',
        email: conversation.customer_email,
      },
      staff: conversation.staff_id ? {
        id: conversation.staff_id,
        full_name: conversation.staff_name || 'Staff',
      } : null,
    }

    return successResponse(response)
  } catch (error: any) {
    console.error('GET /api/conversations/[id] error:', error)
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
    const conversationId = params.id

    // Get conversation from local storage
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateConversationSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    // Check permissions
    const isStaffOrAdmin = user.role === 'staff' || user.role === 'admin'
    const isOwner = conversation.customer_email === user.email

    if (!isStaffOrAdmin && !isOwner) {
      return forbiddenResponse('You do not have permission to update this conversation')
    }

    // Update conversation
    const updated = await updateConversation(conversationId, validation.data)

    if (!updated) {
      return notFoundResponse('Conversation not found')
    }

    // Get message count
    const messages = await getConversationMessages(conversationId)
    const messageCount = messages.length

    // Transform to API format with customer and staff information
    const response = {
      id: updated.id,
      customer_id: updated.customer_id,
      customer_email: updated.customer_email,
      staff_id: updated.staff_id || null,
      business_type_id: null,
      status: updated.status,
      mode: updated.mode,
      zammad_ticket_id: updated.zammad_ticket_id,
      transferred_at: updated.transferred_at,
      transfer_reason: updated.transfer_reason,
      message_count: messageCount,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      last_message_at: updated.last_message_at,
      customer: {
        id: updated.customer_id,
        full_name: updated.customer_email?.split('@')[0] || 'Customer',
        email: updated.customer_email,
      },
      staff: updated.staff_id ? {
        id: updated.staff_id,
        full_name: updated.staff_name || 'Staff',
      } : null,
    }

    // Broadcast conversation updated event via SSE
    try {
      broadcastConversationEvent(
        {
          type: 'conversation_updated',
          conversationId,
          data: response,
        },
        [updated.customer_id]
      )
      console.log('[SSE] Broadcasted conversation_updated event:', conversationId)
    } catch (error) {
      console.error('[SSE] Failed to broadcast conversation update:', error)
    }

    return successResponse(response)
  } catch (error: any) {
    console.error('PUT /api/conversations/[id] error:', error)
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
    const conversationId = params.id

    // Delete conversation and its messages
    const deleted = await deleteConversation(conversationId)

    if (!deleted) {
      return notFoundResponse('Conversation not found')
    }

    console.log('[LocalStorage] Deleted conversation:', conversationId)

    return successResponse({ message: 'Conversation deleted successfully' })
  } catch (error: any) {
    console.error('DELETE /api/conversations/[id] error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error.message === 'Forbidden') {
      return forbiddenResponse('Only admins can delete conversations')
    }
    return serverErrorResponse('Failed to delete conversation', error.message)
  }
}
