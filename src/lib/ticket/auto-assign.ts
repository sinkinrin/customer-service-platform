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
  const DEBUG_PREFIX = '[Auto-Assign DEBUG]'

  try {
    console.log(`${DEBUG_PREFIX} === Starting auto-assign for ticket #${ticketNumber} ===`)
    console.log(`${DEBUG_PREFIX} Input: ticketId=${ticketId}, groupId=${groupId}, title="${ticketTitle}"`)

    // 1. Get all active agents
    const allAgents = await zammadClient.getAgents(true)
    console.log(`${DEBUG_PREFIX} Step 1: Fetched ${allAgents.length} active agents from Zammad`)

    // 2. Get all tickets for load calculation
    const allTickets = await zammadClient.getAllTickets()
    console.log(`${DEBUG_PREFIX} Step 2: Fetched ${allTickets.length} total tickets from Zammad`)

    // 3. Calculate current ticket count per agent
    // Only count active tickets (defined in zammad-states.ts)
    const activeStateIds = getActiveStateIds()
    const ticketCountByAgent: Record<number, number> = {}
    for (const ticket of allTickets) {
      if (ticket.owner_id && ticket.owner_id !== 1 && activeStateIds.includes(ticket.state_id)) {
        ticketCountByAgent[ticket.owner_id] = (ticketCountByAgent[ticket.owner_id] || 0) + 1
      }
    }
    console.log(`${DEBUG_PREFIX} Step 3: Active state IDs: [${activeStateIds.join(', ')}]`)
    console.log(`${DEBUG_PREFIX} Step 3: Ticket load by agent: ${JSON.stringify(ticketCountByAgent)}`)

    const now = new Date()
    console.log(`${DEBUG_PREFIX} Current time: ${now.toISOString()}`)

    // 4. Filter available agents with detailed logging
    const filterStats = {
      total: allAgents.length,
      excludedByEmail: 0,
      excludedByAdminRole: 0,
      excludedByNoGroupAccess: 0,
      excludedByVacation: 0,
    }

    const availableAgents = allAgents.filter(agent => {
      // Exclude system accounts
      if (EXCLUDED_EMAILS.some(email => agent.email?.toLowerCase() === email.toLowerCase())) {
        filterStats.excludedByEmail++
        console.log(`${DEBUG_PREFIX}   - Excluded agent ${agent.email}: system account`)
        return false
      }

      // Exclude Admin role (role_id 1)
      if (agent.role_ids?.includes(1)) {
        filterStats.excludedByAdminRole++
        console.log(`${DEBUG_PREFIX}   - Excluded agent ${agent.email}: Admin role (role_ids: ${JSON.stringify(agent.role_ids)})`)
        return false
      }

      // Check if agent has access to this group
      const agentGroupIds = agent.group_ids || {}
      const hasGroupAccess = Object.keys(agentGroupIds).includes(String(groupId))
      if (!hasGroupAccess) {
        filterStats.excludedByNoGroupAccess++
        console.log(`${DEBUG_PREFIX}   - Excluded agent ${agent.email}: no access to group ${groupId} (agent groups: ${JSON.stringify(Object.keys(agentGroupIds))})`)
        return false
      }

      // Check if on vacation
      if (agent.out_of_office) {
        const startDate = agent.out_of_office_start_at ? new Date(agent.out_of_office_start_at) : null
        const endDate = agent.out_of_office_end_at ? new Date(agent.out_of_office_end_at) : null

        console.log(`${DEBUG_PREFIX}   - Agent ${agent.email} out_of_office=true, start=${startDate?.toISOString()}, end=${endDate?.toISOString()}`)

        if (startDate && endDate) {
          if (now >= startDate && now <= endDate) {
            filterStats.excludedByVacation++
            console.log(`${DEBUG_PREFIX}   - Excluded agent ${agent.email}: currently on vacation`)
            return false
          }
        } else if (startDate && !endDate) {
          if (now >= startDate) {
            filterStats.excludedByVacation++
            console.log(`${DEBUG_PREFIX}   - Excluded agent ${agent.email}: on vacation (no end date)`)
            return false
          }
        } else if (!startDate && endDate) {
          if (now <= endDate) {
            filterStats.excludedByVacation++
            console.log(`${DEBUG_PREFIX}   - Excluded agent ${agent.email}: on vacation (no start date)`)
            return false
          }
        }
      }

      console.log(`${DEBUG_PREFIX}   + Agent ${agent.email} is AVAILABLE (load: ${ticketCountByAgent[agent.id] || 0})`)
      return true
    })

    console.log(`${DEBUG_PREFIX} Step 4 Filter Summary:`)
    console.log(`${DEBUG_PREFIX}   - Total agents: ${filterStats.total}`)
    console.log(`${DEBUG_PREFIX}   - Excluded by system email: ${filterStats.excludedByEmail}`)
    console.log(`${DEBUG_PREFIX}   - Excluded by Admin role: ${filterStats.excludedByAdminRole}`)
    console.log(`${DEBUG_PREFIX}   - Excluded by no group access: ${filterStats.excludedByNoGroupAccess}`)
    console.log(`${DEBUG_PREFIX}   - Excluded by vacation: ${filterStats.excludedByVacation}`)
    console.log(`${DEBUG_PREFIX}   - Available agents: ${availableAgents.length}`)

    // 5. No available agents
    if (availableAgents.length === 0) {
      const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
      console.log(`${DEBUG_PREFIX} Step 5: NO AVAILABLE AGENTS for region: ${region}`)
      console.log(`${DEBUG_PREFIX} === Auto-assign FAILED for ticket #${ticketNumber} ===`)
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

    console.log(`${DEBUG_PREFIX} Step 6: Available agents sorted by load:`)
    availableAgents.forEach((agent, index) => {
      const load = ticketCountByAgent[agent.id] || 0
      console.log(`${DEBUG_PREFIX}   ${index + 1}. ${agent.email} (id=${agent.id}, load=${load})`)
    })

    const selectedAgent = availableAgents[0]
    console.log(`${DEBUG_PREFIX} Step 6: Selected agent: ${selectedAgent.email} (id=${selectedAgent.id})`)

    // 7. Assign ticket and update state to open
    console.log(`${DEBUG_PREFIX} Step 7: Calling zammadClient.updateTicket(${ticketId}, { owner_id: ${selectedAgent.id}, state: 'open' })`)
    await zammadClient.updateTicket(ticketId, {
      owner_id: selectedAgent.id,
      state: 'open', // new -> open
    })
    console.log(`${DEBUG_PREFIX} Step 7: Ticket update successful`)

    const agentName = selectedAgent.firstname && selectedAgent.lastname
      ? `${selectedAgent.firstname} ${selectedAgent.lastname}`.trim()
      : selectedAgent.login || selectedAgent.email

    console.log(`${DEBUG_PREFIX} === Auto-assign SUCCESS for ticket #${ticketNumber} -> ${agentName} ===`)
    return {
      success: true,
      assignedTo: {
        id: selectedAgent.id,
        name: agentName,
        email: selectedAgent.email,
      },
    }
  } catch (error) {
    console.error(`${DEBUG_PREFIX} === Auto-assign ERROR for ticket #${ticketNumber} ===`)
    console.error(`${DEBUG_PREFIX} Error:`, error)
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
