import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'

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
      const [total, ratingsByValue, recentNegativeRatings] = await Promise.all([
        prisma.ticketRating.count(),
        prisma.ticketRating.groupBy({
          by: ['rating'],
          _count: { _all: true },
        }),
        prisma.ticketRating.findMany({
          where: { rating: 'negative' },
          select: {
            ticketId: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ])

      const positive = ratingsByValue.find((item) => item.rating === 'positive')?._count._all ?? 0
      const negative = ratingsByValue.find((item) => item.rating === 'negative')?._count._all ?? 0
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
      // Database table may not exist yet
      logger.warning('StatsRatings', 'Could not query ratings', { data: { error: dbError instanceof Error ? dbError.message : dbError } })
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          positive: 0,
          negative: 0,
          satisfactionRate: 0,
          recentNegative: [],
        },
      })
    }
  } catch (error) {
    logger.error('StatsRatings', 'Failed to get rating stats', { data: { error: error instanceof Error ? error.message : error } })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get rating stats' } },
      { status: 500 }
    )
  }
}
