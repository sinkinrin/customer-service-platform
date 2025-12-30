/**
 * Zammad Webhook Handler
 *
 * POST /api/webhooks/zammad - Receive Zammad webhook events
 *
 * Processes webhook events and stores them in TicketUpdate table
 * for real-time polling by frontend clients.
 */

import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import type { ZammadWebhookPayload } from '@/lib/zammad/types'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Event types for TicketUpdate
type TicketUpdateEvent = 'article_created' | 'status_changed' | 'assigned' | 'created'

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

    // Validate payload - Zammad sends ticket/article data without explicit event field
    if (!webhookPayload || !webhookPayload.ticket) {
      console.error('Invalid webhook payload - no ticket data:', webhookPayload)
      return errorResponse('INVALID_PAYLOAD', 'Invalid webhook payload', undefined, 400)
    }

    // Log webhook event
    console.log('Zammad webhook received:', {
      ticketId: webhookPayload.ticket?.id,
      ticketTitle: webhookPayload.ticket?.title,
      articleId: webhookPayload.article?.id,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    })

    // Determine event type and store in TicketUpdate table
    const ticketId = webhookPayload.ticket?.id
    if (ticketId) {
      let updateEvent: TicketUpdateEvent | null = null
      let updateData: Record<string, unknown> = {}

      // Determine event type based on webhook payload content
      // Zammad doesn't send explicit event type, infer from payload
      if (webhookPayload.article) {
        // Has article data - either new ticket with first article or new article added
        const ticketCreatedAt = new Date(webhookPayload.ticket.created_at || Date.now()).getTime()
        const articleCreatedAt = new Date(webhookPayload.article.created_at || Date.now()).getTime()
        
        // If ticket and article created within 5 seconds, it's a new ticket
        if (Math.abs(ticketCreatedAt - articleCreatedAt) < 5000) {
          updateEvent = 'created'
          updateData = {
            title: webhookPayload.ticket?.title,
            stateId: webhookPayload.ticket?.state_id,
            articleId: webhookPayload.article.id,
          }
        } else {
          // New article/message on existing ticket
          updateEvent = 'article_created'
          updateData = {
            articleId: webhookPayload.article.id,
            senderEmail: webhookPayload.article.from || String(webhookPayload.article.created_by_id),
            subject: webhookPayload.article.subject,
          }
        }
      } else {
        // No article - likely a status/field change
        updateEvent = 'status_changed'
        updateData = {
          stateId: webhookPayload.ticket?.state_id,
          ownerId: webhookPayload.ticket?.owner_id,
        }
      }

      // Store the update in database
      if (updateEvent) {
        try {
          await prisma.ticketUpdate.create({
            data: {
              ticketId,
              event: updateEvent,
              data: JSON.stringify(updateData),
            },
          })
          console.log('TicketUpdate created:', { ticketId, event: updateEvent })
        } catch (dbError) {
          console.error('Failed to create TicketUpdate:', dbError)
          // Don't fail the webhook - log and continue
        }
      }
    }

    return successResponse({
      message: 'Webhook processed successfully',
      ticketId: webhookPayload.ticket?.id,
      ticketTitle: webhookPayload.ticket?.title,
      processingTime: Date.now() - startTime,
    })
  } catch (error) {
    console.error('POST /api/webhooks/zammad error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

