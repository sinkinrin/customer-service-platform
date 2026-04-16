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
    serviceUnavailableResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { GROUP_REGION_MAPPING, STAGING_GROUP_ID } from '@/lib/constants/regions'
import { notifySystemAlert, resolveLocalUserIdsForZammadUserId } from '@/lib/notification'
import { isAgentEligible, getAgentDisplayName } from '@/lib/ticket/agent-helpers'
import { EXCLUDED_EMAILS } from '@/lib/ticket/auto-assign'
import { isServiceGroupAssignmentCutoverActive } from '@/lib/service-groups/cutover'
import { findCustomerServiceGroup } from '@/lib/service-groups/customer-assignment-service'

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

        if (isServiceGroupAssignmentCutoverActive()) {
            log.warning('Auto-assign skipped: service-group cutover active')
            return serviceUnavailableResponse('Batch auto-assignment is disabled during service-group cutover')
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

        const results: AssignmentResult[] = []

        // Process each unassigned ticket
        for (const ticket of unassignedTickets) {
            const groupId = ticket.group_id

            if (groupId === STAGING_GROUP_ID) {
                results.push({
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    assignedTo: null,
                    error: 'Ticket is in staging and requires manual admin handling',
                })
                continue
            }

            if (!ticket.customer_id) {
                const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
                results.push({
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    assignedTo: null,
                    error: `No customer id on ticket for group ${groupId} (region: ${region})`,
                })
                continue
            }

            try {
                const assignment = await findCustomerServiceGroup(ticket.customer_id)
                if (!assignment) {
                    results.push({
                        ticketId: ticket.id,
                        ticketNumber: ticket.number,
                        assignedTo: null,
                        error: 'Customer has no service group assignment',
                    })
                    continue
                }

                const assignedOwner = allAgents.find((agent) => agent.id === assignment.serviceGroup.staffZammadId)
                if (!assignedOwner || !isAgentEligible(assignedOwner, groupId, EXCLUDED_EMAILS)) {
                    results.push({
                        ticketId: ticket.id,
                        ticketNumber: ticket.number,
                        assignedTo: null,
                        error: 'Assigned service group owner is unavailable',
                    })
                    continue
                }

                try {
                    await zammadClient.updateTicket(ticket.id, { owner_id: assignedOwner.id })
                    results.push({
                        ticketId: ticket.id,
                        ticketNumber: ticket.number,
                        assignedTo: {
                            id: assignedOwner.id,
                            name: getAgentDisplayName(assignedOwner),
                            email: assignedOwner.email,
                        },
                    })

                    log.info('Ticket auto-assigned to service-group owner', {
                        ticketId: ticket.id, ticketNumber: ticket.number,
                        groupId, agentId: assignedOwner.id,
                    })
                } catch (error) {
                    log.error('Failed to auto-assign ticket to service-group owner', {
                        ticketId: ticket.id, ticketNumber: ticket.number,
                        error: error instanceof Error ? error.message : error,
                    })
                    results.push({
                        ticketId: ticket.id,
                        ticketNumber: ticket.number,
                        assignedTo: null,
                        error: error instanceof Error ? error.message : 'Assignment failed',
                    })
                }
            } catch (error) {
                log.error('Failed to resolve service-group assignment during batch auto-assign', {
                    ticketId: ticket.id, ticketNumber: ticket.number,
                    error: error instanceof Error ? error.message : error,
                })
                results.push({
                    ticketId: ticket.id,
                    ticketNumber: ticket.number,
                    assignedTo: null,
                    error: error instanceof Error ? error.message : 'Service group lookup failed',
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
