import { notificationService } from './service'
import type { NotificationType } from './types'

function ticketNumberFallback(ticketNumber: string | undefined, ticketId: number): string {
  return ticketNumber?.toString() || ticketId.toString()
}

export async function notifyTicketReply(params: {
  recipientUserId: string
  ticketId: number
  ticketNumber?: string
  senderEmail?: string
}): Promise<void> {
  const ticketNumber = ticketNumberFallback(params.ticketNumber, params.ticketId)
  const sender = params.senderEmail || 'Unknown sender'

  await notificationService.create({
    userId: params.recipientUserId,
    type: 'ticket_reply',
    title: `Ticket #${ticketNumber} has a new reply`,
    body: `${sender} replied to the ticket`,
    data: {
      ticketId: params.ticketId,
      ticketNumber,
      senderEmail: params.senderEmail,
    },
  })
}

export async function notifyTicketAssigned(params: {
  recipientUserId: string
  ticketId: number
  ticketNumber?: string
  ticketTitle?: string
}): Promise<void> {
  const ticketNumber = ticketNumberFallback(params.ticketNumber, params.ticketId)
  await notificationService.create({
    userId: params.recipientUserId,
    type: 'ticket_assigned',
    title: 'A ticket was assigned to you',
    body: `#${ticketNumber} - ${params.ticketTitle || ''}`.trim(),
    data: {
      ticketId: params.ticketId,
      ticketNumber,
      ticketTitle: params.ticketTitle,
    },
  })
}

export async function notifyTicketUnassigned(params: {
  recipientUserId: string
  ticketId: number
  ticketNumber?: string
  ticketTitle?: string
}): Promise<void> {
  const ticketNumber = ticketNumberFallback(params.ticketNumber, params.ticketId)
  await notificationService.create({
    userId: params.recipientUserId,
    type: 'ticket_unassigned',
    title: 'A ticket was unassigned from you',
    body: `#${ticketNumber} - ${params.ticketTitle || ''}`.trim(),
    data: {
      ticketId: params.ticketId,
      ticketNumber,
      ticketTitle: params.ticketTitle,
    },
  })
}

export async function notifyTicketStatusChange(params: {
  recipientUserId: string
  ticketId: number
  ticketNumber?: string
  newStatus?: string
}): Promise<void> {
  const ticketNumber = ticketNumberFallback(params.ticketNumber, params.ticketId)
  await notificationService.create({
    userId: params.recipientUserId,
    type: 'ticket_status',
    title: `Ticket #${ticketNumber} status updated`,
    body: params.newStatus ? `New status: ${params.newStatus}` : 'Ticket status changed',
    data: {
      ticketId: params.ticketId,
      ticketNumber,
      newStatus: params.newStatus,
    },
  })
}

export async function notifyTicketCreated(params: {
  recipientUserId: string
  ticketId: number
  ticketNumber?: string
  ticketTitle?: string
}): Promise<void> {
  const ticketNumber = ticketNumberFallback(params.ticketNumber, params.ticketId)
  await notificationService.create({
    userId: params.recipientUserId,
    type: 'ticket_created',
    title: 'New ticket created',
    body: `#${ticketNumber} - ${params.ticketTitle || ''}`.trim(),
    data: {
      ticketId: params.ticketId,
      ticketNumber,
      ticketTitle: params.ticketTitle,
    },
  })
}

export async function notifyTicketClosed(params: {
  recipientUserId: string
  ticketId: number
  ticketNumber?: string
}): Promise<void> {
  const ticketNumber = ticketNumberFallback(params.ticketNumber, params.ticketId)
  await notificationService.create({
    userId: params.recipientUserId,
    type: 'ticket_closed',
    title: `Ticket #${ticketNumber} was closed`,
    body: 'The ticket has been closed',
    data: {
      ticketId: params.ticketId,
      ticketNumber,
    },
  })
}

export async function notifyTicketReopened(params: {
  recipientUserId: string
  ticketId: number
  ticketNumber?: string
}): Promise<void> {
  const ticketNumber = ticketNumberFallback(params.ticketNumber, params.ticketId)
  await notificationService.create({
    userId: params.recipientUserId,
    type: 'ticket_reopened',
    title: `Ticket #${ticketNumber} was reopened`,
    body: 'The ticket has been reopened',
    data: {
      ticketId: params.ticketId,
      ticketNumber,
    },
  })
}

export async function notifyTicketRated(params: {
  recipientUserId: string
  ticketId: number
  ticketNumber?: string
  rating: 'positive' | 'negative'
}): Promise<void> {
  const ticketNumber = ticketNumberFallback(params.ticketNumber, params.ticketId)
  await notificationService.create({
    userId: params.recipientUserId,
    type: 'ticket_rated',
    title: `Ticket #${ticketNumber} received feedback`,
    body: `Rating: ${params.rating}`,
    data: {
      ticketId: params.ticketId,
      ticketNumber,
      nextValue: params.rating,
    },
  })
}

export async function notifyAccountRoleChanged(params: {
  recipientUserId: string
  targetUserId?: number
  targetEmail?: string
  previousRole?: string
  nextRole: string
}): Promise<void> {
  await notificationService.create({
    userId: params.recipientUserId,
    type: 'account_role_changed',
    title: 'Your role has been updated',
    body: params.previousRole
      ? `${params.previousRole} -> ${params.nextRole}`
      : `New role: ${params.nextRole}`,
    data: {
      targetUserId: params.targetUserId,
      targetEmail: params.targetEmail,
      previousValue: params.previousRole,
      nextValue: params.nextRole,
    },
  })
}

export async function notifyAccountStatusChanged(params: {
  recipientUserId: string
  targetUserId?: number
  targetEmail?: string
  active: boolean
}): Promise<void> {
  await notificationService.create({
    userId: params.recipientUserId,
    type: 'account_status_changed',
    title: 'Your account status has changed',
    body: params.active ? 'Your account was activated' : 'Your account was disabled',
    data: {
      targetUserId: params.targetUserId,
      targetEmail: params.targetEmail,
      nextValue: params.active ? 'active' : 'disabled',
    },
  })
}

export async function notifySystemAlert(params: {
  recipientUserId: string
  title: string
  body: string
  data?: Record<string, unknown>
}): Promise<void> {
  await notificationService.create({
    userId: params.recipientUserId,
    type: 'system_alert' as NotificationType,
    title: params.title,
    body: params.body,
    data: params.data as any,
  })
}
