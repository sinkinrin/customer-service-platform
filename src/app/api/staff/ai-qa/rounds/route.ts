/**
 * AI QA Rounds API
 *
 * GET /api/staff/ai-qa/rounds - List Q&A rounds with filtering and pagination
 *
 * Query params:
 *   status   - 'all' | 'unreviewed' | 'correct' | 'incorrect' (default: 'all')
 *   from     - Start date (ISO string or YYYY-MM-DD), default: 7 days ago
 *   to       - End date (ISO string or YYYY-MM-DD), default: today
 *   page     - Page number (default: 1)
 *   pageSize - Items per page (default: 50, max: 200)
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import { successResponse, unauthorizedResponse, serverErrorResponse, errorResponse } from '@/lib/utils/api-response'
import { queryRounds } from '@/lib/ai-qa/rounds-service'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, DEFAULT_DATE_RANGE_DAYS } from '@/lib/ai-qa/constants'
import { logger } from '@/lib/utils/logger'
import type { FilterStatus } from '@/lib/ai-qa/types'

const VALID_STATUSES: FilterStatus[] = ['all', 'unreviewed', 'correct', 'incorrect']

export async function GET(request: NextRequest) {
  try {
    await requireRole(['staff', 'admin'])

    const { searchParams } = new URL(request.url)

    // Parse status
    const statusParam = searchParams.get('status') || 'all'
    const status: FilterStatus = VALID_STATUSES.includes(statusParam as FilterStatus)
      ? (statusParam as FilterStatus)
      : 'all'

    // Parse date range
    const now = new Date()
    const defaultFrom = new Date(now)
    defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_DATE_RANGE_DAYS)
    defaultFrom.setHours(0, 0, 0, 0)

    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const from = fromParam ? new Date(fromParam) : defaultFrom
    const to = toParam ? new Date(toParam) : now

    if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) {
      return errorResponse('VALIDATION_ERROR', 'Invalid date format for from/to parameter', undefined, 400)
    }

    // Ensure 'to' covers the full day
    if (toParam && to.getHours() === 0 && to.getMinutes() === 0) {
      to.setHours(23, 59, 59, 999)
    }

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const rawPageSize = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE
    const pageSize = Math.min(Math.max(1, rawPageSize), MAX_PAGE_SIZE)

    const result = await queryRounds({ status, from, to, page, pageSize })

    return successResponse(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return unauthorizedResponse()
    }
    logger.error('AiQaRounds', 'Failed to fetch Q&A rounds', {
      data: { error: message },
    })
    return serverErrorResponse('Failed to fetch Q&A rounds')
  }
}
