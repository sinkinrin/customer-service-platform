/**
 * Auto-assign single ticket to available agent
 *
 * Supports customer-staff binding: if a customer has a dedicated staff member,
 * the ticket is assigned to them first. Falls back to load-balancing if unavailable.
 */

import { zammadClient } from '@/lib/zammad/client'
import { GROUP_REGION_MAPPING } from '@/lib/constants/regions'
import { getActiveStateIds } from '@/lib/constants/zammad-states'
import { createApiLogger } from '@/lib/utils/api-logger'
import {
  notifyTicketAssigned,
  notifySystemAlert,
  resolveLocalUserIdsForZammadUserId,
} from '@/lib/notification'
import { checkIsOnVacation, getAgentDisplayName, isAgentEligible } from '@/lib/ticket/agent-helpers'
import { isServiceGroupAssignmentCutoverActive } from '@/lib/service-groups/cutover'
import { findCustomerServiceGroup } from '@/lib/service-groups/customer-assignment-service'

// Excluded system accounts that shouldn't receive ticket assignments
export const EXCLUDED_EMAILS = ['support@howentech.com', 'howensupport@howentech.com']

// Single ticket auto-assign result
export interface SingleAssignResult {
  success: boolean
  assignedTo?: {
    id: number
    name: string
    email: string
  }
  error?: string
}

/**
 * Auto-assign a single ticket.
 * If customerId is provided, uses ServiceGroup ownership truth and assigns only
 * the explicit service-group owner when available. Otherwise returns failure.
 */
export async function autoAssignSingleTicket(
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  groupId: number,
  requestId?: string,
  customerId?: number
): Promise<SingleAssignResult> {
  const log = createApiLogger('AutoAssign', requestId)

  try {
    log.info('Starting auto-assign', { ticketNumber, ticketId, groupId, title: ticketTitle })

    // 1. Get all active agents (hoisted — shared by binding-first and LB paths)
    const agentsRaw = await zammadClient.getAgents(true)
    const allAgents = Array.isArray(agentsRaw) ? agentsRaw : []
    log.debug('Fetched active agents from Zammad', { count: allAgents.length })

    if (customerId) {
      try {
        const assignment = await findCustomerServiceGroup(customerId)
        if (!assignment) {
          log.warning('Customer has no service-group assignment', { customerId, ticketNumber })
          return { success: false, error: 'Customer has no service group assignment' }
        }

        const assignedOwner = allAgents.find((agent) => agent.id === assignment.serviceGroup.staffZammadId)

        if (!assignedOwner) {
          log.warning('Assigned service-group owner not found among active agents', {
            customerId,
            ticketNumber,
            staffZammadId: assignment.serviceGroup.staffZammadId,
          })
          return { success: false, error: 'Assigned service group owner is unavailable' }
        }

        if (!isAgentEligible(assignedOwner, groupId, EXCLUDED_EMAILS)) {
          log.warning('Assigned service-group owner is not eligible for assignment', {
            customerId,
            ticketNumber,
            staffZammadId: assignment.serviceGroup.staffZammadId,
            outOfOffice: checkIsOnVacation(assignedOwner),
            active: assignedOwner.active,
          })
          return { success: false, error: 'Assigned service group owner is unavailable' }
        }

        await zammadClient.updateTicket(ticketId, { owner_id: assignedOwner.id, state: 'open' })
        const name = getAgentDisplayName(assignedOwner)
        log.info('Assigned to service-group owner', { ticketNumber, assignedTo: name, agentId: assignedOwner.id })
        return { success: true, assignedTo: { id: assignedOwner.id, name, email: assignedOwner.email } }
      } catch (assignmentError) {
        log.warning('Service-group lookup failed', {
          ticketNumber,
          customerId,
          error: assignmentError instanceof Error ? assignmentError.message : assignmentError,
        })
        return { success: false, error: assignmentError instanceof Error ? assignmentError.message : 'Service group lookup failed' }
      }
    }

    // 3. Calculate ticket load per agent using targeted search
    const activeStateIds = getActiveStateIds()
    const stateQuery = activeStateIds.map(id => `state_id:${id}`).join(' OR ')
    const groupQuery = `group_id:${groupId} AND (${stateQuery})`
    const groupTickets = await zammadClient.searchTicketsRawQuery(groupQuery, 500)
    const allTickets = groupTickets?.tickets ?? []
    log.debug('Fetched group tickets for load calculation', { groupId, count: allTickets.length })

    // 4. Calculate current ticket count per agent in this group
    const ticketCountByAgent: Record<number, number> = {}
    for (const ticket of allTickets) {
      if (ticket.owner_id && ticket.owner_id !== 1) {
        ticketCountByAgent[ticket.owner_id] = (ticketCountByAgent[ticket.owner_id] || 0) + 1
      }
    }
    log.debug('Calculated ticket load', { activeStateIds, ticketCountByAgent })

    // 5. Filter available agents using shared helper
    const availableAgents = allAgents.filter(agent => isAgentEligible(agent, groupId, EXCLUDED_EMAILS))

    log.debug('Agent filter summary', { total: allAgents.length, available: availableAgents.length })

    // 6. No available agents
    if (availableAgents.length === 0) {
      const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
      log.warning('No available agents for region', { region, ticketNumber })
      return { success: false, error: `No available agents for region: ${region}` }
    }

    // 7. Sort by load (ascending), pick the one with lowest load
    availableAgents.sort((a, b) => {
      const loadA = ticketCountByAgent[a.id] || 0
      const loadB = ticketCountByAgent[b.id] || 0
      return loadA - loadB
    })

    const selectedAgent = availableAgents[0]
    const selectedLoad = ticketCountByAgent[selectedAgent.id] || 0
    log.debug('Selected agent with lowest load', {
      email: selectedAgent.email, agentId: selectedAgent.id, load: selectedLoad,
    })

    // 8. Assign ticket and update state to open
    await zammadClient.updateTicket(ticketId, {
      owner_id: selectedAgent.id,
      state: 'open',
    })

    const agentName = getAgentDisplayName(selectedAgent)

    log.info('Auto-assign successful', { ticketNumber, assignedTo: agentName, agentId: selectedAgent.id })
    return {
      success: true,
      assignedTo: { id: selectedAgent.id, name: agentName, email: selectedAgent.email },
    }
  } catch (error) {
    log.error('Auto-assign failed', { ticketNumber, error: error instanceof Error ? error.message : error })
    return { success: false, error: error instanceof Error ? error.message : 'Auto-assignment failed' }
  }
}

/**
 * Handle notifications after auto-assignment attempt
 * - Success: notify the assigned Staff
 * - Failure: notify all Admins
 */
export async function handleAssignmentNotification(
  result: SingleAssignResult,
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  region: string,
  requestId?: string
): Promise<void> {
  const log = createApiLogger('AutoAssign', requestId)

  try {
    if (result.success && result.assignedTo) {
      const staffLocalIds = await resolveLocalUserIdsForZammadUserId(result.assignedTo.id)
      for (const recipientUserId of staffLocalIds) {
        await notifyTicketAssigned({ recipientUserId, ticketId, ticketNumber, ticketTitle })
      }
      log.info('Notified staff for ticket assignment', { staffEmail: result.assignedTo.email, ticketNumber })
    } else {
      const allUsers = await zammadClient.searchUsersPaginated('*', 100, 1)
      const adminUsers = allUsers.filter(user => user.role_ids?.includes(1) && user.active)

      let notifiedCount = 0
      for (const admin of adminUsers) {
        const adminLocalIds = await resolveLocalUserIdsForZammadUserId(admin.id)
        for (const recipientUserId of adminLocalIds) {
          await notifySystemAlert({
            recipientUserId,
            title: 'Auto-assignment failed',
            body: `Ticket #${ticketNumber} could not be assigned: ${result.error}`,
            data: { ticketId, ticketNumber, ticketTitle, region },
          })
          notifiedCount++
        }
      }
      log.info('Notified admins about failed assignment', { ticketNumber, notifiedCount })
    }
  } catch (error) {
    log.error('Failed to send notification', { error: error instanceof Error ? error.message : error })
  }
}
