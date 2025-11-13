/**
 * Conversation Messages API
 *
 * GET /api/conversations/[id]/messages - Get messages for a conversation
 * POST /api/conversations/[id]/messages - Send a message in a conversation
 *
 * Implementation: Uses local file storage with SSE for real-time updates
 */

import { NextRequest } from 'next/server'
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get messages from local storage
    const allMessages = await getConversationMessages(conversationId)

    // Sort by created_at ascending
    const sorted = allMessages.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Apply pagination
    const paginated = sorted.slice(offset, offset + limit)

    // Transform to API format
    const messages = paginated.map((msg) => ({
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
        full_name: msg.sender_role === 'ai' ? 'AI Assistant' : user.full_name || user.email,
        avatar_url: null,
        role: msg.sender_role,
      },
    }))

    return successResponse({
      messages,
      pagination: {
        limit,
        offset,
        total: sorted.length,
      },
    })
  } catch (error: any) {
    console.error('GET /api/conversations/[id]/messages error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch messages', error.message)
  }
}

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

    // Verify access: customer can only post to their own conversations
    if (user.role === 'customer' && conversation.customer_email !== user.email) {
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
    const senderRole = user.role === 'customer' ? 'customer' : 'staff'

    // Add message to local storage
    const newMessage = await addMessage(
      conversationId,
      senderRole as 'customer' | 'ai' | 'staff',
      user.id,
      validation.data.content
    )

    console.log('[LocalStorage] Created message:', newMessage.id, 'in conversation:', conversationId)

    // Transform to API format
    const message = {
      id: newMessage.id,
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: senderRole,
      content: newMessage.content,
      message_type: validation.data.message_type || 'text',
      metadata: validation.data.metadata || {},
      created_at: newMessage.created_at,
      sender: {
        id: user.id,
        full_name: user.full_name || user.email,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    }

    // Broadcast new message event via SSE to all participants
    // Customer + staff (if assigned) + AI system
    const targetUserIds = [conversation.customer_id]

    try {
      broadcastConversationEvent(
        {
          type: 'new_message',
          conversationId,
          data: message,
        },
        targetUserIds
      )
      console.log('[SSE] Broadcasted new_message event for conversation:', conversationId)
    } catch (error) {
      console.error('[SSE] Failed to broadcast message:', error)
      // Don't fail the request if SSE broadcast fails
    }

    return successResponse(message, 201)
  } catch (error: any) {
    console.error('POST /api/conversations/[id]/messages error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to send message', error.message)
  }
}
