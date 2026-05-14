/**
 * Conversations API
 *
 * @swagger
 * /api/conversations:
 *   get:
 *     description: Returns a list of conversations for the current user
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter conversations by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of conversations to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: A list of conversations
 *   post:
 *     description: Create a new AI conversation (Prisma database)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               initial_message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Conversation created successfully
 */

import { NextRequest } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { CreateConversationSchema } from '@/types/api.types'
import {
  createAIConversation,
  getCustomerConversations,
  createAIConversationWithInitialMessage,
} from '@/lib/ai-conversation-service'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const rawLimit = parseInt(searchParams.get('limit') || '20', 10)
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10)
    const limit = Number.isFinite(rawLimit) ? rawLimit : 20
    const offset = Number.isFinite(rawOffset) ? rawOffset : 0

    // Get customer's conversations only
    const conversations = await getCustomerConversations(user.id, {
      status,
      limit,
      offset,
    })

    // Transform to API format (message count included via _count)
    const transformedConversations = conversations.map((conv: (typeof conversations)[number]) => {
        return {
          id: conv.id,
          customer_id: conv.customerId,
          business_type_id: null as null,
          status: conv.status,
          mode: 'ai' as const,
          message_count: conv._count.messages,
          created_at: conv.createdAt.toISOString(),
          updated_at: conv.updatedAt.toISOString(),
          last_message_at: conv.lastMessageAt.toISOString(),
          customer: {
            id: conv.customerId,
            full_name: conv.customerEmail?.split('@')[0] || 'User',
            email: conv.customerEmail || '',
          },
        }
    })

    return successResponse(transformedConversations)
  } catch (error: any) {
    logger.error('Conversations', 'Failed to get conversations', { data: { error: error instanceof Error ? error.message : error } })
    const message = error?.message || 'Unknown error'
    if (message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch conversations', message)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Parse and validate request body
    const body = await request.json()
    const validation = CreateConversationSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    let conversation
    let initialMessage = null
    if (validation.data.initial_message) {
      const initialMetadata = {
        ...validation.data.initial_metadata,
        sender_name: user.full_name || user.email,
      }
      const initialSenderRole = user.role === 'staff' || user.role === 'admin' ? 'staff' : 'customer'
      const materialized = await createAIConversationWithInitialMessage(
        user.id,
        user.email,
        validation.data.initial_message,
        initialMetadata,
        initialSenderRole
      )
      conversation = materialized.conversation
      initialMessage = materialized.message
    } else {
      conversation = await createAIConversation(user.id, user.email)
    }

    // Transform to API format
    const response = {
      id: conversation.id,
      customer_id: conversation.customerId,
      business_type_id: null,
      status: conversation.status,
      mode: 'ai',
      message_count: initialMessage ? 1 : 0,
      created_at: conversation.createdAt.toISOString(),
      updated_at: conversation.updatedAt.toISOString(),
      last_message_at: conversation.lastMessageAt.toISOString(),
    }

    if (initialMessage) {
      return successResponse({
        ...response,
        conversation: response,
        message: {
          id: initialMessage.id,
          conversation_id: initialMessage.conversationId,
          sender_id: initialMessage.senderId,
          sender_role: initialMessage.senderRole,
          content: initialMessage.content,
          message_type: initialMessage.messageType,
          metadata: initialMessage.metadata,
          created_at: initialMessage.createdAt.toISOString(),
        },
      }, 201)
    }

    return successResponse(response, 201)
  } catch (error: any) {
    logger.error('Conversations', 'Failed to create conversation', { data: { error: error instanceof Error ? error.message : error } })
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to create conversation', error.message)
  }
}
