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
import { isValidRegion, getGroupIdByRegion, type RegionValue } from '@/lib/constants/regions'

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

    // Transform updates for response (safe JSON parsing)
    const transformedUpdates = updates.map((update: { id: string; ticketId: number; event: string; data: string | null; createdAt: Date }) => {
      let parsedData: any = null
      if (update.data) {
        try {
          parsedData = JSON.parse(update.data)
        } catch {
          parsedData = null
        }
      }

      return {
        id: update.id,
        ticketId: update.ticketId,
        event: update.event,
        data: parsedData,
        createdAt: update.createdAt.toISOString(),
      }
    })

    // Filter updates by the user's accessible tickets (best-effort, metadata-based)
    const ZAMMAD_SYSTEM_USER_ID = 1

    const staffGroupIds: number[] | undefined =
      user.role === 'staff'
        ? (user.group_ids && user.group_ids.length > 0
            ? user.group_ids
            : (user.region && isValidRegion(user.region)
                ? [getGroupIdByRegion(user.region as RegionValue)]
                : undefined))
        : undefined

    const filteredUpdates =
      user.role === 'admin'
        ? transformedUpdates
        : transformedUpdates.filter((update) => {
            const data = update.data as any
            const ownerId = typeof data?.ownerId === 'number' ? data.ownerId : undefined
            const groupId = typeof data?.groupId === 'number' ? data.groupId : undefined
            const customerId = typeof data?.customerId === 'number' ? data.customerId : undefined

            if (user.role === 'customer') {
              // Prefer explicit metadata when available
              if (typeof user.zammad_id === 'number' && typeof customerId === 'number') {
                return customerId === user.zammad_id
              }
              // If we cannot establish ownership safely, do not return the update.
              return false
            }

            if (user.role === 'staff') {
              // Staff cannot see unassigned tickets (owner_id null/0/1)
              const isUnassigned = ownerId == null || ownerId === 0 || ownerId === ZAMMAD_SYSTEM_USER_ID
              if (isUnassigned) return false

              // Assigned to me
              if (typeof user.zammad_id === 'number' && ownerId === user.zammad_id) {
                return true
              }

              // In my region (group match)
              if (staffGroupIds && typeof groupId === 'number' && staffGroupIds.includes(groupId)) {
                return true
              }

              return false
            }

            return false
          })

    // Return updates with server timestamp for next poll
    return successResponse({
      updates: filteredUpdates,
      serverTime: Date.now(),
      count: filteredUpdates.length,
    })
  } catch (error) {
    console.error('GET /api/tickets/updates error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}
