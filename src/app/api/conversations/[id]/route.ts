/**
 * Single Conversation API
 *
 * GET /api/conversations/[id] - Get conversation details
 * PUT /api/conversations/[id] - Update conversation
 * DELETE /api/conversations/[id] - Delete conversation
 *
 * Implementation: Uses local file storage for AI conversations only
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
import { UpdateConversationSchema } from '@/types/api.types'
import {
  getConversation,
  updateConversation,
  deleteConversation,
  getConversationMessages,
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

    // Get message count
    const messages = await getConversationMessages(conversationId)
    const messageCount = messages.length

    // Transform to API format
    const response = {
      id: conversation.id,
      customer_id: conversation.customer_id,
      customer_email: conversation.customer_email,
      business_type_id: null,
      status: conversation.status,
      mode: conversation.mode,
      message_count: messageCount,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      last_message_at: conversation.last_message_at,
      customer: {
        id: conversation.customer_id,
        full_name: conversation.customer_email?.split('@')[0] || 'Customer',
        email: conversation.customer_email,
      },
    }

    return successResponse(response)
  } catch (error: any) {
    console.error('GET /api/conversations/[id] error:', error)
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

    // Get conversation from local storage
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Verify access: customer can only update their own conversations
    if (conversation.customer_email !== user.email) {
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

    // Get message count
    const messages = await getConversationMessages(conversationId)
    const messageCount = messages.length

    // Transform to API format
    const response = {
      id: updated.id,
      customer_id: updated.customer_id,
      customer_email: updated.customer_email,
      business_type_id: null,
      status: updated.status,
      mode: updated.mode,
      message_count: messageCount,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      last_message_at: updated.last_message_at,
      customer: {
        id: updated.customer_id,
        full_name: updated.customer_email?.split('@')[0] || 'Customer',
        email: updated.customer_email,
      },
    }

    return successResponse(response)
  } catch (error: any) {
    console.error('PUT /api/conversations/[id] error:', error)
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
    if (conversation.customer_email !== user.email) {
      return notFoundResponse('Conversation not found')
    }

    // Delete conversation and its messages
    await deleteConversation(conversationId)

    console.log('[LocalStorage] Deleted conversation:', conversationId)

    return successResponse({ message: 'Conversation deleted successfully' })
  } catch (error: any) {
    console.error('DELETE /api/conversations/[id] error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to delete conversation', error.message)
  }
}
