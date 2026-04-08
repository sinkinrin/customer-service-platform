/**
 * AI Q&A Export API
 *
 * GET /api/admin/ai-export - Export AI Q&A rounds to CSV (Admin only)
 *
 * Query params:
 *   from - Start date (ISO string or YYYY-MM-DD), default: 7 days ago
 *   to   - End date   (ISO string or YYYY-MM-DD), default: today
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import { unauthorizedResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'

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

// Safety limit to prevent exporting unbounded data
const MAX_EXPORT_ROWS = 5000

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin'])

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    // Default: last 7 days
    const now = new Date()
    const defaultFrom = new Date(now)
    defaultFrom.setDate(defaultFrom.getDate() - 7)
    defaultFrom.setHours(0, 0, 0, 0)

    const from = fromParam ? new Date(fromParam) : defaultFrom
    const to = toParam ? new Date(toParam) : now
    // Ensure 'to' covers the full day
    if (toParam && to.getHours() === 0 && to.getMinutes() === 0) {
      to.setHours(23, 59, 59, 999)
    }

    // 1. Get all AI messages in the date range with conversation + rating
    const aiMessages = await prisma.aiMessage.findMany({
      where: {
        senderRole: 'ai',
        createdAt: { gte: from, lte: to },
      },
      include: {
        conversation: { select: { customerEmail: true } },
        rating: { select: { rating: true, feedback: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    })

    if (aiMessages.length === 0) {
      // Return CSV with headers only
      const BOM = '\uFEFF'
      const headers = ['Time', 'Conversation ID', 'Customer Email', 'Customer Question', 'AI Response', 'Customer Rating', 'Rating Feedback']
      return new Response(BOM + headers.join(','), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ai-qa-export-${now.toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // 2. Gather all conversation IDs, then fetch ALL messages from those conversations
    //    so we can pair each AI reply with its preceding customer question.
    const conversationIds = [...new Set(aiMessages.map(m => m.conversationId))]

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

    // 3. Index messages by conversation for fast lookup
    const msgsByConv = new Map<string, typeof allMessages>()
    for (const msg of allMessages) {
      let list = msgsByConv.get(msg.conversationId)
      if (!list) {
        list = []
        msgsByConv.set(msg.conversationId, list)
      }
      list.push(msg)
    }

    // 4. Build Q&A rows
    const rows = aiMessages.map(aiMsg => {
      const convMessages = msgsByConv.get(aiMsg.conversationId) || []
      // Find the customer message immediately before this AI message
      let customerQuestion = ''
      for (let i = convMessages.length - 1; i >= 0; i--) {
        const m = convMessages[i]
        if (m.senderRole === 'customer' && m.createdAt < aiMsg.createdAt) {
          customerQuestion = m.content
          break
        }
      }

      return [
        escapeCSV(aiMsg.createdAt.toISOString()),
        escapeCSV(aiMsg.conversationId),
        escapeCSV(aiMsg.conversation.customerEmail),
        escapeCSV(customerQuestion),
        escapeCSV(aiMsg.content),
        escapeCSV(aiMsg.rating?.rating || ''),
        escapeCSV(aiMsg.rating?.feedback || ''),
      ].join(',')
    })

    // 5. Generate CSV
    const BOM = '\uFEFF'
    const headers = ['Time', 'Conversation ID', 'Customer Email', 'Customer Question', 'AI Response', 'Customer Rating', 'Rating Feedback']
    const csvContent = BOM + [headers.join(','), ...rows].join('\n')
    const filename = `ai-qa-export-${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}.csv`

    logger.info('AIExport', 'AI Q&A export completed', {
      data: { rows: rows.length, from: from.toISOString(), to: to.toISOString() },
    })

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    logger.error('AIExport', 'Failed to export AI Q&A data', {
      data: { error: error instanceof Error ? error.message : error },
    })
    return serverErrorResponse('Failed to export AI Q&A data', error.message)
  }
}
