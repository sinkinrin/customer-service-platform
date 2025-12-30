/**
 * Ticket Updates API
 *
 * GET /api/tickets/updates - Get ticket updates since a timestamp
 *
 * Used by frontend for smart polling to detect new messages/status changes.
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { successResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { prisma } from '@/lib/prisma'

// Maximum updates to return per request
const MAX_UPDATES = 100

// ============================================================================
// GET /api/tickets/updates
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Get 'since' timestamp from query params
    const searchParams = request.nextUrl.searchParams
    const sinceParam = searchParams.get('since')
    
    // Default to 5 minutes ago if no timestamp provided
    const since = sinceParam 
      ? new Date(parseInt(sinceParam, 10))
      : new Date(Date.now() - 5 * 60 * 1000)

    // Query updates from database
    // Note: For now, return all updates. In production, filter by user's accessible tickets.
    const updates = await prisma.ticketUpdate.findMany({
      where: {
        createdAt: {
          gt: since,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: MAX_UPDATES,
    })

    // Transform updates for response
    const transformedUpdates = updates.map((update: { id: string; ticketId: number; event: string; data: string | null; createdAt: Date }) => ({
      id: update.id,
      ticketId: update.ticketId,
      event: update.event,
      data: update.data ? JSON.parse(update.data) : null,
      createdAt: update.createdAt.toISOString(),
    }))

    // Return updates with server timestamp for next poll
    return successResponse({
      updates: transformedUpdates,
      serverTime: Date.now(),
      count: transformedUpdates.length,
    })
  } catch (error) {
    console.error('GET /api/tickets/updates error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}
