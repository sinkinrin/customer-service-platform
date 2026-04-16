import type { ZammadWebhookPayload } from '@/lib/zammad/types'
import { STAGING_GROUP_ID, getGroupIdByRegion, isValidRegion, type RegionValue } from '@/lib/constants/regions'
import { ZAMMAD_ROLES } from '@/lib/constants/zammad'
import { zammadClient } from '@/lib/zammad/client'
import { EXCLUDED_EMAILS, handleAssignmentNotification } from '@/lib/ticket/auto-assign'
import { notifySystemAlert, resolveLocalUserIdsForZammadUserId } from '@/lib/notification'
import { createApiLogger } from '@/lib/utils/api-logger'
import { findCustomerServiceGroup } from '@/lib/service-groups/customer-assignment-service'
import { mapServiceBaseRegionToRegionValue } from '@/lib/service-groups/service-group-service'
import { getAgentDisplayName, isAgentEligible } from '@/lib/ticket/agent-helpers'

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

    try {
      const customer = await zammadClient.getUser(customerId)
      customerEmail = customer.email
    } catch (error) {
      log.error('Failed to fetch customer from Zammad; skipping routing', {
        ticketId: ticket.id,
        customerId,
        error: error instanceof Error ? error.message : error,
      })
      return
    }

    const assignment = await findCustomerServiceGroup(customerId)
    if (!assignment) {
      await notifyAdminsAboutUnroutedTicket({
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        ticketTitle: ticket.title,
        customerEmail,
        reason: '客户未分配服务分组',
        requestId,
      })
      return
    }

    const region = mapServiceBaseRegionToRegionValue(assignment.serviceGroup.baseRegion)
    const targetGroupId = getGroupIdByRegion(region)

    let assignedOwner
    try {
      assignedOwner = await zammadClient.getUser(assignment.serviceGroup.staffZammadId)
    } catch (error) {
      log.error('Failed to fetch assigned owner from Zammad; keeping ticket in staging', {
        ticketId: ticket.id,
        ownerId: assignment.serviceGroup.staffZammadId,
        error: error instanceof Error ? error.message : error,
      })
    }

    if (!assignedOwner || !isAgentEligible(assignedOwner, targetGroupId, EXCLUDED_EMAILS)) {
      await notifyAdminsAboutUnroutedTicket({
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        ticketTitle: ticket.title,
        customerEmail,
        reason: '负责人不可用',
        requestId,
      })
      return
    }

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

    try {
      await zammadClient.updateTicket(ticket.id, {
        owner_id: assignedOwner.id,
        state: 'open',
      })
    } catch (error) {
      log.error('Failed to assign owner after regional group move; attempting to revert to staging', {
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        ownerId: assignedOwner.id,
        error: error instanceof Error ? error.message : error,
      })

      try {
        await zammadClient.updateTicket(ticket.id, { group_id: STAGING_GROUP_ID })
      } catch (revertError) {
        log.error('Failed to revert ticket back to staging after owner assignment failure', {
          ticketId: ticket.id,
          ticketNumber: ticket.number,
          error: revertError instanceof Error ? revertError.message : revertError,
        })
      }

      await notifyAdminsAboutUnroutedTicket({
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        ticketTitle: ticket.title,
        customerEmail,
        reason: '负责人分配失败，需管理员处理',
        requestId,
      })
      return
    }

    try {
      await handleAssignmentNotification(
        {
          success: true,
          assignedTo: {
            id: assignedOwner.id,
            name: getAgentDisplayName(assignedOwner),
            email: assignedOwner.email,
          },
        },
        ticket.id,
        ticket.number,
        ticket.title,
        region,
        requestId
      )
    } catch (error) {
      log.error('Failed to notify assigned owner after email routing', {
        ticketId: ticket.id,
        ownerId: assignedOwner.id,
        error: error instanceof Error ? error.message : error,
      })
    }
  } catch (error) {
    log.error('Email ticket routing failed (non-blocking)', { error: error instanceof Error ? error.message : error })
  }
}
