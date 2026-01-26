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
import { getApiLogger } from '@/lib/utils/api-logger'
import type { ZammadWebhookPayload } from '@/lib/zammad/types'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import {
  notifyTicketAssigned,
  notifyTicketReply,
  notifyTicketStatusChange,
  resolveLocalUserIdsForZammadUserId,
} from '@/lib/notification'
import { sseEmitter } from '@/lib/sse/emitter'
import { handleEmailTicketRoutingFromWebhookPayload } from '@/lib/ticket/email-ticket-routing'

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
    // Zammad sends signature in format: sha1=<hex>
    const match = signature.match(/^sha1=([a-f0-9]+)$/i)
    if (!match) {
      // Log will be handled by caller with access to logger
      return false
    }
    const providedHash = match[1]

    const hmac = crypto.createHmac('sha1', secret)
    hmac.update(payload)
    const calculatedHash = hmac.digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(providedHash),
      Buffer.from(calculatedHash)
    )
  } catch {
    return false
  }
}

// ============================================================================
// POST /api/webhooks/zammad
// ============================================================================

import { mapStateIdToString } from '@/lib/constants/zammad-states'

function mapStateIdToStatus(stateId: number | null | undefined): string | undefined {
  if (stateId == null) return undefined
  return mapStateIdToString(stateId)
}


export async function POST(request: NextRequest) {
  const log = getApiLogger('ZammadWebhook', request)
  const startTime = Date.now()
  let webhookPayload: ZammadWebhookPayload | null = null
  let rawBody = ''

  try {
    // Get raw body for signature verification
    rawBody = await request.text()
    webhookPayload = JSON.parse(rawBody)

    // Verify webhook signature (optional - can be disabled for testing)
    // Zammad uses X-Hub-Signature header with sha1=<hex> format
    const signature = request.headers.get('X-Hub-Signature') ?? request.headers.get('X-Zammad-Signature')
    const webhookSecret = process.env.ZAMMAD_WEBHOOK_SECRET

    if (webhookSecret && signature) {
      // Verify signature if both secret and signature are present
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)

      if (!isValid) {
        log.error('Invalid webhook signature')
        return errorResponse('INVALID_SIGNATURE', 'Invalid webhook signature', undefined, 401)
      }
    }

    // Validate payload - Zammad sends ticket/article data without explicit event field
    if (!webhookPayload || !webhookPayload.ticket) {
      log.error('Invalid webhook payload - no ticket data', { payload: webhookPayload })
      return errorResponse('INVALID_PAYLOAD', 'Invalid webhook payload', undefined, 400)
    }

    // Log webhook event
    log.info('Zammad webhook received', {
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

      const baseMetadata: Record<string, unknown> = {
        customerId: typeof webhookPayload.ticket.customer_id === 'number' ? webhookPayload.ticket.customer_id : undefined,
        ownerId: webhookPayload.ticket.owner_id ?? undefined,
        groupId: webhookPayload.ticket.group_id ?? undefined,
        stateId: webhookPayload.ticket.state_id ?? undefined,
      }

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
            ...baseMetadata,
            title: webhookPayload.ticket?.title,
            articleId: webhookPayload.article.id,
          }
        } else {
          // New article/message on existing ticket
          updateEvent = 'article_created'
          updateData = {
            ...baseMetadata,
            articleId: webhookPayload.article.id,
            senderEmail: webhookPayload.article.from || String(webhookPayload.article.created_by_id),
            subject: webhookPayload.article.subject,
          }
        }
      } else {
        // No article - likely a status/field change or assignment
        const updatedAt = new Date(webhookPayload.ticket.updated_at || Date.now()).getTime()
        const lastOwnerUpdateAt = webhookPayload.ticket.last_owner_update_at
          ? new Date(webhookPayload.ticket.last_owner_update_at).getTime()
          : null

        const ownerChangedRecently =
          lastOwnerUpdateAt != null && Math.abs(updatedAt - lastOwnerUpdateAt) < 5000

        if (ownerChangedRecently && webhookPayload.ticket.owner_id && webhookPayload.ticket.owner_id !== 1) {
          updateEvent = 'assigned'
          updateData = {
            ...baseMetadata,
          }
        } else {
          updateEvent = 'status_changed'
          updateData = {
            ...baseMetadata,
          }
        }
      }

      // Store the update in database
      if (updateEvent) {
        try {
          const ticketUpdate = await prisma.ticketUpdate.create({
            data: {
              ticketId,
              event: updateEvent,
              data: JSON.stringify(updateData),
            },
          })
          log.info('TicketUpdate created', { ticketId, event: updateEvent })

          // Broadcast via SSE to connected clients (targeted to relevant users only)
          try {
            // Compute target user IDs: owner (assigned staff) + customer
            // Admin users are automatically included by the emitter
            const targetUserIds: string[] = []

            // Add ticket owner (assigned staff)
            if (webhookPayload.ticket.owner_id && webhookPayload.ticket.owner_id !== 1) {
              const ownerLocalIds = await resolveLocalUserIdsForZammadUserId(webhookPayload.ticket.owner_id)
              targetUserIds.push(...ownerLocalIds)
            }

            // Add ticket customer
            if (typeof webhookPayload.ticket.customer_id === 'number') {
              const customerLocalIds = await resolveLocalUserIdsForZammadUserId(webhookPayload.ticket.customer_id)
              targetUserIds.push(...customerLocalIds)
            }

            sseEmitter.broadcast({
              id: ticketUpdate.id,
              ticketId,
              event: updateEvent,
              data: updateData,
              createdAt: ticketUpdate.createdAt.toISOString(),
            }, targetUserIds.length > 0 ? targetUserIds : undefined)
          } catch (sseError) {
            log.error('SSE broadcast failed', { error: sseError instanceof Error ? sseError.message : sseError })
          }
        } catch (dbError) {
          log.error('Failed to create TicketUpdate', { error: dbError instanceof Error ? dbError.message : dbError })
          // Don't fail the webhook - log and continue
        }
      }

      // Best-effort: create persistent in-app notifications
      try {
        if (updateEvent === 'article_created') {
          const senderEmail =
            (webhookPayload.article?.from && String(webhookPayload.article.from)) ||
            (webhookPayload.article?.created_by_id != null ? String(webhookPayload.article.created_by_id) : undefined)

          const senderIsCustomer = webhookPayload.article?.sender === 'Customer'

          if (senderIsCustomer && webhookPayload.ticket.owner_id && webhookPayload.ticket.owner_id !== 1) {
            const recipients = await resolveLocalUserIdsForZammadUserId(webhookPayload.ticket.owner_id)
            for (const recipientUserId of recipients) {
              await notifyTicketReply({
                recipientUserId,
                ticketId,
                ticketNumber: webhookPayload.ticket.number,
                senderEmail,
              })
            }
          } else if (typeof webhookPayload.ticket.customer_id === 'number') {
            const recipients = await resolveLocalUserIdsForZammadUserId(webhookPayload.ticket.customer_id)
            for (const recipientUserId of recipients) {
              await notifyTicketReply({
                recipientUserId,
                ticketId,
                ticketNumber: webhookPayload.ticket.number,
                senderEmail,
              })
            }
          }
        } else if (updateEvent === 'assigned') {
          if (webhookPayload.ticket.owner_id && webhookPayload.ticket.owner_id !== 1) {
            const recipients = await resolveLocalUserIdsForZammadUserId(webhookPayload.ticket.owner_id)
            for (const recipientUserId of recipients) {
              await notifyTicketAssigned({
                recipientUserId,
                ticketId,
                ticketNumber: webhookPayload.ticket.number,
                ticketTitle: webhookPayload.ticket.title,
              })
            }
          }
        } else if (updateEvent === 'status_changed') {
          if (typeof webhookPayload.ticket.customer_id === 'number') {
            const recipients = await resolveLocalUserIdsForZammadUserId(webhookPayload.ticket.customer_id)
            for (const recipientUserId of recipients) {
              await notifyTicketStatusChange({
                recipientUserId,
                ticketId,
                ticketNumber: webhookPayload.ticket.number,
                newStatus: mapStateIdToStatus(webhookPayload.ticket.state_id),
              })
            }
          }
        }
      } catch (notifyError) {
        log.error('Failed to create in-app notifications', { error: notifyError instanceof Error ? notifyError.message : notifyError })
      }

      // Non-blocking: route newly created email tickets from staging group to regional group
      if (updateEvent === 'created') {
        void handleEmailTicketRoutingFromWebhookPayload(webhookPayload!, log.requestId)
      }
    }

    return successResponse({
      message: 'Webhook processed successfully',
      ticketId: webhookPayload.ticket?.id,
      ticketTitle: webhookPayload.ticket?.title,
      processingTime: Date.now() - startTime,
    })
  } catch (error) {
    log.error('POST /api/webhooks/zammad error', { error: error instanceof Error ? error.message : error })
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

