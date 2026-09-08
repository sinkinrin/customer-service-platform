import type { ZammadUser, ZammadTicket, ZammadWebhookPayload } from '@/lib/zammad/types'
import { STAGING_GROUP_ID, getGroupIdByRegion, isValidRegion, type RegionValue } from '@/lib/constants/regions'
import { ZAMMAD_ROLES } from '@/lib/constants/zammad'
import { zammadClient } from '@/lib/zammad/client'
import { EXCLUDED_EMAILS, handleAssignmentNotification } from '@/lib/ticket/auto-assign'
import { notifySystemAlert, resolveLocalUserIdsForZammadUserId } from '@/lib/notification'
import { createApiLogger } from '@/lib/utils/api-logger'
import { findCustomerServiceGroup } from '@/lib/service-groups/customer-assignment-service'
import { mapServiceBaseRegionToRegionValue } from '@/lib/service-groups/service-group-service'
import { getAgentDisplayName, isAgentEligible } from '@/lib/ticket/agent-helpers'
import { parseCcAddresses } from '@/lib/ticket/email-cc'
import { isServiceGroupAssignmentCutoverActive } from '@/lib/service-groups/cutover'

export const EMAIL_CC_AUTO_ASSIGN_ENABLED_ENV = 'EMAIL_CC_AUTO_ASSIGN_ENABLED'

function isEmailCcAutoAssignEnabled(): boolean {
  return process.env[EMAIL_CC_AUTO_ASSIGN_ENABLED_ENV] === 'true'
}

function isUnassignedStagingTicket(ticket: ZammadTicket): boolean {
  return ticket.group_id === STAGING_GROUP_ID &&
    (!ticket.owner_id || ticket.owner_id === 1) &&
    [1, 2].includes(ticket.state_id)
}

async function findCcOwner(cc: string | null, groupId: number): Promise<ZammadUser | undefined> {
  const matches = new Map<number, ZammadUser>()
  for (const email of parseCcAddresses(cc)) {
    let page = 1
    while (true) {
      const users = await zammadClient.searchUsersPaginated(email, 100, page)
      for (const user of users) {
        const isAgent = user.role_ids?.includes(ZAMMAD_ROLES.AGENT) || user.roles?.includes('Agent')
        if (user.email?.trim().toLowerCase() === email && isAgent &&
            isAgentEligible(user, groupId, EXCLUDED_EMAILS)) {
          matches.set(user.id, user)
        }
      }
      if (users.length < 100) break
      page++
    }
  }
  // Multiple eligible recipients are ambiguous; preserve service-group fallback.
  return matches.size === 1 ? [...matches.values()][0] : undefined
}

// Coalesce concurrent callbacks in this process; re-read Zammad for delayed retries.
type RoutingResult = { retryable: true } | void
const routingInFlight = new Map<number, Promise<RoutingResult>>()

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

async function routeEmailTicket(
  payload: ZammadWebhookPayload,
  requestId?: string
): Promise<RoutingResult> {
  const log = createApiLogger('EmailTicketRouting', requestId)

  try {
    if (isServiceGroupAssignmentCutoverActive()) return
    if (payload.ticket.group_id !== STAGING_GROUP_ID) return
    if (payload.article?.type !== 'email') return

    // Webhook snapshots can predate a manual assignment or a previous callback.
    const ticket = await zammadClient.getTicket(payload.ticket.id)
    if (!isUnassignedStagingTicket(ticket)) return

    // CC may be absent in a custom webhook. Read the actual first article from Zammad.
    // This also rejects follow-ups and system auto-replies misclassified by the 5s heuristic.
    const articles = await zammadClient.getArticlesByTicket(ticket.id)
    const firstArticle = [...articles].sort((a, b) => a.id - b.id)[0]
    if (!firstArticle) throw new Error('Original email article is not yet available')
    if (firstArticle.id !== payload.article.id ||
        firstArticle.ticket_id !== ticket.id || firstArticle.type !== 'email' ||
        firstArticle.sender !== 'Customer' || firstArticle.internal) return
    if (typeof ticket.customer_id !== 'number') {
      log.warning('Skipping email ticket routing: missing customer_id', { ticketId: ticket.id })
      return
    }

    const customerId = ticket.customer_id
    const customer = await zammadClient.getUser(customerId)
    const customerEmail = customer.email

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

    let assignedOwner: ZammadUser | undefined
    let assignmentSource = 'service_group'
    if (isEmailCcAutoAssignEnabled()) {
      try {
        assignedOwner = await findCcOwner(firstArticle.cc, targetGroupId)
        if (assignedOwner) assignmentSource = 'email_cc'
      } catch (error) {
        log.warning('CC lookup failed; using service-group owner', {
          ticketId: ticket.id,
          error: error instanceof Error ? error.message : error,
        })
      }
    }

    // Re-read the switch after CC lookup so disabling it during recipient resolution
    // restores the established service-group assignment.
    if (!isEmailCcAutoAssignEnabled()) {
      assignedOwner = undefined
      assignmentSource = 'service_group'
    }
    assignedOwner ??= await zammadClient.getUser(assignment.serviceGroup.staffZammadId)

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

    // Recheck after the lookups so a manual change during resolution takes precedence.
    const currentTicket = await zammadClient.getTicket(ticket.id)
    if (isServiceGroupAssignmentCutoverActive() ||
        (assignmentSource === 'email_cc' && !isEmailCcAutoAssignEnabled()) ||
        !isUnassignedStagingTicket(currentTicket) ||
        currentTicket.customer_id !== ticket.customer_id ||
        currentTicket.last_owner_update_at !== ticket.last_owner_update_at) return

    try {
      // One Zammad update avoids a regional-but-unassigned window for batch auto-assign.
      await zammadClient.updateTicket(ticket.id, {
        group_id: targetGroupId,
        owner_id: assignedOwner.id,
        state: 'open',
      })
      log.info('Routed and assigned email ticket', {
        ticketId: ticket.id,
        articleId: firstArticle.id,
        ownerId: assignedOwner.id,
        targetGroupId,
        assignmentSource,
      })
    } catch (error) {
      log.error('Failed to route and assign email ticket', {
        ticketId: ticket.id,
        ownerId: assignedOwner.id,
        error: error instanceof Error ? error.message : error,
      })
      // Do not blindly roll back: a timed-out request may have succeeded remotely.
      await notifyAdminsAboutUnroutedTicket({
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        ticketTitle: ticket.title,
        customerEmail,
        reason: '负责人分配失败，需管理员处理',
        requestId,
      })
      return { retryable: true }
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
    log.error('Email ticket routing failed; webhook must be retried', { error: error instanceof Error ? error.message : error })
    await notifyAdminsAboutUnroutedTicket({
      ticketId: payload.ticket.id,
      ticketNumber: payload.ticket.number,
      ticketTitle: payload.ticket.title,
      reason: '邮件路由依赖读取失败，等待 Webhook 重试；若持续失败请人工处理',
      requestId,
    })
    return { retryable: true }
  }
}

export async function handleEmailTicketRoutingFromWebhookPayload(
  payload: ZammadWebhookPayload,
  requestId?: string
): Promise<RoutingResult> {
  const ticketId = payload.ticket.id
  const pending = routingInFlight.get(ticketId)
  if (pending) {
    await pending
    // The concurrent callback may have been for a system reply; retry this event
    // against current state instead of dropping the actual first customer article.
    return handleEmailTicketRoutingFromWebhookPayload(payload, requestId)
  }
  const work = routeEmailTicket(payload, requestId)
  routingInFlight.set(ticketId, work)
  try {
    return await work
  } finally {
    routingInFlight.delete(ticketId)
  }
}
