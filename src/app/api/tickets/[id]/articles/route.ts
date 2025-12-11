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
  notFoundResponse,
} from '@/lib/utils/api-response'
import { validateTicketAccess } from '@/lib/utils/region-auth'
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

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
        { service: 'zammad', available: false },
        503
      )
    }

    // OpenSpec: Validate region/ownership access before fetching articles
    // First, fetch the ticket to check permissions
    // Admin and Staff get ticket without X-On-Behalf-Of (staff access is validated by region)
    // Customer uses X-On-Behalf-Of to ensure they can only access their own tickets
    const ticket = user.role === 'customer'
      ? await zammadClient.getTicket(ticketId, user.email)
      : await zammadClient.getTicket(ticketId)

    if (!ticket) {
      return notFoundResponse('Ticket not found')
    }

    // Validate access control
    if (user.role === 'staff') {
      try {
        validateTicketAccess(user, ticket.group_id)
      } catch (error) {
        console.warn('[Articles API] Staff access denied:', error instanceof Error ? error.message : 'Unknown error')
        return errorResponse('FORBIDDEN', 'You do not have permission to access articles for this ticket', undefined, 403)
      }
    } else if (user.role === 'customer') {
      // Customer can only access articles for their own tickets
      // P2 Fix: Since we already used X-On-Behalf-Of to fetch the ticket,
      // Zammad has already verified ownership. The additional email check
      // is a secondary validation that should gracefully handle missing emails.
      try {
        const ticketCustomer = await zammadClient.getUser(ticket.customer_id)
        // P2 Fix: If Zammad user has email, verify it matches
        // If email is missing, trust the X-On-Behalf-Of result (already limited to user's tickets)
        if (ticketCustomer.email) {
          if (ticketCustomer.email.toLowerCase() !== user.email.toLowerCase()) {
            console.warn('[Articles API] Customer access denied: ticket belongs to different customer')
            return notFoundResponse('Ticket not found')
          }
        } else {
          // Email missing in Zammad - trust X-On-Behalf-Of validation
          console.log('[Articles API] Ticket customer has no email, trusting X-On-Behalf-Of validation')
        }
      } catch (error) {
        // P2 Fix: If we can't fetch user info, trust X-On-Behalf-Of result
        // The ticket was already fetched with X-On-Behalf-Of, so ownership is verified
        console.warn('[Articles API] Failed to fetch ticket customer, trusting X-On-Behalf-Of:', error)
      }
    }

    // Admin and Staff get articles without X-On-Behalf-Of (staff access already validated by region)
    // Customer uses X-On-Behalf-Of to ensure they can only access their own tickets' articles
    const articles = user.role === 'customer'
      ? await zammadClient.getArticlesByTicket(ticketId, user.email)
      : await zammadClient.getArticlesByTicket(ticketId)

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
        { service: 'zammad', available: false },
        503
      )
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to fetch articles')
  }
}

// ============================================================================
// POST /api/tickets/[id]/articles
// ============================================================================

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
        { service: 'zammad', available: false },
        503
      )
    }

    // OpenSpec: Validate region/ownership access before creating article
    // First, fetch the ticket to check permissions
    // Admin and Staff get ticket without X-On-Behalf-Of (staff access is validated by region)
    // Customer uses X-On-Behalf-Of to ensure they can only access their own tickets
    const ticket = user.role === 'customer'
      ? await zammadClient.getTicket(ticketId, user.email)
      : await zammadClient.getTicket(ticketId)

    if (!ticket) {
      return notFoundResponse('Ticket not found')
    }

    // Validate access control
    if (user.role === 'staff') {
      try {
        validateTicketAccess(user, ticket.group_id)
      } catch (error) {
        console.warn('[Articles API] Staff create access denied:', error instanceof Error ? error.message : 'Unknown error')
        return errorResponse('FORBIDDEN', 'You do not have permission to create articles for this ticket', undefined, 403)
      }
    } else if (user.role === 'customer') {
      // Customer can only create articles for their own tickets
      try {
        const ticketCustomer = await zammadClient.getUser(ticket.customer_id)
        // Guard against missing email from Zammad
        if (!ticketCustomer.email) {
          console.warn('[Articles API] Customer create access denied: ticket customer has no email')
          return notFoundResponse('Ticket not found')
        }
        if (ticketCustomer.email.toLowerCase() !== user.email.toLowerCase()) {
          console.warn('[Articles API] Customer create access denied: ticket belongs to different customer')
          return notFoundResponse('Ticket not found')
        }
      } catch (error) {
        console.error('[Articles API] Failed to verify ticket ownership for article creation:', error)
        return notFoundResponse('Ticket not found')
      }
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createArticleSchema.safeParse(body)

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error.errors)
    }

    const articleData = validationResult.data

    // Admin and Staff create articles without X-On-Behalf-Of (staff access already validated by region)
    // Customer uses X-On-Behalf-Of to ensure proper ownership
    const article = user.role === 'customer'
      ? await zammadClient.createArticle(
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
      : await zammadClient.createArticle({
          ticket_id: ticketId,
          subject: articleData.subject,
          body: articleData.body,
          content_type: articleData.content_type,
          type: articleData.type,
          internal: articleData.internal,
        })

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
        { service: 'zammad', available: false },
        503
      )
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to create article')
  }
}

