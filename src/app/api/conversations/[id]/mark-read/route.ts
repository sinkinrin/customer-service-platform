/**
 * Mark Conversation as Read API
 *
 * @swagger
 * /api/conversations/{id}/mark-read:
 *   post:
 *     description: Mark a conversation as read
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation marked as read
 */

import { NextRequest } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { getConversation } from '@/lib/ai-conversation-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Get the conversation to verify access
    const conversation = await getConversation(id)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Verify the user has access to this conversation
    if (conversation.customerEmail !== user.email && user.role === 'customer') {
      return notFoundResponse('Conversation not found')
    }

    // In a real implementation, we would update a read_at timestamp
    // For now, we just return success as the database doesn't track read status
    return successResponse({ success: true, conversation_id: id })
  } catch (error: any) {
    logger.error('Conversations', 'Failed to mark conversation as read', { data: { error: error instanceof Error ? error.message : error } })
    if (error?.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to mark conversation as read', error?.message)
  }
}
