/**
 * Claim Conversation API
 *
 * POST /api/conversations/[id]/claim - Staff claims a waiting conversation
 *
 * This endpoint allows staff to claim a conversation that is in 'waiting' status.
 * When claimed, the conversation is assigned to the staff member and status changes to 'active'.
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response'
import {
  getConversation,
  updateConversation,
  addMessageWithMetadata,
  getConversationMessages,
} from '@/lib/local-conversation-storage'
import { broadcastConversationEvent } from '@/lib/sse/conversation-broadcaster'

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Only staff and admin can claim conversations
    if (user.role !== 'staff' && user.role !== 'admin') {
      return forbiddenResponse('Only staff can claim conversations')
    }

    // Get conversation from local storage
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Check if conversation is in waiting status
    if (conversation.status !== 'waiting') {
      return errorResponse(
        'INVALID_STATUS',
        'Only conversations in waiting status can be claimed',
        undefined,
        400
      )
    }

    // Check if conversation is already assigned to another staff
    if (conversation.staff_id && conversation.staff_id !== user.id) {
      return errorResponse(
        'ALREADY_CLAIMED',
        'This conversation has already been claimed by another staff member',
        undefined,
        409
      )
    }

    // Claim the conversation: assign staff_id and change status to active
    const updated = await updateConversation(conversationId, {
      staff_id: user.id,
      status: 'active',
    })

    if (!updated) {
      return serverErrorResponse('Failed to claim conversation')
    }

    // Add system message about staff assignment
    const staffName = user.full_name || user.email
    await addMessageWithMetadata(
      conversationId,
      'system',
      'system',
      `客服 ${staffName} 已接入对话，将为您提供服务。`, // Staff {staffName} has joined the conversation
      'system',
      {
        type: 'staff_claimed',
        staffId: user.id,
        staffName,
        claimedAt: new Date().toISOString(),
      }
    )

    // Get message count for response
    const messages = await getConversationMessages(conversationId)
    const messageCount = messages.length

    // Broadcast SSE event to customer
    try {
      broadcastConversationEvent(
        {
          type: 'conversation_claimed',
          conversationId,
          data: {
            conversation: updated,
            staff: {
              id: user.id,
              full_name: user.full_name,
              email: user.email,
            },
            message: `Staff ${staffName} has claimed this conversation`,
          },
        },
        [conversation.customer_id]
      )
      console.log('[SSE] Broadcasted conversation_claimed to customer:', conversation.customer_id)
    } catch (error) {
      console.error('[SSE] Failed to broadcast to customer:', error)
    }

    // Broadcast SSE event to all staff (to update their lists)
    try {
      broadcastConversationEvent(
        {
          type: 'conversation_updated',
          conversationId,
          data: {
            conversation: updated,
            action: 'claimed',
            staffId: user.id,
          },
        },
        ['staff']
      )
      console.log('[SSE] Broadcasted conversation_updated to staff')
    } catch (error) {
      console.error('[SSE] Failed to broadcast to staff:', error)
    }

    // Transform to API format
    const response = {
      id: updated.id,
      customer_id: updated.customer_id,
      customer_email: updated.customer_email,
      staff_id: updated.staff_id,
      status: updated.status,
      mode: updated.mode,
      region: updated.region,
      message_count: messageCount,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      staff: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
      },
    }

    console.log('[Claim] Conversation claimed:', conversationId, 'by staff:', user.id)

    return successResponse(response)
  } catch (error: any) {
    console.error('POST /api/conversations/[id]/claim error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to claim conversation', error.message)
  }
}
