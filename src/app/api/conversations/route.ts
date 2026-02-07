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
  addMessage,
} from '@/lib/ai-conversation-service'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get customer's conversations only
    const conversations = await getCustomerConversations(user.email)

    // Transform to API format (message count included via _count)
    const transformedConversations = conversations.map((conv) => {
        return {
          id: conv.id,
          customer_id: conv.customerId,
          business_type_id: null,
          status: conv.status,
          mode: 'ai',
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

    // Apply filters
    let filteredConversations = transformedConversations
    if (status) {
      filteredConversations = filteredConversations.filter((c) => c.status === status)
    }

    // Sort by last_message_at (desc)
    filteredConversations.sort((a, b) =>
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    )

    // Apply pagination
    const paginatedConversations = filteredConversations.slice(offset, offset + limit)

    return successResponse(paginatedConversations)
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

    // Create local AI conversation
    const conversation = await createAIConversation(user.id, user.email)

    // Save initial message if provided
    let initialMessage = null
    if (validation.data.initial_message) {
      initialMessage = await addMessage(
        conversation.id,
        'customer',
        user.id,
        validation.data.initial_message,
        { sender_name: user.full_name || user.email }
      )
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

    return successResponse(response, 201)
  } catch (error: any) {
    logger.error('Conversations', 'Failed to create conversation', { data: { error: error instanceof Error ? error.message : error } })
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to create conversation', error.message)
  }
}
