/**
 * Conversations API
 *
 * GET /api/conversations - List conversations for current user
 * POST /api/conversations - Create a new conversation
 *
 * Implementation: Uses Zammad tickets with 'conversation' tag
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
import { zammadClient } from '@/lib/zammad/client'

export async function GET(request: NextRequest) {
  // Get query parameters early so we can use them in error/fallback paths
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')
  try {
    const user = await requireAuth()

    // Get all tickets for the user from Zammad
    const allTickets = await zammadClient.getTickets(user.email)

    // Filter tickets with 'conversation' tag
    const conversationTickets = await Promise.all(
      allTickets.map(async (ticket: any) => {
        const tags = await zammadClient.getTags(ticket.id, user.email)
        return { ticket, tags }
      })
    ).then(results =>
      results
        .filter(({ tags }) => tags.includes('conversation'))
        .map(({ ticket }) => ticket)
    )

    // Filter by status if provided
    let filtered = conversationTickets
    if (status) {
      filtered = conversationTickets.filter((ticket: any) => {
        if (status === 'waiting') return ticket.state_id === 1 // new
        if (status === 'active') return ticket.state_id === 2 // open
        if (status === 'closed') return ticket.state_id === 4 // closed
        return true
      })
    }

    // Sort by updated_at (desc)
    const sorted = filtered.sort((a: any, b: any) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )

    // Apply pagination
    const paginated = sorted.slice(offset, offset + limit)

    // Transform to conversation format
    const conversations = paginated.map((ticket: any) => ({
      id: ticket.id.toString(),
      customer_id: ticket.customer_id?.toString() || user.id,
      staff_id: ticket.owner_id?.toString() || null,
      business_type_id: null,
      status: ticket.state_id === 1 ? 'waiting' : ticket.state_id === 2 ? 'active' : 'closed',
      message_count: ticket.article_count || 0,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      last_message_at: ticket.updated_at,
    }))

    return successResponse({
      conversations,
      pagination: {
        limit,
        offset,
        total: sorted.length,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
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

    const { initial_message } = validation.data

    // Create a Zammad ticket as conversation
    const ticket = await zammadClient.createTicket({
      title: 'Conversation',
      group: 'Support',
      customer: user.email,
      state_id: 1, // new (waiting)
      priority_id: 2, // normal
      article: {
        subject: 'Conversation started',
        body: initial_message || 'Conversation started',
        type: 'note',
        internal: false,
      },
    }, user.email)

    // Add 'conversation' tag to identify this ticket as a conversation
    await zammadClient.addTag(ticket.id, 'conversation', user.email)

    // Transform to conversation format
    const conversation = {
      id: ticket.id.toString(),
      customer_id: ticket.customer_id?.toString() || user.id,
      staff_id: ticket.owner_id?.toString() || null,
      business_type_id: null,
      status: 'waiting',
      message_count: 1,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      last_message_at: ticket.updated_at,
    }

    return successResponse(conversation, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to create conversation', error.message)
  }
}

