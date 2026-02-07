/**
 * Single Conversation API
 *
 * GET /api/conversations/[id] - Get conversation details
 * PUT /api/conversations/[id] - Update conversation
 * DELETE /api/conversations/[id] - Delete conversation
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
import { UpdateConversationSchema } from '@/types/api.types'
import {
  getConversation,
  updateConversation,
  deleteConversation,
  getConversationMessageCount,
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

    // Get message count efficiently
    const messageCount = await getConversationMessageCount(conversationId)

    // Transform to API format
    const response = {
      id: conversation.id,
      customer_id: conversation.customerId,
      customer_email: conversation.customerEmail,
      business_type_id: null,
      status: conversation.status,
      mode: 'ai',
      message_count: messageCount,
      created_at: conversation.createdAt.toISOString(),
      updated_at: conversation.updatedAt.toISOString(),
      last_message_at: conversation.lastMessageAt.toISOString(),
      customer: {
        id: conversation.customerId,
        full_name: conversation.customerEmail?.split('@')[0] || 'Customer',
        email: conversation.customerEmail,
      },
    }

    return successResponse(response)
  } catch (error: any) {
    logger.error('Conversations', 'Failed to get conversation', { data: { error: error instanceof Error ? error.message : error } })
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch conversation', error.message)
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Get conversation from database
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Verify access: customer can only update their own conversations
    if (conversation.customerEmail !== user.email) {
      return notFoundResponse('Conversation not found')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateConversationSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    // Update conversation (only status allowed for customers)
    const { status } = validation.data
    const updated = await updateConversation(conversationId, { status })

    if (!updated) {
      return notFoundResponse('Conversation not found')
    }

    // Get message count efficiently
    const msgCount = await getConversationMessageCount(conversationId)

    // Transform to API format
    const result = {
      id: updated.id,
      customer_id: updated.customerId,
      customer_email: updated.customerEmail,
      business_type_id: null,
      status: updated.status,
      mode: 'ai',
      message_count: msgCount,
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
      last_message_at: updated.lastMessageAt.toISOString(),
      customer: {
        id: updated.customerId,
        full_name: updated.customerEmail?.split('@')[0] || 'Customer',
        email: updated.customerEmail,
      },
    }

    return successResponse(result)
  } catch (error: any) {
    logger.error('Conversations', 'Failed to update conversation', { data: { error: error instanceof Error ? error.message : error } })
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to update conversation', error.message)
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Get conversation
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Verify access: customer can only delete their own conversations
    if (conversation.customerEmail !== user.email) {
      return notFoundResponse('Conversation not found')
    }

    // Delete conversation and its messages
    await deleteConversation(conversationId)

    return successResponse({ message: 'Conversation deleted successfully' })
  } catch (error: any) {
    logger.error('Conversations', 'Failed to delete conversation', { data: { error: error instanceof Error ? error.message : error } })
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to delete conversation', error.message)
  }
}
