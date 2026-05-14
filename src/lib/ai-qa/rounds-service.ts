/**
 * QA Rounds Service
 *
 * Queries AiMessage (senderRole='ai') + JOIN AiConversation + AiMessageRating
 * + LEFT JOIN AiQaReview. Supports pagination, status filtering, date range.
 * Sorting: negative rating first -> no rating -> positive rating -> qaTime desc.
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { QaRound, QaStats, QaRoundsResponse, RoundsQueryParams, FilterStatus } from './types'
import { buildConversationMessageMap, findQuestionForAiMessage } from './qa-pair-extractor'

/**
 * Build the Prisma where clause for AiQaReview filtering.
 */
function buildReviewFilter(status: FilterStatus) {
  if (status === 'unreviewed') {
    // Match both: no review record at all, OR retest-only record (status is null)
    return { OR: [{ review: { is: null } }, { review: { status: null } }] }
  }
  if (status === 'correct' || status === 'incorrect') {
    return { review: { is: { status } } }
  }
  // 'all' — no additional filter
  return {}
}

function buildReviewSql(status: FilterStatus) {
  if (status === 'unreviewed') {
    return Prisma.sql`AND (review."id" IS NULL OR review."status" IS NULL)`
  }
  if (status === 'correct' || status === 'incorrect') {
    return Prisma.sql`AND review."status" = ${status}`
  }
  return Prisma.empty
}

/**
 * Query Q&A rounds with filtering, pagination, and stats.
 */
export async function queryRounds(params: RoundsQueryParams): Promise<QaRoundsResponse> {
  const { status, from, to, page, pageSize } = params

  const dateWhere = {
    senderRole: 'ai',
    createdAt: { gte: from, lte: to },
    conversation: {
      messages: {
        some: { senderRole: 'customer' },
      },
    },
  }
  const skip = (page - 1) * pageSize

  const [
    aiMessages,
    totalAll,
    totalUnreviewed,
    totalCorrect,
    totalIncorrect,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; conversationId: string; content: string; createdAt: Date }>>(Prisma.sql`
      SELECT
        message."id",
        message."conversationId",
        message."content",
        message."createdAt"
      FROM "ai_messages" message
      LEFT JOIN "ai_message_ratings" rating ON rating."messageId" = message."id"
      LEFT JOIN "ai_qa_reviews" review ON review."messageId" = message."id"
      WHERE message."senderRole" = 'ai'
        AND message."createdAt" >= ${from}
        AND message."createdAt" <= ${to}
        AND EXISTS (
          SELECT 1
          FROM "ai_messages" customer_message
          WHERE customer_message."conversationId" = message."conversationId"
            AND customer_message."senderRole" = 'customer'
        )
        ${buildReviewSql(status)}
      ORDER BY
        CASE
          WHEN rating."rating" = 'negative' THEN 0
          WHEN rating."rating" IS NULL THEN 1
          WHEN rating."rating" = 'positive' THEN 2
          ELSE 1
        END ASC,
        message."createdAt" DESC
      OFFSET ${skip}
      LIMIT ${pageSize}
    `),
    prisma.aiMessage.count({ where: dateWhere }),
    prisma.aiMessage.count({ where: { ...dateWhere, ...buildReviewFilter('unreviewed') } }),
    prisma.aiMessage.count({ where: { ...dateWhere, ...buildReviewFilter('correct') } }),
    prisma.aiMessage.count({ where: { ...dateWhere, ...buildReviewFilter('incorrect') } }),
  ])

  const stats: QaStats = {
    total: totalAll,
    unreviewed: totalUnreviewed,
    correct: totalCorrect,
    incorrect: totalIncorrect,
  }
  const total = status === 'all' ? totalAll : stats[status]

  if (aiMessages.length === 0) {
    return {
      rounds: [],
      total,
      page,
      pageSize,
      stats,
    }
  }

  // Fetch page-scoped related data only. Avoid Prisma relation include here because
  // this page is latency-sensitive and relation joins were the measured bottleneck.
  const messageIds = aiMessages.map((m) => m.id)
  const conversationIds = [...new Set(aiMessages.map((m) => m.conversationId))]
  const latestPageMessageAt = aiMessages.reduce(
    (latest, message) => (message.createdAt > latest ? message.createdAt : latest),
    aiMessages[0].createdAt
  )
  const [ratings, reviews, conversations, conversationMessages] = await Promise.all([
    prisma.aiMessageRating.findMany({
      where: { messageId: { in: messageIds } },
      select: { messageId: true, rating: true, feedback: true },
    }),
    prisma.aiQaReview.findMany({
      where: { messageId: { in: messageIds } },
      select: { messageId: true, status: true, reviewNote: true, retestAnswer: true, retestAt: true },
    }),
    prisma.aiConversation.findMany({
      where: { id: { in: conversationIds } },
      select: { id: true, customerEmail: true },
    }),
    prisma.aiMessage.findMany({
      where: {
        conversationId: { in: conversationIds },
        senderRole: { in: ['customer', 'ai'] },
        createdAt: { lte: latestPageMessageAt },
      },
      select: { id: true, conversationId: true, senderRole: true, content: true, createdAt: true },
      orderBy: [{ conversationId: 'asc' }, { createdAt: 'asc' }],
    }),
  ])
  const ratingByMessageId = new Map(ratings.map((rating) => [rating.messageId, rating]))
  const reviewByMessageId = new Map(reviews.map((review) => [review.messageId, review]))
  const emailByConversationId = new Map(conversations.map((conversation) => [conversation.id, conversation.customerEmail]))
  const messagesByConversationId = buildConversationMessageMap(conversationMessages)

  // Build rounds
  const rounds: QaRound[] = aiMessages.map((aiMsg) => {
    const rating = ratingByMessageId.get(aiMsg.id)
    const review = reviewByMessageId.get(aiMsg.id)
    const customerRating = (rating?.rating as 'positive' | 'negative') || null

    return {
      messageId: aiMsg.id,
      question: findQuestionForAiMessage(aiMsg.id, messagesByConversationId.get(aiMsg.conversationId) || []),
      answer: aiMsg.content,
      customerEmail: emailByConversationId.get(aiMsg.conversationId) || '',
      customerRating,
      customerFeedback: rating?.feedback || null,
      reviewStatus: (review?.status as 'correct' | 'incorrect') || null,
      reviewNote: review?.reviewNote || null,
      retestAnswer: review?.retestAnswer || null,
      retestAt: review?.retestAt?.toISOString() || null,
      qaTime: aiMsg.createdAt.toISOString(),
      conversationId: aiMsg.conversationId,
    }
  })

  return {
    rounds,
    total,
    page,
    pageSize,
    stats,
  }
}
