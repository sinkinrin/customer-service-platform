/**
 * Auto-assign single ticket to available agent
 *
 * Extracted from /api/tickets/auto-assign for reuse in ticket creation flow
 */

import { zammadClient } from '@/lib/zammad/client'
import { GROUP_REGION_MAPPING } from '@/lib/constants/regions'
import { getActiveStateIds } from '@/lib/constants/zammad-states'
import {
  notifyTicketAssigned,
  notifySystemAlert,
  resolveLocalUserIdsForZammadUserId,
} from '@/lib/notification'

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
 * Auto-assign a single ticket to the available agent with lowest load in the ticket's region
 */
export async function autoAssignSingleTicket(
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  groupId: number
): Promise<SingleAssignResult> {
  try {
    // 1. Get all active agents
    const allAgents = await zammadClient.getAgents(true)

    // 2. Get all tickets for load calculation
    const allTickets = await zammadClient.getAllTickets()

    // 3. Calculate current ticket count per agent
    // Only count active tickets (defined in zammad-states.ts)
    const activeStateIds = getActiveStateIds()
    const ticketCountByAgent: Record<number, number> = {}
    for (const ticket of allTickets) {
      if (ticket.owner_id && ticket.owner_id !== 1 && activeStateIds.includes(ticket.state_id)) {
        ticketCountByAgent[ticket.owner_id] = (ticketCountByAgent[ticket.owner_id] || 0) + 1
      }
    }

    const now = new Date()

    // 4. Filter available agents
    const availableAgents = allAgents.filter(agent => {
      // Exclude system accounts
      if (EXCLUDED_EMAILS.some(email => agent.email?.toLowerCase() === email.toLowerCase())) {
        return false
      }

      // Exclude Admin role (role_id 1)
      if (agent.role_ids?.includes(1)) {
        return false
      }

      // Check if agent has access to this group
      const agentGroupIds = agent.group_ids || {}
      const hasGroupAccess = Object.keys(agentGroupIds).includes(String(groupId))
      if (!hasGroupAccess) {
        return false
      }

      // Check if on vacation
      if (agent.out_of_office) {
        const startDate = agent.out_of_office_start_at ? new Date(agent.out_of_office_start_at) : null
        const endDate = agent.out_of_office_end_at ? new Date(agent.out_of_office_end_at) : null

        if (startDate && endDate) {
          if (now >= startDate && now <= endDate) return false
        } else if (startDate && !endDate) {
          if (now >= startDate) return false
        } else if (!startDate && endDate) {
          if (now <= endDate) return false
        }
      }

      return true
    })

    // 5. No available agents
    if (availableAgents.length === 0) {
      const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
      return {
        success: false,
        error: `No available agents for region: ${region}`,
      }
    }

    // 6. Sort by load (ascending), pick the one with lowest load
    availableAgents.sort((a, b) => {
      const loadA = ticketCountByAgent[a.id] || 0
      const loadB = ticketCountByAgent[b.id] || 0
      return loadA - loadB
    })

    const selectedAgent = availableAgents[0]

    // 7. Assign ticket and update state to open
    await zammadClient.updateTicket(ticketId, {
      owner_id: selectedAgent.id,
      state: 'open', // new -> open
    })

    const agentName = selectedAgent.firstname && selectedAgent.lastname
      ? `${selectedAgent.firstname} ${selectedAgent.lastname}`.trim()
      : selectedAgent.login || selectedAgent.email

    return {
      success: true,
      assignedTo: {
        id: selectedAgent.id,
        name: agentName,
        email: selectedAgent.email,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Auto-assignment failed',
    }
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
  region: string
): Promise<void> {
  try {
    if (result.success && result.assignedTo) {
      // Assignment succeeded -> notify Staff
      const staffLocalIds = await resolveLocalUserIdsForZammadUserId(result.assignedTo.id)
      for (const recipientUserId of staffLocalIds) {
        await notifyTicketAssigned({
          recipientUserId,
          ticketId,
          ticketNumber,
          ticketTitle,
        })
      }
      console.log(`[Auto-Assign] Notified staff ${result.assignedTo.email} for ticket #${ticketNumber}`)
    } else {
      // Assignment failed -> notify all Admins
      // Get admin users from Zammad (users with role_id 1)
      const allUsers = await zammadClient.searchUsers('*')
      const adminUsers = allUsers.filter(user => user.role_ids?.includes(1) && user.active)

      let notifiedCount = 0
      for (const admin of adminUsers) {
        const adminLocalIds = await resolveLocalUserIdsForZammadUserId(admin.id)
        for (const recipientUserId of adminLocalIds) {
          await notifySystemAlert({
            recipientUserId,
            title: 'Auto-assignment failed',
            body: `Ticket #${ticketNumber} could not be assigned: ${result.error}`,
            data: {
              ticketId,
              ticketNumber,
              ticketTitle,
              region,
            },
          })
          notifiedCount++
        }
      }
      console.log(`[Auto-Assign] Notified ${notifiedCount} admins about failed assignment for ticket #${ticketNumber}`)
    }
  } catch (error) {
    console.error('[Auto-Assign] Failed to send notification:', error)
  }
}
