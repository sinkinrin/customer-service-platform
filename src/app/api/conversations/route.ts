/**
 * Conversations API
 *
 * GET /api/conversations - List conversations for current user
 * POST /api/conversations - Create a new AI conversation (local storage)
 *
 * Implementation: Uses local storage for AI conversations, Zammad tickets for human escalation
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
import { createAIConversation, getCustomerConversations } from '@/lib/local-conversation-storage'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get local AI conversations for the customer
    let conversations = await getCustomerConversations(user.email)

    // Transform to API format
    const transformedConversations = conversations.map((conv) => ({
      id: conv.id,
      customer_id: conv.customer_id,
      staff_id: null,
      business_type_id: null,
      status: conv.status,
      mode: conv.mode,
      zammad_ticket_id: conv.zammad_ticket_id,
      message_count: 0, // Will be calculated from messages
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      last_message_at: conv.last_message_at,
    }))

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
    const total = filteredConversations.length
    const paginatedConversations = filteredConversations.slice(offset, offset + limit)

    return successResponse({
      conversations: paginatedConversations,
      pagination: {
        limit,
        offset,
        total,
      },
    })
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

    // Create local AI conversation (does NOT create Zammad ticket)
    const conversation = await createAIConversation(user.id, user.email)

    console.log('[LocalStorage] Created AI conversation:', conversation.id)

    // Transform to API format
    const response = {
      id: conversation.id,
      customer_id: conversation.customer_id,
      staff_id: null,
      business_type_id: null,
      status: conversation.status,
      mode: conversation.mode,
      message_count: 0,
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

