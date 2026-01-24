/**
 * Unread Conversations Count API
 *
 * @swagger
 * /api/conversations/unread-count:
 *   get:
 *     description: Returns the count of unread conversations for the current user
 *     responses:
 *       200:
 *         description: Unread count
 */

import { logger } from '@/lib/utils/logger'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { getCustomerConversations, getConversationMessages } from '@/lib/local-conversation-storage'

export async function GET() {
  try {
    const user = await requireAuth()

    // Get customer's conversations
    const conversations = await getCustomerConversations(user.email)

    // Count conversations with unread messages
    // For now, we consider a conversation "unread" if it has messages
    // and the last message is not from the customer
    let unreadCount = 0
    for (const conv of conversations) {
      if (conv.status === 'closed') continue

      const messages = await getConversationMessages(conv.id)
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        // If the last message is from staff/AI, consider it unread
        if (lastMessage.sender_role !== 'customer') {
          unreadCount++
        }
      }
    }

    return successResponse({ unreadCount })
  } catch (error: any) {
    logger.error('Conversations', 'Failed to get unread count', { data: { error: error instanceof Error ? error.message : error } })
    if (error?.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch unread count', error?.message)
  }
}
