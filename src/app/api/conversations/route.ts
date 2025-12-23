/**
 * Conversations API
 *
 * GET /api/conversations - List conversations for current user
 * POST /api/conversations - Create a new AI conversation (local storage)
 *
 * Implementation: Uses local storage for AI conversations only
 */

import { NextRequest } from 'next/server'
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
  getConversationMessages,
  addMessage,
} from '@/lib/local-conversation-storage'

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

    // Transform to API format
    const transformedConversations = await Promise.all(
      conversations.map(async (conv) => {
        // Get actual message count
        const messages = await getConversationMessages(conv.id)

        return {
          id: conv.id,
          customer_id: conv.customer_id,
          business_type_id: null,
          status: conv.status,
          mode: conv.mode,
          message_count: messages.length,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          last_message_at: conv.last_message_at,
          customer: {
            id: conv.customer_id,
            full_name: conv.customer_name || conv.customer_email?.split('@')[0] || 'User',
            email: conv.customer_email || '',
          },
        }
      })
    )

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
    console.error('GET /api/conversations error:', error)
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

    console.log('[LocalStorage] Created AI conversation:', conversation.id)

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
      console.log('[LocalStorage] Saved initial message for conversation:', conversation.id)
    }

    // Transform to API format
    const response = {
      id: conversation.id,
      customer_id: conversation.customer_id,
      business_type_id: null,
      status: conversation.status,
      mode: conversation.mode,
      message_count: initialMessage ? 1 : 0,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      last_message_at: conversation.last_message_at,
    }

    return successResponse(response, 201)
  } catch (error: any) {
    console.error('POST /api/conversations error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to create conversation', error.message)
  }
}
