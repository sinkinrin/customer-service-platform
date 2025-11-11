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

// Helper function to ensure user exists in Zammad
async function ensureZammadUser(email: string, fullName: string, role: string) {
  try {
    // Try to search for user by email
    const searchResult = await zammadClient.searchUsers(`email:${email}`)
    if (searchResult && searchResult.length > 0) {
      console.log('[DEBUG] Conversation - User already exists in Zammad:', searchResult[0].id)
      return searchResult[0]
    }

    // User doesn't exist, create them
    console.log('[DEBUG] Conversation - Creating new user in Zammad:', email)
    const [firstname, ...lastnameArr] = fullName.split(' ')
    const lastname = lastnameArr.join(' ') || firstname

    // Determine Zammad roles
    let zammadRoles: string[]
    if (role === 'admin') {
      zammadRoles = ['Admin', 'Agent']
    } else if (role === 'staff') {
      zammadRoles = ['Agent']
    } else {
      zammadRoles = ['Customer']
    }

    const newUser = await zammadClient.createUser({
      login: email,
      email,
      firstname,
      lastname,
      roles: zammadRoles,
      active: true,
      verified: true,
    })

    console.log('[DEBUG] Conversation - Created new Zammad user:', newUser.id)
    return newUser
  } catch (error) {
    console.error('[ERROR] Conversation - Failed to ensure Zammad user:', error)
    throw error
  }
}

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

    // Ensure user exists in Zammad before creating conversation
    const zammadUser = await ensureZammadUser(user.email, user.full_name, user.role)
    console.log('[DEBUG] POST /api/conversations - Zammad user ID:', zammadUser.id)

    // Create a Zammad ticket as conversation
    // Use group_id: 1 (Users group) for all conversations
    const ticket = await zammadClient.createTicket({
      title: 'Conversation',
      group: 'Support',
      group_id: 1, // Users group - accessible to all customers
      customer_id: zammadUser.id, // Use customer_id instead of customer email
      state_id: 1, // new (waiting)
      priority_id: 2, // normal
      article: {
        subject: 'Conversation started',
        body: initial_message || 'Conversation started',
        type: 'note',
        internal: false,
      },
    })

    console.log('[DEBUG] POST /api/conversations - Created ticket:', ticket.id)

    // Add 'conversation' tag to identify this ticket as a conversation
    // Use admin token (no onBehalfOf) because customers don't have permission to add tags
    await zammadClient.addTag(ticket.id, 'conversation')

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
    console.error('POST /api/conversations error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to create conversation', error.message)
  }
}

