/**
 * QA Review Service
 *
 * Handles review upsert (by messageId) + audit logging.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'
import type { ReviewStatus } from './types'

interface UpsertReviewParams {
  messageId: string
  status: ReviewStatus
  reviewNote?: string
  reviewedBy: string
}

/**
 * Create or update a review for an AI message.
 * Logs the action for audit purposes.
 */
export async function upsertReview(params: UpsertReviewParams) {
  const { messageId, status, reviewNote, reviewedBy } = params

  // Get previous review status for audit log
  const existing = await prisma.aiQaReview.findUnique({
    where: { messageId },
    select: { status: true },
  })

  const previousStatus = existing?.status || null

  const review = await prisma.aiQaReview.upsert({
    where: { messageId },
    create: {
      messageId,
      status,
      reviewNote: reviewNote || null,
      reviewedBy,
      reviewedAt: new Date(),
    },
    update: {
      status,
      reviewNote: reviewNote || null,
      reviewedBy,
      reviewedAt: new Date(),
    },
  })

  // Audit log
  logger.info('AiQaReview', 'Review action', {
    data: {
      messageId,
      previousStatus,
      newStatus: status,
      reviewedBy,
    },
  })

  return {
    messageId: review.messageId,
    status: review.status,
    reviewNote: review.reviewNote,
    reviewedBy: review.reviewedBy || reviewedBy,
    reviewedAt: review.reviewedAt?.toISOString() || new Date().toISOString(),
  }
}

interface UpsertRetestParams {
  messageId: string
  retestAnswer: string
  retestAppId: string | null
}

/**
 * Update the retest result for a review record.
 * Creates the review if it doesn't exist (with no review status).
 */
export async function upsertRetestResult(params: UpsertRetestParams) {
  const { messageId, retestAnswer, retestAppId } = params
  const now = new Date()

  await prisma.aiQaReview.upsert({
    where: { messageId },
    create: {
      messageId,
      retestAnswer,
      retestAppId,
      retestAt: now,
      // Do NOT set status — retest alone is not a review decision
    },
    update: {
      retestAnswer,
      retestAppId,
      retestAt: now,
    },
  })

  logger.info('AiQaReview', 'Retest completed', {
    data: { messageId, retestAppId },
  })
}
