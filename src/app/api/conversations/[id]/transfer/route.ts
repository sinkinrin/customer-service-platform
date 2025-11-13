/**
 * Transfer Conversation to Human Agent API
 *
 * POST /api/conversations/[id]/transfer - Transfer AI conversation to human agent
 *
 * Implementation: Updates conversation mode from 'ai' to 'human',
 * saves AI history as system message, and broadcasts SSE event
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import {
  getConversation,
  updateConversation,
  addMessageWithMetadata,
} from '@/lib/local-conversation-storage'
import { broadcastConversationEvent } from '@/app/api/sse/conversations/route'
import { z } from 'zod'

// Request validation schema
const TransferConversationSchema = z.object({
  aiHistory: z.array(
    z.object({
      role: z.enum(['customer', 'ai']),
      content: z.string(),
      timestamp: z.string(),
    })
  ).optional(),
  reason: z.string().max(500).optional(),
})

type TransferConversationRequest = z.infer<typeof TransferConversationSchema>

export async function POST(
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

    // Verify access: must be the customer who owns the conversation
    if (user.role !== 'customer' || conversation.customer_email !== user.email) {
      return forbiddenResponse('You do not have permission to transfer this conversation')
    }

    // Verify conversation state
    if (conversation.mode !== 'ai') {
      return validationErrorResponse([
        {
          path: ['mode'],
          message: 'Conversation is already in human mode',
        },
      ])
    }

    if (conversation.status !== 'active') {
      return validationErrorResponse([
        {
          path: ['status'],
          message: 'Only active conversations can be transferred',
        },
      ])
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = TransferConversationSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { aiHistory, reason } = validation.data

    // Step 1: Save AI conversation history as system message (if provided)
    if (aiHistory && aiHistory.length > 0) {
      await addMessageWithMetadata(
        conversationId,
        'system',
        'system',
        `AI Conversation History (${aiHistory.length} messages)`,
        'transfer_history',
        {
          aiHistory,
          transferredBy: user.id,
          transferredAt: new Date().toISOString(),
        }
      )
      console.log('[Transfer] Saved AI history:', aiHistory.length, 'messages')
    }

    // Step 2: Update conversation mode to 'human'
    const updated = await updateConversation(conversationId, {
      mode: 'human',
      transferred_at: new Date().toISOString(),
      transfer_reason: reason,
    })

    if (!updated) {
      return serverErrorResponse('Failed to update conversation')
    }

    // Step 3: Send system message to customer
    const systemMessageContent = reason
      ? `您已成功转接至人工客服。\n原因：${reason}\n\n客服人员会尽快回复您，请稍候...`
      : '您已成功转接至人工客服，客服人员会尽快回复您，请稍候...'

    await addMessageWithMetadata(
      conversationId,
      'system',
      'system',
      systemMessageContent,
      'system',
      {
        type: 'transfer_success',
        transferredBy: user.id,
        transferredAt: updated.transferred_at,
        reason,
      }
    )

    console.log('[Transfer] Conversation transferred to human:', conversationId)

    // Step 4: Broadcast SSE event to customer
    try {
      broadcastConversationEvent(
        {
          type: 'conversation_transferred',
          conversationId,
          data: {
            conversation: updated,
            message: 'Conversation has been transferred to a human agent',
          },
        },
        [user.id]
      )
      console.log('[SSE] Broadcasted conversation_transferred to customer:', user.id)
    } catch (error) {
      console.error('[SSE] Failed to broadcast to customer:', error)
    }

    // Step 5: Broadcast SSE event to all staff
    try {
      broadcastConversationEvent(
        {
          type: 'new_conversation_transferred',
          conversationId,
          data: {
            conversation: updated,
            customer: {
              id: user.id,
              email: user.email,
              name: user.full_name || user.email,
            },
            transferReason: reason,
            transferredAt: updated.transferred_at,
            message: `New conversation from ${user.email}${reason ? ` - ${reason}` : ''}`,
          },
        },
        // Broadcast to all staff users (we'll filter by role in SSE endpoint)
        ['staff']
      )
      console.log('[SSE] Broadcasted new_conversation_transferred to staff')
    } catch (error) {
      console.error('[SSE] Failed to broadcast to staff:', error)
    }

    // Return success response
    return successResponse(
      {
        conversation: updated,
        message: 'Conversation transferred to human agent successfully',
      },
      200
    )
  } catch (error: any) {
    console.error('POST /api/conversations/[id]/transfer error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to transfer conversation', error.message)
  }
}
