import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { zammadClient } from '@/lib/zammad/client'
import { notifyTicketRated, resolveLocalUserIdsForZammadUserId } from '@/lib/notification'
import { checkTicketPermission, type Ticket as PermissionTicket } from '@/lib/utils/permission'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

// Schema for rating submission
const ratingSchema = z.object({
  rating: z.enum(['positive', 'negative']),
  reason: z.string().max(1000).optional(),
})

// GET /api/tickets/[id]/rating - Get ticket rating
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const { id } = await params
    const ticketId = parseInt(id, 10)

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid ticket ID' } },
        { status: 400 }
      )
    }

    // Permission check (must be based on the real ticket)
    let ticket: PermissionTicket
    try {
      // Customer must use X-On-Behalf-Of to ensure they can only access their own tickets
      if (session.user.role === 'customer') {
        ticket = (await zammadClient.getTicket(ticketId, session.user.email)) as any
      } else {
        // Staff/Admin: fetch as admin token, but enforce our permission policy below
        ticket = (await zammadClient.getTicket(ticketId)) as any
      }
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } },
        { status: 404 }
      )
    }

    const permission = checkTicketPermission({
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        zammad_id: session.user.zammad_id,
        group_ids: session.user.group_ids,
        region: session.user.region,
      },
      ticket,
      action: 'view',
    })

    if (!permission.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      )
    }

    const rating = await prisma.ticketRating.findUnique({
      where: { ticketId },
    })

    return NextResponse.json({
      success: true,
      data: rating,
    })
  } catch (error) {
    logger.error('TicketRating', 'Failed to get rating', { data: { error: error instanceof Error ? error.message : error } })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get rating' } },
      { status: 500 }
    )
  }
}

// POST /api/tickets/[id]/rating - Submit ticket rating
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Only customers can rate tickets
    if (session.user.role !== 'customer') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only customers can rate tickets' } },
        { status: 403 }
      )
    }

    const { id } = await params
    const ticketId = parseInt(id, 10)

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid ticket ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validationResult = ratingSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validationResult.error.message } },
        { status: 400 }
      )
    }

    const { rating, reason } = validationResult.data

    // Enforce ownership: customer must be able to access this ticket (Zammad validates via X-On-Behalf-Of)
    try {
      await zammadClient.getTicket(ticketId, session.user.email)
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Ticket not accessible' } },
        { status: 403 }
      )
    }

    // Check if rating already exists
    const existingRating = await prisma.ticketRating.findUnique({
      where: { ticketId },
    })

    let savedRating
    if (existingRating) {
      // Update existing rating
      savedRating = await prisma.ticketRating.update({
        where: { ticketId },
        data: {
          rating,
          reason,
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new rating
      savedRating = await prisma.ticketRating.create({
        data: {
          ticketId,
          userId: session.user.id || session.user.email || 'unknown',
          rating,
          reason,
        },
      })
    }

    // Best-effort: notify current ticket owner
    try {
      const ticket = await zammadClient.getTicket(ticketId)
      if (ticket.owner_id && ticket.owner_id !== 1) {
        const recipients = await resolveLocalUserIdsForZammadUserId(ticket.owner_id)
        for (const recipientUserId of recipients) {
          await notifyTicketRated({
            recipientUserId,
            ticketId,
            ticketNumber: ticket.number,
            rating,
          })
        }
      }
    } catch (notifyError) {
      logger.warning('TicketRating', 'Failed to send notification', { data: { error: notifyError instanceof Error ? notifyError.message : notifyError } })
    }

    return NextResponse.json({
      success: true,
      data: savedRating,
    })
  } catch (error) {
    logger.error('TicketRating', 'Failed to save rating', { data: { error: error instanceof Error ? error.message : error } })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save rating' } },
      { status: 500 }
    )
  }
}
