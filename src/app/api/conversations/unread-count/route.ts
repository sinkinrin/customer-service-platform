/**
 * Get Unread Conversations Count API
 *
 * GET /api/conversations/unread-count
 * Returns total unread count for the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { getTotalUnreadCount, getStaffUnreadCount } from '@/lib/local-conversation-storage'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    let unreadCount = 0

    if (user.role === 'customer') {
      // Get unread count for customer's conversations
      unreadCount = await getTotalUnreadCount(user.email)
    } else if (user.role === 'staff') {
      // R4: Get unread count for this staff's assigned conversations only
      unreadCount = await getStaffUnreadCount(user.id)
    } else if (user.role === 'admin') {
      // Admin gets global count (all conversations) by not passing staff_id
      unreadCount = await getStaffUnreadCount()
    }

    return NextResponse.json({
      success: true,
      data: { unreadCount },
    })
  } catch (error) {
    console.error('[API] Get unread count error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get unread count',
        },
      },
      { status: 500 }
    )
  }
}
