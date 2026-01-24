/**
 * Conversation Messages API
 *
 * GET /api/conversations/[id]/messages - Get messages for a conversation
 * POST /api/conversations/[id]/messages - Send a message in a conversation
 *
 * Implementation: Uses local file storage for AI conversations only
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
  addMessage,
} from '@/lib/local-conversation-storage'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Get conversation from local storage
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Verify access: customer can only access their own conversations
    if (conversation.customer_email !== user.email) {
      return notFoundResponse('Conversation not found')
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get messages from local storage
    const allMessages = await getConversationMessages(conversationId)

    // Sort by created_at descending (newest first)
    const sorted = allMessages.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    // Apply pagination
    const paginated = sorted.slice(offset, offset + limit)

    // Transform to API format
    const messages = paginated.map((msg) => {
      // Determine sender name based on role
      let senderName = 'Unknown'
      if (msg.sender_role === 'ai') {
        senderName = 'AI Assistant'
      } else if (msg.metadata?.sender_name) {
        senderName = msg.metadata.sender_name
      } else if (msg.sender_id === user.id) {
        senderName = user.full_name || user.email
      } else if (msg.sender_role === 'customer') {
        senderName = conversation.customer_name || conversation.customer_email
      }

      return {
        id: msg.id,
        conversation_id: conversationId,
        sender_id: msg.sender_id,
        sender_role: msg.sender_role,
        content: msg.content,
        message_type: msg.message_type || 'text',
        metadata: msg.metadata || {},
        created_at: msg.created_at,
        sender: {
          id: msg.sender_id,
          full_name: senderName,
          avatar_url: null,
          role: msg.sender_role,
        },
      }
    })

    return successResponse({
      messages,
      pagination: {
        limit,
        offset,
        total: sorted.length,
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

    // Get conversation from local storage
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Verify access: customer can only post to their own conversations
    if (conversation.customer_email !== user.email) {
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

    // Add message to local storage
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
      created_at: newMessage.created_at,
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
