/**
 * QA Rounds Service
 *
 * Queries AiMessage (senderRole='ai') + JOIN AiConversation + AiMessageRating
 * + LEFT JOIN AiQaReview. Supports pagination, status filtering, date range.
 * Sorting: negative rating first -> no rating -> positive rating -> qaTime desc.
 */

import { prisma } from '@/lib/prisma'
import { findQuestionForAiMessage, buildConversationMessageMap } from './qa-pair-extractor'
import type { QaRound, QaStats, QaRoundsResponse, RoundsQueryParams, FilterStatus } from './types'

/**
 * Build the Prisma where clause for AiQaReview filtering.
 */
function buildReviewFilter(status: FilterStatus) {
  if (status === 'unreviewed') {
    return { review: { is: null } }
  }
  if (status === 'correct' || status === 'incorrect') {
    return { review: { is: { status } } }
  }
  // 'all' — no additional filter
  return {}
}

/**
 * Query Q&A rounds with filtering, pagination, and stats.
 */
export async function queryRounds(params: RoundsQueryParams): Promise<QaRoundsResponse> {
  const { status, from, to, page, pageSize } = params

  const baseWhere = {
    senderRole: 'ai',
    createdAt: { gte: from, lte: to },
    ...buildReviewFilter(status),
  }

  // Fetch AI messages with related data
  const [aiMessages, total] = await Promise.all([
    prisma.aiMessage.findMany({
      where: baseWhere,
      include: {
        conversation: { select: { customerEmail: true } },
        rating: { select: { rating: true, feedback: true } },
        review: {
          select: {
            status: true,
            reviewNote: true,
            retestAnswer: true,
            retestAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      // We fetch all matching for sorting purposes, then paginate in-memory
      // This is acceptable given date-range scoping (typically < 1000 rows)
    }),
    prisma.aiMessage.count({ where: baseWhere }),
  ])

  if (aiMessages.length === 0) {
    return {
      rounds: [],
      total: 0,
      page,
      pageSize,
      stats: { total: 0, unreviewed: 0, correct: 0, incorrect: 0 },
    }
  }

  // Fetch all messages from the relevant conversations for Q&A pairing
  const conversationIds = [...new Set(aiMessages.map((m) => m.conversationId))]
  const allMessages = await prisma.aiMessage.findMany({
    where: { conversationId: { in: conversationIds } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      conversationId: true,
      senderRole: true,
      content: true,
      createdAt: true,
    },
  })

  const msgsByConv = buildConversationMessageMap(allMessages)

  // Build rounds
  const allRounds: (QaRound & { _sortRating: number })[] = aiMessages.map((aiMsg) => {
    const convMessages = msgsByConv.get(aiMsg.conversationId) || []
    const question = findQuestionForAiMessage(aiMsg.id, convMessages)
    const customerRating = (aiMsg.rating?.rating as 'positive' | 'negative') || null

    // Sort priority: negative=0 (highest), null=1, positive=2 (lowest)
    let sortRating = 1
    if (customerRating === 'negative') sortRating = 0
    else if (customerRating === 'positive') sortRating = 2

    return {
      messageId: aiMsg.id,
      question,
      answer: aiMsg.content,
      customerEmail: aiMsg.conversation.customerEmail,
      customerRating,
      customerFeedback: aiMsg.rating?.feedback || null,
      reviewStatus: (aiMsg.review?.status as 'correct' | 'incorrect') || null,
      reviewNote: aiMsg.review?.reviewNote || null,
      retestAnswer: aiMsg.review?.retestAnswer || null,
      retestAt: aiMsg.review?.retestAt?.toISOString() || null,
      qaTime: aiMsg.createdAt.toISOString(),
      conversationId: aiMsg.conversationId,
      _sortRating: sortRating,
    }
  })

  // Sort: negative rating first -> no rating -> positive rating -> qaTime desc
  allRounds.sort((a, b) => {
    if (a._sortRating !== b._sortRating) return a._sortRating - b._sortRating
    return new Date(b.qaTime).getTime() - new Date(a.qaTime).getTime()
  })

  // Compute stats from all records (before pagination)
  const stats = computeStats(allRounds)

  // Paginate
  const startIdx = (page - 1) * pageSize
  const paginatedRounds: QaRound[] = allRounds
    .slice(startIdx, startIdx + pageSize)
    .map(({ _sortRating, ...round }) => round)

  return {
    rounds: paginatedRounds,
    total,
    page,
    pageSize,
    stats,
  }
}

function computeStats(rounds: { reviewStatus: string | null }[]): QaStats {
  let unreviewed = 0
  let correct = 0
  let incorrect = 0

  for (const r of rounds) {
    if (r.reviewStatus === null) unreviewed++
    else if (r.reviewStatus === 'correct') correct++
    else if (r.reviewStatus === 'incorrect') incorrect++
  }

  return {
    total: rounds.length,
    unreviewed,
    correct,
    incorrect,
  }
}
