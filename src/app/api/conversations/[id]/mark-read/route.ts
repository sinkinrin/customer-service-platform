/**
 * Mark Conversation as Read API
 *
 * POST /api/conversations/:id/mark-read
 * Resets unread count to 0 and updates last_read_at timestamp
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import * as localStorage from '@/lib/local-conversation-storage'
import { broadcastConversationUpdate, broadcastUnreadCountUpdate } from '@/lib/sse/conversation-broadcaster'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Get conversation
    const conversation = await localStorage.getConversation(conversationId)
    if (!conversation) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' },
        },
        { status: 404 }
      )
    }

    // R3: Verify user is a participant in this conversation
    const isCustomerOwner = user.role === 'customer' && conversation.customer_email === user.email
    const isAssignedStaff = (user.role === 'staff' || user.role === 'admin') &&
      (conversation.staff_id === user.id || user.role === 'admin')

    if (!isCustomerOwner && !isAssignedStaff) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not a participant in this conversation' },
        },
        { status: 403 }
      )
    }

    // Determine the role marking as read
    const userRole = user.role === 'customer' ? 'customer' : 'staff'

    // Mark as read for the specific role
    const updatedConversation = await localStorage.markConversationAsRead(conversationId, userRole)

    // Broadcast update to connected clients
    broadcastConversationUpdate(conversationId, updatedConversation)

    // Broadcast updated unread count to the user
    try {
      const unreadCount = userRole === 'customer'
        ? await localStorage.getTotalUnreadCount(user.email)
        : await localStorage.getStaffUnreadCount()

      broadcastUnreadCountUpdate(user.id, unreadCount)
      console.log(`[SSE] Broadcasted unread count update to ${user.id}: ${unreadCount}`)
    } catch (error) {
      console.error('[SSE] Failed to broadcast unread count:', error)
    }

    return NextResponse.json({
      success: true,
      data: { conversation: updatedConversation },
    })
  } catch (error) {
    console.error('[API] Mark conversation as read error:', error)

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
          message: error instanceof Error ? error.message : 'Failed to mark conversation as read',
        },
      },
      { status: 500 }
    )
  }
}
