/**
 * Available Staff API
 *
 * GET /api/staff/available - Get list of available staff for ticket assignment
 * Returns staff members who are not on vacation, with their current ticket load
 *
 * Security: Staff can only see agents in their own region(s), Admin can see all
 * Performance: Implements 30-second cache to improve loading speed
 */

import { requireRole, getCurrentUser } from '@/lib/utils/auth'
import { logger } from '@/lib/utils/logger'
import {
    successResponse,
    serverErrorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'

// Simple in-memory cache (30 seconds TTL)
let staffCache: {
    data: any | null
    timestamp: number
    expiresIn: number // milliseconds
} = {
    data: null,
    timestamp: 0,
    expiresIn: 30000 // 30 seconds
}

/**
 * GET /api/staff/available
 * Get available staff for ticket assignment
 */
export async function GET() {
    try {
        // Get current user to check role and region
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return serverErrorResponse('Authentication required')
        }

        // Only admin and staff can view available staff
        await requireRole(['admin', 'staff'])

        // Check cache first
        const now = Date.now()
        const cacheAge = now - staffCache.timestamp
        const isCacheValid = staffCache.data && cacheAge < staffCache.expiresIn

        let allAgents, allTickets

        if (isCacheValid) {
            allAgents = staffCache.data.agents
            allTickets = staffCache.data.tickets
        } else {
            // Fetch agents and tickets in parallel for better performance
            const [agentsResult, ticketsResult] = await Promise.all([
                zammadClient.getAgents(true),
                zammadClient.getAllTickets()
            ])

            allAgents = agentsResult
            allTickets = ticketsResult

            // Update cache
            staffCache = {
                data: { agents: allAgents, tickets: allTickets },
                timestamp: now,
                expiresIn: 30000
            }
        }

        // Filter agents by region for staff users
        let filteredAgents = allAgents
        if (currentUser.role === 'staff') {
            // Staff can only see agents in their accessible groups
            // Use zammad_id from session, or fall back to email lookup
            let currentUserDetails
            if (currentUser.zammad_id) {
                currentUserDetails = await zammadClient.getUser(currentUser.zammad_id)
            } else {
                // Fallback: look up by email
                currentUserDetails = await zammadClient.getUserByEmail(currentUser.email)
                if (!currentUserDetails) {
                    logger.warning('StaffAvailable', 'Could not find Zammad user for staff', { data: { email: currentUser.email } })
                    return serverErrorResponse('User not linked to Zammad')
                }
            }
            const accessibleGroupIds = currentUserDetails.group_ids
                ? Object.keys(currentUserDetails.group_ids).map(Number)
                : []

            filteredAgents = allAgents.filter((agent: any) => {
                const agentGroupIds = agent.group_ids
                    ? Object.keys(agent.group_ids).map(Number)
                    : []

                // Check if there's any overlap in group access
                return agentGroupIds.some((gid: number) => accessibleGroupIds.includes(gid))
            })
        }
        // Admin can see all agents (no filtering)

        // Calculate ticket count per agent
        const ticketCountByAgent: Record<number, number> = {}
        for (const ticket of allTickets) {
            // Only count active tickets (state_id: 1=new, 2=open, 3=pending reminder, 7=pending close)
            if (ticket.owner_id && [1, 2, 3, 7].includes(ticket.state_id)) {
                ticketCountByAgent[ticket.owner_id] = (ticketCountByAgent[ticket.owner_id] || 0) + 1
            }
        }

        const now2 = new Date()

        // Build staff list with availability and load
        const staffList = filteredAgents.map((agent: any) => {
            // Determine if currently on vacation
            let isOnVacation = false
            if (agent.out_of_office) {
                const startDate = agent.out_of_office_start_at
                    ? new Date(agent.out_of_office_start_at)
                    : null
                const endDate = agent.out_of_office_end_at
                    ? new Date(agent.out_of_office_end_at)
                    : null

                // Check if vacation is current
                if (startDate && endDate) {
                    isOnVacation = now2 >= startDate && now2 <= endDate
                } else if (startDate && !endDate) {
                    isOnVacation = now2 >= startDate
                }
            }

            return {
                id: agent.id,
                name: [agent.firstname, agent.lastname].filter(Boolean).join(' ') || agent.login || agent.email,
                // Only show email to admin users for privacy
                email: currentUser.role === 'admin' ? agent.email : undefined,
                is_available: !isOnVacation,
                is_on_vacation: isOnVacation,
                vacation_end_date: isOnVacation ? agent.out_of_office_end_at : null,
                ticket_count: ticketCountByAgent[agent.id] || 0,
            }
        })

        // Sort: available first, then by ticket count (ascending)
        staffList.sort((a: any, b: any) => {
            if (a.is_available !== b.is_available) {
                return a.is_available ? -1 : 1
            }
            return a.ticket_count - b.ticket_count
        })

        return successResponse({
            staff: staffList,
            total: staffList.length,
            available_count: staffList.filter((s: any) => s.is_available).length,
        })
    } catch (error) {
        logger.error('StaffAvailable', 'Get available staff error', { data: { error: error instanceof Error ? error.message : error } })
        return serverErrorResponse('Failed to get available staff')
    }
}
