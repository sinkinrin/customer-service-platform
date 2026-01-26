import type { ZammadWebhookPayload } from '@/lib/zammad/types'
import { STAGING_GROUP_ID, getGroupIdByRegion, isValidRegion, type RegionValue } from '@/lib/constants/regions'
import { ZAMMAD_ROLES } from '@/lib/constants/zammad'
import { zammadClient } from '@/lib/zammad/client'
import { autoAssignSingleTicket, handleAssignmentNotification } from '@/lib/ticket/auto-assign'
import { notifySystemAlert, resolveLocalUserIdsForZammadUserId } from '@/lib/notification'
import { createApiLogger } from '@/lib/utils/api-logger'

export function parseRegionFromNote(note?: string | null): { raw?: string; region?: RegionValue } {
  if (!note) return {}
  const match = note.match(/Region:\s*([^\s]+)/i)
  const raw = match?.[1]?.trim()
  if (!raw) return {}
  if (!isValidRegion(raw)) return { raw }
  return { raw, region: raw }
}

async function notifyAdminsAboutUnroutedTicket(params: {
  ticketId: number
  ticketNumber?: string
  ticketTitle?: string
  customerEmail?: string
  reason: string
  requestId?: string
}): Promise<void> {
  const log = createApiLogger('EmailTicketRouting', params.requestId)

  try {
    const allUsers = await zammadClient.searchUsers('*')
    const adminUsers = allUsers.filter(user => user.role_ids?.includes(ZAMMAD_ROLES.ADMIN) && user.active)

    let notifiedCount = 0
    for (const admin of adminUsers) {
      const adminLocalIds = await resolveLocalUserIdsForZammadUserId(admin.id)
      for (const recipientUserId of adminLocalIds) {
        await notifySystemAlert({
          recipientUserId,
          title: '邮件工单未自动路由',
          body: [
            params.ticketNumber ? `工单 #${params.ticketNumber}` : `工单ID ${params.ticketId}`,
            params.customerEmail ? `客户邮箱：${params.customerEmail}` : undefined,
            `原因：${params.reason}`,
          ]
            .filter(Boolean)
            .join('\n'),
          data: {
            ticketId: params.ticketId,
            ticketNumber: params.ticketNumber,
            ticketTitle: params.ticketTitle,
            customerEmail: params.customerEmail,
            reason: params.reason,
          },
        })
        notifiedCount++
      }
    }

    log.info('Notified admins about unrouted email ticket', {
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      notifiedCount,
    })
  } catch (error) {
    log.error('Failed to notify admins about unrouted email ticket', {
      error: error instanceof Error ? error.message : error,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
    })
  }
}

export async function handleEmailTicketRoutingFromWebhookPayload(
  payload: ZammadWebhookPayload,
  requestId?: string
): Promise<void> {
  const log = createApiLogger('EmailTicketRouting', requestId)

  try {
    const ticket = payload.ticket

    if (ticket.group_id !== STAGING_GROUP_ID) return
    if (payload.article?.type !== 'email') return
    if (typeof ticket.customer_id !== 'number') {
      log.warning('Skipping email ticket routing: missing customer_id', { ticketId: ticket.id })
      return
    }

    const customerId = ticket.customer_id
    let customerEmail: string | undefined
    let note: string | undefined

    try {
      const customer = await zammadClient.getUser(customerId)
      customerEmail = customer.email
      note = customer.note
    } catch (error) {
      log.error('Failed to fetch customer from Zammad; skipping routing', {
        ticketId: ticket.id,
        customerId,
        error: error instanceof Error ? error.message : error,
      })
      return
    }

    const { raw, region } = parseRegionFromNote(note)
    if (!region) {
      await notifyAdminsAboutUnroutedTicket({
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        ticketTitle: ticket.title,
        customerEmail,
        reason: raw ? `无效Region值：${raw}` : '客户未设置Region',
        requestId,
      })
      return
    }

    const targetGroupId = getGroupIdByRegion(region)
    if (targetGroupId === ticket.group_id) return

    try {
      await zammadClient.updateTicket(ticket.id, { group_id: targetGroupId })
      log.info('Routed email ticket to regional group', {
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        region,
        fromGroupId: ticket.group_id,
        toGroupId: targetGroupId,
      })
    } catch (error) {
      log.error('Failed to update ticket group in Zammad; skipping auto-assign', {
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        region,
        toGroupId: targetGroupId,
        error: error instanceof Error ? error.message : error,
      })
      return
    }

    const result = await autoAssignSingleTicket(
      ticket.id,
      ticket.number,
      ticket.title,
      targetGroupId,
      requestId
    )

    if (!result.success) {
      await handleAssignmentNotification(result, ticket.id, ticket.number, ticket.title, region, requestId)
    }
  } catch (error) {
    log.error('Email ticket routing failed (non-blocking)', { error: error instanceof Error ? error.message : error })
  }
}
