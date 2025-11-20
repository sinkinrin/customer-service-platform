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
  getConversationMessages,
} from '@/lib/local-conversation-storage'
import { broadcastConversationEvent } from '@/lib/sse/conversation-broadcaster'
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

    const { aiHistory: clientAiHistory, reason } = validation.data

    // R3: Step 1: Read persisted AI history from storage (not just from client payload)
    const persistedMessages = await getConversationMessages(conversationId)
    // OpenSpec: Sort messages by timestamp ascending (oldest first) for correct history order
    const aiModeMessages = persistedMessages
      .filter(msg => msg.metadata?.aiMode)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) // Ascending order
      .map(msg => ({
        role: msg.metadata?.role === 'ai' ? 'ai' as const : 'customer' as const,
        content: msg.content,
        timestamp: msg.created_at
      }))

    // Use persisted history if available, otherwise fall back to client payload
    const aiHistory = aiModeMessages.length > 0 ? aiModeMessages : (clientAiHistory || [])

    // Step 2: Save AI conversation history as system message (if we have any history)
    if (aiHistory.length > 0) {
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
      console.log('[R3] Saved AI history from storage:', aiHistory.length, 'messages')
    } else {
      console.log('[R3] No AI history found (neither persisted nor from client)')
    }

    // Step 3: Update conversation mode to 'human'
    const updated = await updateConversation(conversationId, {
      mode: 'human',
      transferred_at: new Date().toISOString(),
      transfer_reason: reason,
    })

    if (!updated) {
      return serverErrorResponse('Failed to update conversation')
    }

    // Step 4: Send system message to customer
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

    // Step 5: Broadcast SSE event to customer
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

    // Step 6: Broadcast SSE event to all staff
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
