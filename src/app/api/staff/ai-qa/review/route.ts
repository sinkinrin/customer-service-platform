/**
 * AI QA Review API
 *
 * POST /api/staff/ai-qa/review - Upsert a review (correct/incorrect) for an AI message
 *
 * Body: { messageId: string, status: 'correct' | 'incorrect', reviewNote?: string }
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { upsertReview } from '@/lib/ai-qa/review-service'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'

const ReviewSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  status: z.enum(['correct', 'incorrect']),
  reviewNote: z.string().max(2000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['staff', 'admin'])

    const body = await request.json()
    const parsed = ReviewSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten().fieldErrors)
    }

    const { messageId, status, reviewNote } = parsed.data

    // Verify the AI message exists
    const aiMessage = await prisma.aiMessage.findUnique({
      where: { id: messageId },
      select: { id: true, senderRole: true },
    })

    if (!aiMessage || aiMessage.senderRole !== 'ai') {
      return notFoundResponse('AI message not found')
    }

    const result = await upsertReview({
      messageId,
      status,
      reviewNote,
      reviewedBy: user.id,
    })

    return successResponse(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return unauthorizedResponse()
    }
    logger.error('AiQaReview', 'Failed to save review', {
      data: { error: message },
    })
    return serverErrorResponse('Failed to save review')
  }
}
