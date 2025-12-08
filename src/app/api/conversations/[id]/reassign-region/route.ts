/**
 * Reassign Conversation Region API
 *
 * POST /api/conversations/[id]/reassign-region - Reassign conversation to a different region
 *
 * Only Admin users can reassign conversations to different regions.
 * This is useful when a customer's actual location differs from their registered region.
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import {
  getConversation,
  updateConversation,
  addMessageWithMetadata,
} from '@/lib/local-conversation-storage'
import { broadcastConversationEvent } from '@/lib/sse/conversation-broadcaster'
import { z } from 'zod'
import { REGIONS, getRegionLabel, type RegionValue } from '@/lib/constants/regions'

// Request validation schema
const ReassignRegionSchema = z.object({
  newRegion: z.enum(REGIONS.map(r => r.value) as [string, ...string[]]),
  reason: z.string().max(500).optional(),
})

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAuth()
    const conversationId = params.id

    // Only Admin can reassign regions
    if (user.role !== 'admin') {
      return forbiddenResponse('Only administrators can reassign conversation regions')
    }

    // Get conversation from local storage
    const conversation = await getConversation(conversationId)

    if (!conversation) {
      return notFoundResponse('Conversation not found')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = ReassignRegionSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { newRegion, reason } = validation.data
    const previousRegion = conversation.region || 'asia-pacific'

    // Check if region is actually changing
    if (previousRegion === newRegion) {
      return validationErrorResponse([
        {
          path: ['newRegion'],
          message: 'Conversation is already in this region',
        },
      ])
    }

    // Update conversation region
    const updated = await updateConversation(conversationId, {
      region: newRegion as RegionValue,
    })

    if (!updated) {
      return serverErrorResponse('Failed to update conversation region')
    }

    // Add system message about region change
    const previousRegionLabel = getRegionLabel(previousRegion as RegionValue, 'zh')
    const newRegionLabel = getRegionLabel(newRegion as RegionValue, 'zh')
    const systemMessageContent = reason
      ? `对话已从 ${previousRegionLabel} 转移至 ${newRegionLabel}。\n原因：${reason}`
      : `对话已从 ${previousRegionLabel} 转移至 ${newRegionLabel}。`

    await addMessageWithMetadata(
      conversationId,
      'system',
      'system',
      systemMessageContent,
      'system',
      {
        type: 'region_reassigned',
        reassignedBy: user.id,
        reassignedByName: user.full_name || user.email,
        reassignedAt: new Date().toISOString(),
        previousRegion,
        newRegion,
        reason,
      }
    )

    console.log('[Region] Conversation region reassigned:', conversationId, previousRegion, '->', newRegion)

    // Broadcast SSE event to notify about region change
    try {
      // Notify staff in both regions
      broadcastConversationEvent(
        {
          type: 'conversation_region_changed',
          conversationId,
          data: {
            conversation: updated,
            previousRegion,
            newRegion,
            reassignedBy: {
              id: user.id,
              name: user.full_name || user.email,
            },
            reason,
            message: `Conversation reassigned from ${previousRegionLabel} to ${newRegionLabel}`,
          },
        },
        ['staff', 'admin']
      )
      console.log('[SSE] Broadcasted conversation_region_changed')
    } catch (error) {
      console.error('[SSE] Failed to broadcast region change:', error)
    }

    // Return success response
    return successResponse(
      {
        conversation: updated,
        previousRegion,
        newRegion,
        message: `Conversation reassigned from ${previousRegionLabel} to ${newRegionLabel}`,
      },
      200
    )
  } catch (error: any) {
    console.error('POST /api/conversations/[id]/reassign-region error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to reassign conversation region', error.message)
  }
}
