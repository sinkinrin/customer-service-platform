/**
 * Switch Conversation to AI Mode API
 *
 * POST /api/conversations/:id/switch-to-ai
 * Switches conversation from human mode back to AI mode
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import * as localStorage from '@/lib/local-conversation-storage'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // R1: Require authentication
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

    // R1: Verify participant access - only customer owner, assigned staff, or admin can switch modes
    const isCustomerOwner = user.role === 'customer' && conversation.customer_email === user.email
    const isAssignedStaff = (user.role === 'staff' || user.role === 'admin') &&
      (conversation.staff_id === user.id || user.role === 'admin')

    if (!isCustomerOwner && !isAssignedStaff) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to switch this conversation mode' },
        },
        { status: 403 }
      )
    }

    // Check if conversation is in human mode
    if (conversation.mode !== 'human') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_MODE', message: 'Conversation is not in human mode' },
        },
        { status: 400 }
      )
    }

    // Update conversation to AI mode
    const updatedConversation = await localStorage.updateConversation(conversationId, {
      mode: 'ai',
      staff_id: undefined,
      staff_name: undefined,
      updated_at: new Date().toISOString(),
    })

    // Add system message
    await localStorage.createMessage({
      conversation_id: conversationId,
      sender_role: 'system',
      sender_id: 'system',
      content: '已切换至AI模式',
      message_type: 'system',
      metadata: { type: 'mode_switch', from: 'human', to: 'ai' },
    })

    return NextResponse.json({
      success: true,
      data: { conversation: updatedConversation },
    })
  } catch (error) {
    console.error('[API] Switch to AI error:', error)

    // R1: Handle authentication errors
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
          message: error instanceof Error ? error.message : 'Failed to switch to AI mode',
        },
      },
      { status: 500 }
    )
  }
}
