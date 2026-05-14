/**
 * AI QA Export API
 *
 * GET /api/staff/ai-qa/export - Export AI Q&A rounds to CSV (Staff + Admin)
 *
 * Migrated from /api/admin/ai-export with:
 * - Permission changed to staff + admin
 * - Refactored to use shared qa-pair-extractor
 * - Same CSV format with BOM + formula injection protection
 *
 * Query params:
 *   from - Start date (ISO string or YYYY-MM-DD), default: 7 days ago
 *   to   - End date (ISO string or YYYY-MM-DD), default: today
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import { unauthorizedResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'
import { findQuestionForAiMessage, buildConversationMessageMap } from '@/lib/ai-qa/qa-pair-extractor'
import { MAX_EXPORT_ROWS, DEFAULT_DATE_RANGE_DAYS } from '@/lib/ai-qa/constants'

/** Escape CSV field with formula injection protection */
function escapeCSV(value: string | null | undefined): string {
  if (value == null) return ''
  let str = String(value)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes("'")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function getAiMode(metadata: string | null | undefined): string {
  if (!metadata) return ''
  try {
    const parsed = JSON.parse(metadata)
    return parsed?.aiChatMode === 'flash' || parsed?.aiChatMode === 'pro'
      ? parsed.aiChatMode
      : ''
  } catch {
    return ''
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['staff', 'admin'])

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    // Default: last 7 days
    const now = new Date()
    const defaultFrom = new Date(now)
    defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_DATE_RANGE_DAYS)
    defaultFrom.setHours(0, 0, 0, 0)

    const from = fromParam ? new Date(fromParam) : defaultFrom
    const to = toParam ? new Date(toParam) : now

    if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) {
      return new Response('Invalid date format', { status: 400 })
    }
    // Ensure 'to' covers the full day
    if (toParam && to.getHours() === 0 && to.getMinutes() === 0) {
      to.setHours(23, 59, 59, 999)
    }

    // 1. Get all AI messages in the date range with conversation + rating + review
    const aiMessages = await prisma.aiMessage.findMany({
      where: {
        senderRole: 'ai',
        createdAt: { gte: from, lte: to },
        conversation: {
          messages: {
            some: { senderRole: 'customer' },
          },
        },
      },
      include: {
        conversation: { select: { customerEmail: true } },
        rating: { select: { rating: true, feedback: true } },
        review: { select: { status: true, reviewNote: true, retestAnswer: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    })

    const BOM = '\uFEFF'
    const headers = [
      'Time',
      'Conversation ID',
      'Customer Email',
      'Customer Question',
      'AI Response',
      'AI Mode',
      'Customer Rating',
      'Rating Feedback',
      'Review Status',
      'Review Note',
    ]

    if (aiMessages.length === 0) {
      return new Response(BOM + headers.join(','), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ai-qa-export-${now.toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // 2. Gather all conversation messages for Q&A pairing
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

    // 3. Build CSV rows
    const rows = aiMessages.map((aiMsg) => {
      const convMessages = msgsByConv.get(aiMsg.conversationId) || []
      const question = findQuestionForAiMessage(aiMsg.id, convMessages)

      return [
        escapeCSV(aiMsg.createdAt.toISOString()),
        escapeCSV(aiMsg.conversationId),
        escapeCSV(aiMsg.conversation.customerEmail),
        escapeCSV(question),
        escapeCSV(aiMsg.content),
        escapeCSV(getAiMode(aiMsg.metadata)),
        escapeCSV(aiMsg.rating?.rating || ''),
        escapeCSV(aiMsg.rating?.feedback || ''),
        escapeCSV(aiMsg.review?.status || ''),
        escapeCSV(aiMsg.review?.reviewNote || ''),
      ].join(',')
    })

    // 4. Generate CSV
    const csvContent = BOM + [headers.join(','), ...rows].join('\n')
    const filename = `ai-qa-export-${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}.csv`

    logger.info('AiQaExport', 'AI Q&A export completed', {
      data: { rows: rows.length, from: from.toISOString(), to: to.toISOString() },
    })

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return unauthorizedResponse()
    }
    logger.error('AiQaExport', 'Failed to export AI Q&A data', {
      data: { error: message },
    })
    return serverErrorResponse('Failed to export AI Q&A data')
  }
}
