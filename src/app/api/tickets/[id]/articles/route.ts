/**
 * Ticket Articles API
 * 
 * GET  /api/tickets/[id]/articles - Get all articles for a ticket
 * POST /api/tickets/[id]/articles - Add a new article (reply)
 */

import { NextRequest } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { z } from 'zod'
import { checkZammadHealth, getZammadUnavailableMessage, isZammadUnavailableError } from '@/lib/zammad/health-check'

// ============================================================================
// Validation Schemas
// ============================================================================

const createArticleSchema = z.object({
  subject: z.string().min(1).optional(),
  body: z.string().min(1),
  content_type: z.string().default('text/html'),
  type: z.enum(['note', 'email', 'phone', 'web']).default('note'),
  internal: z.boolean().default(false),
  sender: z.string().optional(),
})

// ============================================================================
// GET /api/tickets/[id]/articles
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const ticketId = parseInt(params.id)

    if (isNaN(ticketId)) {
      return errorResponse('INVALID_ID', 'Invalid ticket ID', undefined, 400)
    }

    // Check Zammad health before proceeding
    const healthCheck = await checkZammadHealth()
    if (!healthCheck.isHealthy) {
      console.warn('[Articles API] Zammad service unavailable:', healthCheck.error)
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false }
      )
    }

    // Admin users get articles without X-On-Behalf-Of, others use X-On-Behalf-Of
    const articles = user.role === 'admin'
      ? await zammadClient.getArticlesByTicket(ticketId)
      : await zammadClient.getArticlesByTicket(ticketId, user.email)

    return successResponse({
      articles,
      total: articles.length,
    })
  } catch (error) {
    console.error('GET /api/tickets/[id]/articles error:', error)

    // Check if error is authentication error
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    // Check if error is due to Zammad being unavailable
    if (isZammadUnavailableError(error)) {
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false }
      )
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to fetch articles')
  }
}

// ============================================================================
// POST /api/tickets/[id]/articles
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const ticketId = parseInt(params.id)

    if (isNaN(ticketId)) {
      return errorResponse('INVALID_ID', 'Invalid ticket ID', undefined, 400)
    }

    // Check Zammad health before proceeding
    const healthCheck = await checkZammadHealth()
    if (!healthCheck.isHealthy) {
      console.warn('[Articles API] Zammad service unavailable:', healthCheck.error)
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createArticleSchema.safeParse(body)

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error.errors)
    }

    const articleData = validationResult.data

    // Admin users create articles without X-On-Behalf-Of, others use X-On-Behalf-Of
    const article = user.role === 'admin'
      ? await zammadClient.createArticle({
          ticket_id: ticketId,
          subject: articleData.subject,
          body: articleData.body,
          content_type: articleData.content_type,
          type: articleData.type,
          internal: articleData.internal,
        })
      : await zammadClient.createArticle(
          {
            ticket_id: ticketId,
            subject: articleData.subject,
            body: articleData.body,
            content_type: articleData.content_type,
            type: articleData.type,
            internal: articleData.internal,
          },
          user.email
        )

    return successResponse(
      {
        article,
      },
      201
    )
  } catch (error) {
    console.error('POST /api/tickets/[id]/articles error:', error)

    // Check if error is authentication error
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    // Check if error is due to Zammad being unavailable
    if (isZammadUnavailableError(error)) {
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false }
      )
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to create article')
  }
}

