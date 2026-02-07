/**
 * AI Conversations Dashboard Stats API
 *
 * GET /api/admin/stats/ai-conversations
 * Returns statistics for AI conversations, messages, and ratings
 */

import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/utils/logger'
import { getAiConversationDashboardStats } from '@/lib/ai-conversation-service'

export async function GET() {
  try {
    await requireRole(['admin'])

    const stats = await getAiConversationDashboardStats()

    return successResponse(stats)
  } catch (error: any) {
    logger.error('AiConversationStats', 'Failed to fetch AI conversation statistics', {
      data: { error: error instanceof Error ? error.message : error },
    })
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch AI conversation statistics', error.message)
  }
}
