export type NotificationType =
  | 'ticket_reply'
  | 'ticket_assigned'
  | 'ticket_unassigned'
  | 'ticket_status'
  | 'ticket_created'
  | 'ticket_closed'
  | 'ticket_reopened'
  | 'ticket_rated'
  | 'account_role_changed'
  | 'account_status_changed'
  | 'system_alert'

export interface NotificationData {
  link?: string

  ticketId?: number
  ticketNumber?: string
  ticketTitle?: string

  senderEmail?: string
  newStatus?: string

  targetUserId?: number
  targetEmail?: string
  previousValue?: string
  nextValue?: string
}

export interface CreateNotificationInput {
  userId: string
  type: NotificationType | string
  title: string
  body: string
  data?: NotificationData
  expiresAt?: Date
}

