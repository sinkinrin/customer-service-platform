import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ZammadClient } from '@/lib/zammad/client'
import type { ZammadTicket } from '@/lib/zammad/types'
import { notifyTicketReopened, resolveLocalUserIdsForZammadUserId } from '@/lib/notification'
import { logger } from '@/lib/utils/logger'
import { checkTicketPermission, type AuthUser as PermissionUser, type Ticket as PermissionTicket } from '@/lib/utils/permission'

const zammadClient = new ZammadClient()

type ReopenStatus = 'updated' | 'confirmed-after-error' | 'already-open'
type AuditNoteStatus = 'created' | 'rejected' | 'unconfirmed'

type ReopenOperationResult =
  | { kind: 'response'; response: NextResponse }
  | {
      kind: 'reopened'
      originalTicket: ZammadTicket
      updatedTicket: ZammadTicket
      reopenStatus: Exclude<ReopenStatus, 'already-open'>
      auditNote: AuditNoteStatus
    }

const REOPEN_LOCK_OPTIONS = {
  maxWait: 10_000,
  timeout: 60_000,
} as const

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined
  }

  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

function isDefiniteClientRejection(status: number | undefined): status is number {
  return status !== undefined && status >= 400 && status < 500 && status !== 408
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  )
}

function outcomeUnconfirmedResponse(ticketId: number, observedStateId?: number) {
  return errorResponse(
    'OUTCOME_UNCONFIRMED',
    'The reopen request may have succeeded, but its outcome could not be confirmed. Refresh the ticket before trying again.',
    503,
    {
      ticketId,
      observedStateId: observedStateId ?? null,
    }
  )
}

// PUT /api/tickets/[id]/reopen - Reopen a closed ticket
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let reopenTicketId: number | undefined
  let reopenLockAcquired = false
  let zammadMutationAttempted = false

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const expectedUserId = request.headers.get('x-csp-expected-user-id')
    if (expectedUserId && expectedUserId !== session.user.id) {
      return errorResponse(
        'IDENTITY_CHANGED',
        'The authenticated user changed before this request was processed. Reload the ticket and try again.',
        409
      )
    }

    const { id } = await params
    const ticketId = Number(id)

    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(ticketId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid ticket ID' } },
        { status: 400 }
      )
    }
    reopenTicketId = ticketId

    // Serialize the complete state-check/update/note sequence across app
    // instances that share PostgreSQL. The second request re-reads the ticket
    // after acquiring the lock and therefore cannot duplicate app-generated
    // audit notes or notifications for the same reopen transition.
    const lockKey = `ticket-reopen:${ticketId}`
    const operation = await prisma.$transaction<ReopenOperationResult>(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
      reopenLockAcquired = true

      let ticket: ZammadTicket
      try {
        ticket = await zammadClient.getTicket(ticketId)
      } catch (ticketError) {
        const status = getHttpStatus(ticketError)
        if (status === 404) {
          return { kind: 'response', response: errorResponse('NOT_FOUND', 'Ticket not found', 404) }
        }
        if (status !== undefined && status >= 400 && status < 500) {
          return {
            kind: 'response',
            response: errorResponse(
              'UPSTREAM_REJECTED',
              'Zammad rejected the ticket lookup',
              502,
              { upstreamStatus: status }
            ),
          }
        }
        throw ticketError
      }

      const permissionUser: PermissionUser = {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        zammad_id: session.user.zammad_id,
        group_ids: session.user.group_ids,
        region: session.user.region,
      }

      const permissionTicket: PermissionTicket = {
        id: ticket.id,
        customer_id: ticket.customer_id,
        owner_id: ticket.owner_id,
        group_id: ticket.group_id,
        state_id: ticket.state_id,
      }

      if (session.user.role === 'customer') {
        const userZammadId = session.user.zammad_id
        if (!userZammadId || ticket.customer_id !== userZammadId) {
          return {
            kind: 'response',
            response: errorResponse('FORBIDDEN', 'You can only reopen your own tickets', 403),
          }
        }
      }

      if (session.user.role === 'staff') {
        const permissionResult = checkTicketPermission({
          user: permissionUser,
          ticket: permissionTicket,
          action: 'edit',
        })

        if (!permissionResult.allowed) {
          return {
            kind: 'response',
            response: errorResponse('FORBIDDEN', 'You do not have permission to reopen this ticket', 403),
          }
        }
      }

      const isClosed = ticket.state_id === 4
      const isOpen = ticket.state_id === 2

      if (!isClosed && !isOpen) {
        return {
          kind: 'response',
          response: errorResponse('INVALID_STATE', 'Ticket is not closed or open', 400),
        }
      }

      if (isOpen) {
        return {
          kind: 'response',
          response: NextResponse.json({
            success: true,
            data: {
              id: ticket.id,
              state: 'open',
              reopenStatus: 'already-open' satisfies ReopenStatus,
              message: 'Ticket is already open',
            },
          }),
        }
      }

      let reopenStatus: Exclude<ReopenStatus, 'already-open'> = 'updated'
      let updatedTicket: ZammadTicket
      try {
        zammadMutationAttempted = true
        updatedTicket = await zammadClient.updateTicket(ticketId, {
          state: 'open',
        })
      } catch (updateError) {
        const status = getHttpStatus(updateError)

        // A received non-timeout 4xx is a definitive rejection, not an unknown
        // write outcome. A 408 can still mean the mutation committed before
        // the upstream response timed out, so it must use state reconciliation.
        if (isDefiniteClientRejection(status)) {
          logger.warning('TicketReopen', 'Zammad explicitly rejected the reopen request', {
            data: {
              ticketId,
              status,
              error: updateError instanceof Error ? updateError.message : updateError,
            },
          })
          return {
            kind: 'response',
            response: status === 404
              ? errorResponse('NOT_FOUND', 'Ticket not found', 404)
              : errorResponse(
                  'REOPEN_REJECTED',
                  'Zammad rejected the ticket reopen request',
                  502,
                  { upstreamStatus: status }
                ),
          }
        }

        let reconciledTicket: ZammadTicket
        try {
          reconciledTicket = await zammadClient.getTicket(ticketId)
        } catch (reconciliationError) {
          logger.error('TicketReopen', 'Reopen outcome could not be confirmed after an ambiguous write error', {
            data: {
              ticketId,
              updateError: updateError instanceof Error ? updateError.message : updateError,
              reconciliationError: reconciliationError instanceof Error
                ? reconciliationError.message
                : reconciliationError,
            },
          })
          return {
            kind: 'response',
            response: outcomeUnconfirmedResponse(ticketId),
          }
        }

        if (reconciledTicket.state_id !== 2) {
          logger.warning('TicketReopen', 'Reopen outcome remains unconfirmed after state reconciliation', {
            data: {
              ticketId,
              observedStateId: reconciledTicket.state_id,
              updateError: updateError instanceof Error ? updateError.message : updateError,
            },
          })
          return {
            kind: 'response',
            response: outcomeUnconfirmedResponse(ticketId, reconciledTicket.state_id),
          }
        }

        updatedTicket = reconciledTicket
        reopenStatus = 'confirmed-after-error'
        logger.warning('TicketReopen', 'Reopen response failed but the ticket is confirmed open', {
          data: {
            ticketId,
            stateId: reconciledTicket.state_id,
            updateError: updateError instanceof Error ? updateError.message : updateError,
          },
        })
      }

      // The state change is authoritative. Article creation is a separate write
      // whose outcome can be unknown if its response is lost, so never issue a
      // compensating state write that could overwrite a concurrent ticket edit.
      let auditNote: AuditNoteStatus = 'created'
      try {
        await zammadClient.createArticle({
          ticket_id: ticketId,
          body: `Ticket reopened by ${session.user.full_name || session.user.email}`,
          content_type: 'text/plain',
          type: 'note',
          internal: true,
        })
      } catch (articleError) {
        const status = getHttpStatus(articleError)
        const explicitlyRejected = isDefiniteClientRejection(status)
        auditNote = explicitlyRejected ? 'rejected' : 'unconfirmed'
        logger.warning('TicketReopen', explicitlyRejected
          ? 'Ticket reopened but the audit note was rejected; ticket remains open'
          : 'Ticket reopened but audit note outcome is unconfirmed; ticket remains open', {
          data: {
            ticketId,
            state: 'open',
            status,
            error: articleError instanceof Error ? articleError.message : articleError,
          },
        })
      }

      return {
        kind: 'reopened',
        originalTicket: ticket,
        updatedTicket,
        reopenStatus,
        auditNote,
      }
    }, REOPEN_LOCK_OPTIONS)

    if (operation.kind === 'response') {
      return operation.response
    }

    const { originalTicket: ticket, updatedTicket, reopenStatus, auditNote } = operation

    // Best-effort: notify the other side
    try {
      const notifyZammadUserId =
        session.user.role === 'customer'
          ? updatedTicket.owner_id ?? ticket.owner_id
          : ticket.customer_id

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
      logger.warning('TicketReopen', 'Failed to send notification', { data: { error: notifyError instanceof Error ? notifyError.message : notifyError } })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: updatedTicket.id,
          state: 'open',
          outcome: auditNote === 'created' ? 'complete' : 'partial',
          reopenStatus,
          auditNote,
          message: auditNote === 'created'
            ? 'Ticket reopened successfully'
            : auditNote === 'rejected'
              ? 'Ticket reopened, but the audit note was rejected'
              : 'Ticket reopened, but the audit note could not be confirmed',
        },
      },
      { status: auditNote === 'created' ? 200 : 207 }
    )
  } catch (error) {
    logger.error('TicketReopen', 'Failed to reopen ticket', {
      data: {
        ticketId: reopenTicketId,
        reopenLockAcquired,
        zammadMutationAttempted,
        error: error instanceof Error ? error.message : error,
      },
    })

    if (
      reopenTicketId !== undefined &&
      reopenLockAcquired &&
      zammadMutationAttempted
    ) {
      return outcomeUnconfirmedResponse(reopenTicketId)
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reopen ticket' } },
      { status: 500 }
    )
  }
}
