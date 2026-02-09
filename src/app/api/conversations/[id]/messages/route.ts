/**
 * Conversation Messages API
 *
 * GET /api/conversations/[id]/messages - Get messages for a conversation
 * POST /api/conversations/[id]/messages - Send a message in a conversation
 *
 * Implementation: Uses Prisma-based storage for AI conversations
 */

import { NextRequest } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { CreateMessageSchema } from '@/types/api.types'
import {
  getConversation,
  getConversationMessages,
  getConversationMessageCount,
  addMessage,
} from '@/lib/ai-conversation-service'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Get conversation from database
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Verify access: customer can only access their own conversations
    if (conversation.customerEmail !== user.email) {
      return notFoundResponse('Conversation not found')
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get messages with database-level pagination (newest first)
    const [messages, total] = await Promise.all([
      getConversationMessages(conversationId, { limit, offset, order: 'desc' }),
      getConversationMessageCount(conversationId),
    ])

    // Transform to API format
    const transformedMessages = messages.map((msg: (typeof messages)[number]) => {
      // Determine sender name based on role
      let senderName = 'Unknown'
      if (msg.senderRole === 'ai') {
        senderName = 'AI Assistant'
      } else if (msg.metadata?.sender_name) {
        senderName = msg.metadata.sender_name as string
      } else if (msg.senderId === user.id) {
        senderName = user.full_name || user.email
      } else if (msg.senderRole === 'customer') {
        senderName = conversation.customerEmail
      }

      return {
        id: msg.id,
        conversation_id: conversationId,
        sender_id: msg.senderId,
        sender_role: msg.senderRole,
        content: msg.content,
        message_type: msg.messageType || 'text',
        metadata: msg.metadata || {},
        created_at: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
        rating: msg.rating ? {
          id: msg.rating.id,
          rating: msg.rating.rating,
          feedback: msg.rating.feedback,
        } : null,
        sender: {
          id: msg.senderId,
          full_name: senderName,
          avatar_url: null,
          role: msg.senderRole,
        },
      }
    })

    return successResponse({
      messages: transformedMessages,
      pagination: {
        limit,
        offset,
        total,
      },
    })
  } catch (error: any) {
    logger.error('Conversations', 'Failed to get messages', { data: { error: error instanceof Error ? error.message : error } })
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch messages', error.message)
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Get conversation from database
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Verify access: customer can only post to their own conversations
    if (conversation.customerEmail !== user.email) {
      return notFoundResponse('Conversation not found')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = CreateMessageSchema.safeParse({
      ...body,
      conversation_id: conversationId,
    })

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    // Determine sender role
    // Allow customers to save AI messages (metadata.role='ai')
    let senderRole: 'customer' | 'ai'
    if (validation.data.metadata?.role === 'ai') {
      senderRole = 'ai'
    } else {
      senderRole = 'customer'
    }

    // Prepare metadata with sender name
    const messageMetadata = {
      ...validation.data.metadata,
      sender_name: senderRole === 'ai' ? 'AI Assistant' : (user.full_name || user.email),
    }

    // Add message to database
    const newMessage = await addMessage(
      conversationId,
      senderRole,
      user.id,
      validation.data.content,
      messageMetadata,
      validation.data.message_type
    )

    // Transform to API format
    const message = {
      id: newMessage.id,
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: senderRole,
      content: newMessage.content,
      message_type: validation.data.message_type || 'text',
      metadata: messageMetadata,
      created_at: newMessage.createdAt instanceof Date ? newMessage.createdAt.toISOString() : newMessage.createdAt,
      sender: {
        id: user.id,
        full_name: user.full_name || user.email,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    }

    return successResponse(message, 201)
  } catch (error: any) {
    logger.error('Conversations', 'Failed to send message', { data: { error: error instanceof Error ? error.message : error } })
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to send message', error.message)
  }
}
