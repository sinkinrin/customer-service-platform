/**
 * Conversation Rating API
 *
 * POST /api/conversations/:id/rating - Submit a rating for a conversation
 * GET /api/conversations/:id/rating - Get the rating for a conversation
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
  forbiddenResponse,
} from '@/lib/utils/api-response'
import { getConversation, updateConversation } from '@/lib/local-conversation-storage'
import { z } from 'zod'

// Request validation schema
const RatingSchema = z.object({
  score: z.number().int().min(1).max(5),
  feedback: z.string().max(500).optional(),
})

/**
 * GET /api/conversations/:id/rating
 * Get the rating for a conversation
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Get conversation
    const conversation = await getConversation(conversationId)
    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Only allow conversation participants to view rating
    if (
      conversation.customer_id !== user.id &&
      conversation.staff_id !== user.id &&
      user.role !== 'admin'
    ) {
      return forbiddenResponse('You do not have permission to view this rating')
    }

    return successResponse({
      conversationId,
      rating: conversation.rating || null,
    })
  } catch (error: any) {
    console.error('GET /api/conversations/[id]/rating error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to get rating', error.message)
  }
}

/**
 * POST /api/conversations/:id/rating
 * Submit a rating for a conversation
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Get conversation
    const conversation = await getConversation(conversationId)
    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Only the customer can rate their own conversation
    if (conversation.customer_id !== user.id) {
      return forbiddenResponse('Only the customer can rate this conversation')
    }

    // Check if conversation is closed (ratings should be submitted after closing)
    if (conversation.status !== 'closed') {
      return validationErrorResponse([
        { path: ['status'], message: 'Conversation must be closed before rating' },
      ])
    }

    // Check if already rated
    if (conversation.rating) {
      return validationErrorResponse([
        { path: ['rating'], message: 'Conversation has already been rated' },
      ])
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = RatingSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { score, feedback } = validation.data

    // Update conversation with rating
    const updated = await updateConversation(conversationId, {
      rating: {
        score: score as 1 | 2 | 3 | 4 | 5,
        feedback,
        rated_at: new Date().toISOString(),
      },
    })

    if (!updated) {
      return serverErrorResponse('Failed to update conversation with rating')
    }

    console.log(`[Rating] Conversation ${conversationId} rated ${score}/5 by ${user.email}`)

    return successResponse(
      {
        message: 'Rating submitted successfully',
        rating: updated.rating,
      },
      201
    )
  } catch (error: any) {
    console.error('POST /api/conversations/[id]/rating error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to submit rating', error.message)
  }
}
