/**
 * Conversations Stats API
 *
 * GET /api/conversations/stats - Get conversation statistics for current user
 * Returns counts for all, waiting, active, and closed conversations in a single query
 *
 * Implementation: Uses Zammad tickets with 'conversation' tag
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'

export async function GET(_request: NextRequest) {
  try {
    const user = await requireAuth()

    // Get all tickets for the user from Zammad
    const allTickets = await zammadClient.getTickets(user.email)

    // Filter tickets with 'conversation' tag
    const conversationTickets = await Promise.all(
      allTickets.map(async (ticket: any) => {
        const tags = await zammadClient.getTags(ticket.id, user.email)
        return { ticket, tags }
      })
    ).then(results =>
      results
        .filter(({ tags }) => tags.includes('conversation'))
        .map(({ ticket }) => ticket)
    )

    // Count conversations by status
    const stats = {
      total: conversationTickets.length,
      waiting: conversationTickets.filter((t: any) => t.state_id === 1).length,
      active: conversationTickets.filter((t: any) => t.state_id === 2).length,
      closed: conversationTickets.filter((t: any) => t.state_id === 4).length,
    }

    return successResponse(stats)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch conversation stats', message)
  }
}

