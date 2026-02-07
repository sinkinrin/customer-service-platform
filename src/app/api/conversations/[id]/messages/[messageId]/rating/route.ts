/**
 * Message Rating API
 *
 * PUT /api/conversations/[id]/messages/[messageId]/rating
 * Rate an AI message (thumbs up/down) with optional feedback
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
import {
  getConversation,
  rateMessage,
} from '@/lib/ai-conversation-service'
import { z } from 'zod'

const RatingSchema = z.object({
  rating: z.enum(['positive', 'negative']).nullable(),
  feedback: z.string().max(2000).optional(),
})

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; messageId: string }> }
) {
  const params = await props.params
  try {
    const user = await requireAuth()
    const { id: conversationId, messageId } = params

    // Verify conversation exists and user has access
    const conversation = await getConversation(conversationId)
    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    if (conversation.customerEmail !== user.email) {
      return notFoundResponse('Conversation not found')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = RatingSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { rating, feedback } = validation.data

    // Perform the rating upsert/delete
    const result = await rateMessage(
      messageId,
      user.id,
      rating,
      feedback
    )

    return successResponse(
      result
        ? {
            rating: result.rating,
            feedback: result.feedback,
          }
        : null
    )
  } catch (error: any) {
    logger.error('MessageRating', 'Failed to rate message', {
      data: { error: error instanceof Error ? error.message : error },
    })
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to rate message', error.message)
  }
}
