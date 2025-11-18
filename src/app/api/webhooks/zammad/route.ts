/**
 * Zammad Webhook Handler
 *
 * POST /api/webhooks/zammad - Receive Zammad webhook events
 *
 * TODO: Implement webhook processing logic
 * - Store webhook events for real-time updates
 * - Trigger WebSocket notifications to connected clients
 * - Update conversation/ticket state in real-time
 */

import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import type { ZammadWebhookPayload } from '@/lib/zammad/types'
import crypto from 'crypto'
import { broadcastEvent } from '@/lib/sse/ticket-broadcaster'

// ============================================================================
// Webhook Signature Verification
// ============================================================================

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const calculatedSignature = hmac.digest('hex')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    )
  } catch {
    return false
  }
}

// ============================================================================
// POST /api/webhooks/zammad
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let webhookPayload: ZammadWebhookPayload | null = null
  let rawBody = ''

  try {
    // Get raw body for signature verification
    rawBody = await request.text()
    webhookPayload = JSON.parse(rawBody)

    // Verify webhook signature (optional - can be disabled for testing)
    const signature = request.headers.get('X-Zammad-Signature')
    const webhookSecret = process.env.ZAMMAD_WEBHOOK_SECRET

    if (webhookSecret && signature) {
      // Verify signature if both secret and signature are present
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)

      if (!isValid) {
        console.error('Invalid webhook signature')
        return errorResponse('INVALID_SIGNATURE', 'Invalid webhook signature', undefined, 401)
      }
    }

    // Validate payload
    if (!webhookPayload || !webhookPayload.event) {
      console.error('Invalid webhook payload:', webhookPayload)
      return errorResponse('INVALID_PAYLOAD', 'Invalid webhook payload', undefined, 400)
    }

    // Log webhook event
    console.log('Zammad webhook received:', {
      event: webhookPayload.event,
      ticketId: webhookPayload.ticket?.id,
      articleId: webhookPayload.article?.id,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    })

    // R1: Broadcast ticket event via SSE based on webhook type
    try {
      const ticket = webhookPayload.ticket
      if (ticket) {
        let eventType: 'ticket_created' | 'ticket_updated' | 'ticket_deleted' | undefined

        // Map Zammad webhook events to SSE event types
        // Note: Zammad uses 'ticket.create', 'ticket.update', etc. (not 'created', 'updated')
        if (webhookPayload.event === 'ticket.create') {
          eventType = 'ticket_created'
        } else if (webhookPayload.event === 'ticket.update') {
          eventType = 'ticket_updated'
        } else if (webhookPayload.event === 'ticket.close') {
          eventType = 'ticket_updated'
        }

        if (eventType) {
          broadcastEvent({
            type: eventType,
            data: {
              id: ticket.id,
              number: ticket.number,
              title: ticket.title,
              state_id: ticket.state_id,
              priority_id: ticket.priority_id,
              group_id: ticket.group_id,
            },
          })
          console.log('[SSE] Broadcasted', eventType, 'event from webhook for ticket:', ticket.id)
        }
      }
    } catch (error) {
      console.error('[SSE] Failed to broadcast webhook event:', error)
    }

    return successResponse({
      message: 'Webhook received successfully',
      event: webhookPayload.event,
      ticketId: webhookPayload.ticket?.id,
      processingTime: Date.now() - startTime,
    })
  } catch (error) {
    console.error('POST /api/webhooks/zammad error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

