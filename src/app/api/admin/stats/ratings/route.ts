import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'

const EMPTY_RATING_STATS = {
  total: 0,
  positive: 0,
  negative: 0,
  satisfactionRate: 0,
  recentNegative: [] as Array<{
    ticketId: number
    reason: string
    createdAt: Date
  }>,
}

function isMissingTicketRatingTableError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2021'
  )
}

// GET /api/admin/stats/ratings - Get customer satisfaction statistics
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Only admin can view stats
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    try {
      const [ratingsByValue, recentNegativeRatings] = await prisma.$transaction(
        async (tx) => Promise.all([
          tx.ticketRating.groupBy({
            by: ['rating'],
            _count: { _all: true },
          }),
          tx.ticketRating.findMany({
            where: { rating: 'negative' },
            select: {
              ticketId: true,
              reason: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
        ]),
        { isolationLevel: 'RepeatableRead' }
      )

      const positive = ratingsByValue.find((item) => item.rating === 'positive')?._count._all ?? 0
      const negative = ratingsByValue.find((item) => item.rating === 'negative')?._count._all ?? 0
      const total = positive + negative
      const satisfactionRate = total > 0 ? Math.round((positive / total) * 100) : 0

      const recentNegative = recentNegativeRatings.map((r) => ({
        ticketId: r.ticketId,
        reason: r.reason || 'No reason provided',
        createdAt: r.createdAt,
      }))

      return NextResponse.json({
        success: true,
        data: {
          total,
          positive,
          negative,
          satisfactionRate,
          recentNegative,
        },
      })
    } catch (dbError) {
      if (isMissingTicketRatingTableError(dbError)) {
        logger.warning('StatsRatings', 'TicketRating table does not exist; returning empty stats', {
          data: { error: dbError instanceof Error ? dbError.message : dbError },
        })
        return NextResponse.json({
          success: true,
          data: EMPTY_RATING_STATS,
        })
      }

      throw dbError
    }
  } catch (error) {
    logger.error('StatsRatings', 'Failed to get rating stats', { data: { error: error instanceof Error ? error.message : error } })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get rating stats' } },
      { status: 500 }
    )
  }
}
