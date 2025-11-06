/**
 * Conversation Messages API
 *
 * GET /api/conversations/[id]/messages - Get messages for a conversation
 * POST /api/conversations/[id]/messages - Send a message in a conversation
 *
 * Implementation: Uses Zammad ticket articles as messages
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
import { zammadClient } from '@/lib/zammad/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()

    // Parse ticket ID
    const ticketId = parseInt(params.id)
    if (isNaN(ticketId)) {
      return notFoundResponse('Invalid conversation ID')
    }

    // Get ticket from Zammad
    const ticket = await zammadClient.getTicket(ticketId, user.email)

    if (!ticket) {
      return notFoundResponse('Conversation not found')
    }

    // Verify it's a conversation
    const tags = await zammadClient.getTags(ticketId, user.email)
    if (!tags.includes('conversation')) {
      return notFoundResponse('Conversation not found')
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get articles (messages) from Zammad
    const articles = await zammadClient.getArticlesByTicket(ticketId, user.email)

    // Sort by created_at ascending
    const sorted = articles.sort((a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Apply pagination
    const paginated = sorted.slice(offset, offset + limit)

    // Transform to message format
    const messages = paginated.map((article: any) => ({
      id: article.id.toString(),
      conversation_id: params.id,
      sender_id: article.created_by_id?.toString() || user.id,
      content: article.body,
      message_type: 'text',
      metadata: {},
      created_at: article.created_at,
      updated_at: article.updated_at,
      sender: {
        id: article.created_by_id?.toString() || user.id,
        full_name: article.from || user.full_name || user.email,
        avatar_url: null,
        role: user.role,
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

    // Parse ticket ID
    const ticketId = parseInt(params.id)
    if (isNaN(ticketId)) {
      return notFoundResponse('Invalid conversation ID')
    }

    // Get ticket from Zammad
    const ticket = await zammadClient.getTicket(ticketId, user.email)

    if (!ticket) {
      return notFoundResponse('Conversation not found')
    }

    // Verify it's a conversation
    const tags = await zammadClient.getTags(ticketId, user.email)
    if (!tags.includes('conversation')) {
      return notFoundResponse('Conversation not found')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = CreateMessageSchema.safeParse({
      ...body,
      conversation_id: params.id,
    })

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    // Create article (message) in Zammad
    const article = await zammadClient.createArticle({
      ticket_id: ticketId,
      subject: 'Message',
      body: validation.data.content,
      type: 'note',
      internal: false,
    }, user.email)

    // Update ticket status to active if it was waiting
    if (ticket.state_id === 1) {
      await zammadClient.updateTicket(ticketId, { state_id: 2 }, user.email)
    }

    // Transform to message format
    const message = {
      id: article.id.toString(),
      conversation_id: params.id,
      sender_id: article.created_by_id?.toString() || user.id,
      content: article.body,
      message_type: validation.data.message_type,
      metadata: validation.data.metadata || {},
      created_at: article.created_at,
      updated_at: article.updated_at,
      sender: {
        id: user.id,
        full_name: user.full_name || user.email,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    }

    return successResponse(message, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to send message', error.message)
  }
}

