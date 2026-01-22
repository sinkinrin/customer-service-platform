/**
 * Auto-Assign Unassigned Tickets API
 *
 * POST /api/tickets/auto-assign - Manually trigger auto-assignment for unassigned tickets
 * 
 * This endpoint can be:
 * 1. Called manually by admin to trigger immediate assignment
 * 2. Called by a cron job/scheduler for periodic assignment (e.g., hourly)
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import { getApiLogger } from '@/lib/utils/api-logger'
import {
    successResponse,
    serverErrorResponse,
    errorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { GROUP_REGION_MAPPING } from '@/lib/constants/regions'
import { ZAMMAD_ROLES } from '@/lib/constants/zammad'
import { notifySystemAlert, resolveLocalUserIdsForZammadUserId } from '@/lib/notification'

// Excluded system accounts that shouldn't receive ticket assignments
const EXCLUDED_EMAILS = ['support@howentech.com', 'howensupport@howentech.com']

interface AssignmentResult {
    ticketId: number
    ticketNumber: string
    assignedTo: {
        id: number
        name: string
        email: string
    } | null
    error?: string
}

/**
 * POST /api/tickets/auto-assign
 * Trigger auto-assignment for all unassigned tickets
 */
export async function POST(request: NextRequest) {
    const log = getApiLogger('TicketAutoAssignAPI', request)
    try {
        // Check for cron secret authentication first
        const cronSecret = request.headers.get('x-cron-secret')
        const expectedSecret = process.env.CRON_SECRET

        // If a cron secret is provided, validate it before anything else
        // This ensures wrong secrets get 403 even without a valid session
        if (cronSecret) {
            if (!expectedSecret || cronSecret !== expectedSecret) {
                log.warning('Auto-assign denied: invalid cron secret')
                return errorResponse('FORBIDDEN', 'Invalid cron secret', undefined, 403)
            }
            // Valid cron secret - proceed without session auth
        } else {
            // No cron secret provided - require admin role via session
            await requireRole(['admin'])
        }

        log.info('Auto-assign started', { mode: cronSecret ? 'cron' : 'session' })

        // Get all tickets
        const allTickets = await zammadClient.getAllTickets()

        // Filter for unassigned tickets
        // owner_id is null, 0, or 1 (Zammad default empty user)
        // Only process open/new tickets (state_id: 1=new, 2=open)
        const unassignedTickets = allTickets.filter(ticket =>
            (!ticket.owner_id || ticket.owner_id === 1) && [1, 2].includes(ticket.state_id)
        )

        if (unassignedTickets.length === 0) {
            log.info('No unassigned tickets found')
            return successResponse({
                message: 'No unassigned tickets found',
                processed: 0,
                success: 0,
                failed: 0,
                results: [],
            })
        }

        // Get all agents
        const allAgents = await zammadClient.getAgents(true)

        // Calculate current ticket count per agent
        // Exclude owner_id=1 (unassigned) from counting
        const ticketCountByAgent: Record<number, number> = {}
        for (const ticket of allTickets) {
            if (ticket.owner_id && ticket.owner_id !== 1 && [1, 2, 3, 7].includes(ticket.state_id)) {
                ticketCountByAgent[ticket.owner_id] = (ticketCountByAgent[ticket.owner_id] || 0) + 1
            }
        }

        const now = new Date()
        const results: AssignmentResult[] = []

        // Process each unassigned ticket
        for (const ticket of unassignedTickets) {
            const groupId = ticket.group_id

            // Filter available agents for this group
            const availableAgents = allAgents.filter(agent => {
                // Exclude system/dispatcher accounts
                if (EXCLUDED_EMAILS.some(email => agent.email?.toLowerCase() === email.toLowerCase())) {
                    return false
                }

                // Exclude Admin accounts from auto-assignment
                if (agent.role_ids?.includes(ZAMMAD_ROLES.ADMIN)) {
                    return false
                }

                // Check if agent has access to this group
                const agentGroupIds = agent.group_ids || {}
                const hasGroupAccess = Object.keys(agentGroupIds).includes(String(groupId))

                // Check if on vacation
                if (agent.out_of_office) {
                    const startDate = agent.out_of_office_start_at ? new Date(agent.out_of_office_start_at) : null
                    const endDate = agent.out_of_office_end_at ? new Date(agent.out_of_office_end_at) : null

                    // Handle different OOO scenarios:
                    // 1. Both dates set: check if currently within the range
                    // 2. Only start date: open-ended vacation, on vacation if past start date
                    // 3. Only end date: on vacation until end date
                    if (startDate && endDate) {
                        if (now >= startDate && now <= endDate) {
                            return false // On vacation (bounded period)
                        }
                    } else if (startDate && !endDate) {
                        if (now >= startDate) {
                            return false // On vacation (open-ended)
                        }
                    } else if (!startDate && endDate) {
                        if (now <= endDate) {
                            return false // On vacation until end date
                        }
                    }
                }

                return hasGroupAccess
            })

            if (availableAgents.length === 0) {
                const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
                results.push({
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    assignedTo: null,
                    error: `No available agents for group ${groupId} (region: ${region})`,
                })
                continue
            }

            // Sort by ticket count (ascending) and pick the one with lowest load
            availableAgents.sort((a, b) => {
                const loadA = ticketCountByAgent[a.id] || 0
                const loadB = ticketCountByAgent[b.id] || 0
                return loadA - loadB
            })

            const selectedAgent = availableAgents[0]

            try {
                // Assign ticket to this agent
                await zammadClient.updateTicket(ticket.id, { owner_id: selectedAgent.id })

                // Update local count for next assignment
                ticketCountByAgent[selectedAgent.id] = (ticketCountByAgent[selectedAgent.id] || 0) + 1

                const agentName = selectedAgent.firstname && selectedAgent.lastname
                    ? `${selectedAgent.firstname} ${selectedAgent.lastname}`.trim()
                    : selectedAgent.login || selectedAgent.email

                const agentNameForLog = selectedAgent.firstname && selectedAgent.lastname
                    ? `${selectedAgent.firstname} ${selectedAgent.lastname}`.trim()
                    : selectedAgent.login || `agent#${selectedAgent.id}`

                results.push({
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    assignedTo: {
                        id: selectedAgent.id,
                        name: agentName,
                        email: selectedAgent.email,
                    },
                })

                log.info('Ticket auto-assigned', {
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    groupId,
                    agentId: selectedAgent.id,
                    agentName: agentNameForLog,
                })
            } catch (error) {
                log.error('Failed to auto-assign ticket', {
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    groupId,
                    error: error instanceof Error ? error.message : error,
                })
                results.push({
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    assignedTo: null,
                    error: error instanceof Error ? error.message : 'Assignment failed',
                })
            }
        }

        const successCount = results.filter(r => r.assignedTo !== null).length
        const failCount = results.filter(r => r.assignedTo === null).length

        if (failCount > 0) {
            try {
                const adminAgents = allAgents.filter(agent =>
                    agent.role_ids?.includes(1) || agent.roles?.includes('Admin')
                )

                const sampleFailures = results
                    .filter(r => r.assignedTo === null)
                    .slice(0, 5)
                    .map(r => ({
                        ticketId: r.ticketId,
                        ticketNumber: r.ticketNumber,
                        error: r.error,
                    }))

                for (const adminAgent of adminAgents) {
                    const recipients = await resolveLocalUserIdsForZammadUserId(adminAgent.id)
                    for (const recipientUserId of recipients) {
                        await notifySystemAlert({
                            recipientUserId,
                            title: 'Auto-assignment failed',
                            body: `Auto-assignment completed with ${failCount} failures.`,
                            data: {
                                failed: failCount,
                                processed: unassignedTickets.length,
                                sampleFailures,
                            },
                        })
                    }
                }
            } catch (notifyError) {
                log.error('Failed to create system alert notifications', {
                    error: notifyError instanceof Error ? notifyError.message : notifyError,
                })
            }
        }

        return successResponse({
            message: `Auto-assignment completed: ${successCount} assigned, ${failCount} failed`,
            processed: unassignedTickets.length,
            success: successCount,
            failed: failCount,
            results,
        })
    } catch (error) {
        log.error('POST /api/tickets/auto-assign error', {
            error: error instanceof Error ? error.message : error,
        })
        return serverErrorResponse(error instanceof Error ? error.message : 'Auto-assignment failed')
    }
}

/**
 * GET /api/tickets/auto-assign
 * Get status of unassigned tickets (for monitoring)
 */
export async function GET(request: NextRequest) {
    const log = getApiLogger('TicketAutoAssignAPI', request)
    try {
        // Only admin can view this
        await requireRole(['admin'])

        // Get all tickets
        const allTickets = await zammadClient.getAllTickets()

        // Filter for unassigned tickets
        // owner_id is null, 0, or 1 (Zammad default empty user)
        const unassignedTickets = allTickets.filter(ticket =>
            (!ticket.owner_id || ticket.owner_id === 1) && [1, 2].includes(ticket.state_id)
        )

        // Group by group_id (region)
        const byGroup: Record<number, number> = {}
        for (const ticket of unassignedTickets) {
            byGroup[ticket.group_id] = (byGroup[ticket.group_id] || 0) + 1
        }

        // Map group_id to region names
        const byRegion: Record<string, number> = {}
        for (const [groupId, count] of Object.entries(byGroup)) {
            const region = GROUP_REGION_MAPPING[parseInt(groupId)] || `Group ${groupId}`
            byRegion[region] = count
        }

        log.info('Unassigned ticket status requested', { totalUnassigned: unassignedTickets.length })
        return successResponse({
            totalUnassigned: unassignedTickets.length,
            byRegion,
            tickets: unassignedTickets.map(t => ({
                id: t.id,
                number: t.number,
                title: t.title,
                group_id: t.group_id,
                created_at: t.created_at,
            })),
        })
    } catch (error) {
        log.error('GET /api/tickets/auto-assign error', {
            error: error instanceof Error ? error.message : error,
        })
        return serverErrorResponse(error instanceof Error ? error.message : 'Failed to get unassigned tickets')
    }
}
