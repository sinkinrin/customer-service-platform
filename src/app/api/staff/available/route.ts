/**
 * Available Staff API
 *
 * GET /api/staff/available - Get list of available staff for ticket assignment
 * Returns staff members who are not on vacation, with their current ticket load
 */

import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    serverErrorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'

/**
 * GET /api/staff/available
 * Get available staff for ticket assignment
 */
export async function GET() {
    try {
        // Only admin and staff can view available staff
        await requireRole(['admin', 'staff'])

        // Get all agents
        const allAgents = await zammadClient.getAgents(true)

        // Get all open tickets to calculate load
        const allTickets = await zammadClient.getAllTickets()

        // Calculate ticket count per agent
        const ticketCountByAgent: Record<number, number> = {}
        for (const ticket of allTickets) {
            // Only count open/new tickets (state_id: 1=new, 2=open, 3=pending reminder, 6=pending close)
            if (ticket.owner_id && [1, 2, 3, 6].includes(ticket.state_id)) {
                ticketCountByAgent[ticket.owner_id] = (ticketCountByAgent[ticket.owner_id] || 0) + 1
            }
        }

        const now = new Date()

        // Build staff list with availability and load
        const staffList = allAgents.map(agent => {
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
                    isOnVacation = now >= startDate && now <= endDate
                } else if (startDate && !endDate) {
                    isOnVacation = now >= startDate
                }
            }

            return {
                id: agent.id,
                name: `${agent.firstname} ${agent.lastname}`.trim() || agent.login,
                email: agent.email,
                is_available: !isOnVacation,
                is_on_vacation: isOnVacation,
                vacation_end_date: isOnVacation ? agent.out_of_office_end_at : null,
                ticket_count: ticketCountByAgent[agent.id] || 0,
            }
        })

        // Sort: available first, then by ticket count (ascending)
        staffList.sort((a, b) => {
            if (a.is_available !== b.is_available) {
                return a.is_available ? -1 : 1
            }
            return a.ticket_count - b.ticket_count
        })

        return successResponse({
            staff: staffList,
            total: staffList.length,
            available_count: staffList.filter(s => s.is_available).length,
        })
    } catch (error) {
        console.error('[API] Get available staff error:', error)
        return serverErrorResponse('Failed to get available staff')
    }
}
