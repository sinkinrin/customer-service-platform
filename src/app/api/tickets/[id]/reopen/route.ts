import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ZammadClient } from '@/lib/zammad/client'
import { notifyTicketReopened, resolveLocalUserIdsForZammadUserId } from '@/lib/notification'

const zammadClient = new ZammadClient()

// PUT /api/tickets/[id]/reopen - Reopen a closed ticket
export async function PUT(
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

    // Get current ticket to verify it's closed
    const ticket = await zammadClient.getTicket(ticketId)
    
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } },
        { status: 404 }
      )
    }

    // Check if ticket is closed (state_id 4 = closed in Zammad)
    const isClosed = ticket.state_id === 4
    if (!isClosed) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: 'Ticket is not closed' } },
        { status: 400 }
      )
    }

    // For customers, verify they own the ticket by customer_id
    if (session.user.role === 'customer') {
      const userZammadId = session.user.zammad_id
      if (userZammadId && ticket.customer_id !== userZammadId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'You can only reopen your own tickets' } },
          { status: 403 }
        )
      }
    }

    // Reopen ticket by setting state to 'open' (state_id 2)
    const updatedTicket = await zammadClient.updateTicket(ticketId, {
      state: 'open',
    })

    // Add a note about reopening
    await zammadClient.createArticle({
      ticket_id: ticketId,
      body: `Ticket reopened by ${session.user.full_name || session.user.email}`,
      content_type: 'text/plain',
      type: 'note',
      internal: true,
    })

    // Best-effort: notify the other side
    try {
      const notifyZammadUserId =
        session.user.role === 'customer' ? updatedTicket.owner_id : ticket.customer_id

      if (notifyZammadUserId && notifyZammadUserId !== 1) {
        const recipients = await resolveLocalUserIdsForZammadUserId(notifyZammadUserId)
        for (const recipientUserId of recipients) {
          await notifyTicketReopened({
            recipientUserId,
            ticketId,
            ticketNumber: ticket.number,
          })
        }
      }
    } catch (notifyError) {
      console.error('[Reopen Ticket] Failed to create in-app notification:', notifyError)
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedTicket.id,
        state: 'open',
        message: 'Ticket reopened successfully',
      },
    })
  } catch (error) {
    console.error('[PUT /api/tickets/[id]/reopen] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reopen ticket' } },
      { status: 500 }
    )
  }
}
