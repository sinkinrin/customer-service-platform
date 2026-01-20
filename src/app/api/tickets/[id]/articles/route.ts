/**
 * Ticket Articles API
 *
 * @swagger
 * /api/tickets/{id}/articles:
 *   get:
 *     description: Get the conversation history (articles) for a ticket
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: List of articles (messages) associated with the ticket
 *   post:
 *     description: Add a new article (reply) to a ticket
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - body
 *             properties:
 *               subject:
 *                 type: string
 *               body:
 *                 type: string
 *               content_type:
 *                 type: string
 *                 default: text/html
 *               type:
 *                 type: string
 *                 enum: [note, email, phone, web]
 *                 default: note
 *               internal:
 *                 type: boolean
 *                 default: false
 *               attachment_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: IDs of uploaded files to attach
 *     responses:
 *       201:
 *         description: Article created successfully
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
  to: z.string().email().optional(),  // Recipient email for type='email'
  cc: z.string().optional(),  // CC recipients for type='email'
  // Legacy: base64 embedded attachments
  attachments: z.array(z.object({
    filename: z.string(),
    data: z.string(), // base64 encoded
    'mime-type': z.string(),
  })).optional(),
  // New: Reference pre-uploaded attachments by ID (recommended)
  attachment_ids: z.array(z.number()).optional(),
  // New: Reference cached form uploads from upload_caches API
  form_id: z.string().optional(),
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

    // Security: Only staff/admin can send email type articles
    // Customers should not be able to send emails on behalf of the system
    if (articleData.type === 'email' && user.role === 'customer') {
      return errorResponse('FORBIDDEN', 'Customers cannot send email articles', undefined, 403)
    }

    // Security: Customers cannot specify custom recipients
    // This prevents email relay/spoofing attacks
    if (user.role === 'customer' && (articleData.to || articleData.cc)) {
      return errorResponse('FORBIDDEN', 'Customers cannot specify email recipients', undefined, 403)
    }

    // For email type, we need to get the customer's email as recipient
    let recipientEmail = articleData.to
    if (articleData.type === 'email' && !recipientEmail) {
      // Auto-fill recipient from ticket customer
      try {
        const ticketCustomer = await zammadClient.getUser(ticket.customer_id)
        recipientEmail = ticketCustomer.email
      } catch (error) {
        console.warn('[Articles API] Failed to get customer email for email article:', error)
      }
    }

    // Validate that email type has a recipient
    if (articleData.type === 'email' && !recipientEmail) {
      return errorResponse('INVALID_REQUEST', 'Email articles require a recipient (to) address', undefined, 400)
    }

    // All users create articles with X-On-Behalf-Of to ensure correct sender identity
    // This shows the actual user's name instead of the API token user (e.g., "Howen Support")
    const article = await zammadClient.createArticle(
      {
        ticket_id: ticketId,
        subject: articleData.subject,
        body: articleData.body,
        content_type: articleData.content_type,
        type: articleData.type,
        internal: articleData.internal,
        // For email type, set sender to Agent and include recipient
        ...(articleData.type === 'email' && {
          sender: 'Agent',
          to: recipientEmail,
          ...(articleData.cc && { cc: articleData.cc }),
        }),
        // Support both legacy base64 attachments and new attachment_ids/form_id
        ...(articleData.attachments && { attachments: articleData.attachments }),
        ...(articleData.attachment_ids && { attachment_ids: articleData.attachment_ids }),
        ...(articleData.form_id && { form_id: articleData.form_id }),
      },
      user.email  // Pass user email for all roles to show correct sender name
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
        { service: 'zammad', available: false },
        503
      )
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to create article')
  }
}

