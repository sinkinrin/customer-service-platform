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
import {
  createAIConversation,
  getCustomerConversations as _getCustomerConversations,
  getConversationMessages,
  addMessage,
  getAllConversations,
} from '@/lib/local-conversation-storage'

// Reserved for future use: customer-specific conversation filtering
void _getCustomerConversations
import { broadcastConversationEvent } from '@/lib/sse/conversation-broadcaster'
import { filterConversationsByRegion } from '@/lib/utils/region-auth'
import type { RegionValue } from '@/lib/constants/regions'
import { mockGetUserById } from '@/lib/mock-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get conversations based on user role
    let conversations = await getAllConversations()
    
    // Apply region-based filtering
    // - Admin: sees all conversations (can filter by region query param)
    // - Staff: sees only their region's conversations
    // - Customer: sees only their own conversations
    conversations = filterConversationsByRegion(conversations, user)
    
    // Admin can optionally filter by region
    if (user.role === 'admin') {
      const regionFilter = searchParams.get('region')
      if (regionFilter) {
        conversations = conversations.filter(c => c.region === regionFilter)
      }
    }

    // Transform to API format with customer and staff information
    const transformedConversations = await Promise.all(
      conversations.map(async (conv) => {
        // Get actual message count
        const messages = await getConversationMessages(conv.id)

        // Get customer and staff user details for region info
        const customerUser = await mockGetUserById(conv.customer_id)
        const staffUser = conv.staff_id ? await mockGetUserById(conv.staff_id) : null

        return {
          id: conv.id,
          customer_id: conv.customer_id,
          staff_id: conv.staff_id || null,
          business_type_id: null,
          status: conv.status,
          mode: conv.mode,
          region: conv.region || null,
          zammad_ticket_id: conv.zammad_ticket_id,
          transferred_at: conv.transferred_at,
          transfer_reason: conv.transfer_reason,
          message_count: messages.length,
          staff_unread_count: conv.staff_unread_count || 0,
          customer_unread_count: conv.customer_unread_count || 0,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          last_message_at: conv.last_message_at,
          customer: {
            id: conv.customer_id,
            full_name: conv.customer_name || conv.customer_email?.split('@')[0] || 'User',
            email: conv.customer_email || '',
            region: customerUser?.region || conv.region || null,
          },
          staff: conv.staff_id ? {
            id: conv.staff_id,
            full_name: conv.staff_name || 'Staff',
            region: staffUser?.region || null,
          } : null,
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

    // For staff/admin: Group by customer and keep only the latest conversation per customer
    if (user.role === 'staff' || user.role === 'admin') {
      const customerConversationMap = new Map<string, typeof filteredConversations[0]>()

      for (const conv of filteredConversations) {
        const customerEmail = conv.customer?.email || conv.customer_id
        const existing = customerConversationMap.get(customerEmail)

        if (!existing || new Date(conv.last_message_at).getTime() > new Date(existing.last_message_at).getTime()) {
          customerConversationMap.set(customerEmail, conv)
        }
      }

      // Convert back to array and sort again
      filteredConversations = Array.from(customerConversationMap.values())
      filteredConversations.sort((a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      )
    }

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

    // Create local AI conversation (does NOT create Zammad ticket)
    // Automatically inherit region from user
    const userRegion = (user.region as RegionValue) || 'asia-pacific'
    const conversation = await createAIConversation(user.id, user.email, userRegion)

    console.log('[LocalStorage] Created AI conversation:', conversation.id)

    // Save initial message if provided (R2 requirement)
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

      // Broadcast initial message via SSE
      try {
        broadcastConversationEvent(
          {
            type: 'new_message',
            conversationId: conversation.id,
            data: {
              id: initialMessage.id,
              conversation_id: conversation.id,
              sender_id: user.id,
              sender_role: 'customer',
              content: initialMessage.content,
              message_type: 'text',
              metadata: initialMessage.metadata || {},
              created_at: initialMessage.created_at,
              sender: {
                id: user.id,
                full_name: user.full_name || user.email,
                avatar_url: user.avatar_url,
                role: user.role,
              },
            },
          },
          [user.id]
        )
      } catch (error) {
        console.error('[SSE] Failed to broadcast initial message:', error)
        // Don't fail the request if SSE broadcast fails
      }
    }

    // Transform to API format
    const response = {
      id: conversation.id,
      customer_id: conversation.customer_id,
      staff_id: null,
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

