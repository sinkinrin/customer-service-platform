/**
 * Ticket Assignment API
 *
 * PUT /api/tickets/[id]/assign - Assign ticket to a staff member
 * DELETE /api/tickets/[id]/assign - Unassign ticket
 */

import { NextRequest } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    validationErrorResponse,
    serverErrorResponse,
    notFoundResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { z } from 'zod'
import { defaultLocale } from '@/i18n'
import {
    notifyTicketAssigned,
    notifyTicketUnassigned,
    resolveLocalUserIdsForZammadUserId,
} from '@/lib/notification'
import { mapStateIdToString } from '@/lib/constants/zammad-states'
import { getApiLogger } from '@/lib/utils/api-logger'


// mapStateIdToString is now imported from @/lib/constants/zammad-states


// Schema for assignment
const AssignTicketSchema = z.object({
    staff_id: z.number().int().positive('Staff ID must be a positive integer'),
    group_id: z.number().int().positive().optional(), // Optional: also change the group/region
})

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * PUT /api/tickets/[id]/assign
 * Assign ticket to a staff member
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const log = getApiLogger('TicketAssignAPI', request)

    try {
        // Only admin can assign tickets
        await requireRole(['admin'])

        const { id } = await params
        const ticketId = parseInt(id, 10)

        if (isNaN(ticketId)) {
            return validationErrorResponse('Invalid ticket ID')
        }

        const body = await request.json()
        const validationResult = AssignTicketSchema.safeParse(body)

        if (!validationResult.success) {
            return validationErrorResponse(validationResult.error.errors[0].message)
        }

        const { staff_id, group_id } = validationResult.data

        // Verify ticket exists and get previous owner info
        let ticket
        let previousOwner: { id: number; email: string; name: string } | null = null
        try {
            ticket = await zammadClient.getTicket(ticketId)

            // Check if ticket has an existing owner (owner_id > 1 means assigned, 1 is system/unassigned)
            if (ticket.owner_id && ticket.owner_id > 1) {
                try {
                    const prevOwnerData = await zammadClient.getUser(ticket.owner_id)
                    previousOwner = {
                        id: prevOwnerData.id,
                        email: prevOwnerData.email,
                        name: [prevOwnerData.firstname, prevOwnerData.lastname].filter(Boolean).join(' ') || prevOwnerData.login || prevOwnerData.email,
                    }
                } catch (err) {
                    log.warning('Could not get previous owner info', {
                        owner_id: ticket.owner_id,
                        error: err instanceof Error ? err.message : err,
                    })
                }
            }
        } catch {
            return notFoundResponse('Ticket not found')
        }

        // Verify staff member exists and is an agent
        let staffMember
        try {
            staffMember = await zammadClient.getUser(staff_id)

            // Check if user is active
            if (!staffMember.active) {
                return validationErrorResponse(`User ${staff_id} (${staffMember.email}) is inactive and cannot be assigned tickets`)
            }

            // Check via role_ids (Agent role is typically ID 2) - consistent with zammadClient.getAgents()
            const isAgent = staffMember.role_ids?.includes(2) || staffMember.roles?.includes('Agent')
            if (!isAgent) {
                const roles = staffMember.role_ids?.map((id: number) => {
                    if (id === 1) return 'Admin'
                    if (id === 2) return 'Agent'
                    if (id === 3) return 'Customer'
                    return `Role${id}`
                }).join(', ') || 'No roles'
                return validationErrorResponse(`User ${staff_id} (${staffMember.email}) is not an agent. Current roles: ${roles}`)
            }
        } catch (error) {
            log.error('Failed to get user', {
                staff_id,
                error: error instanceof Error ? error.message : error,
            })
            if (error instanceof Error && error.message.includes('No such object')) {
                return notFoundResponse(`Staff member with ID ${staff_id} does not exist in Zammad`)
            }
            return notFoundResponse('Staff member not found')
        }

        // Check if staff has permission for the ticket's group
        // Zammad requires agents to have group permission before assignment
        const ticketGroupId = ticket.group_id
        const staffGroupIds = staffMember.group_ids ? Object.keys(staffMember.group_ids).map(Number).sort((a, b) => a - b) : []
        const hasGroupPermission = staffGroupIds.includes(ticketGroupId)

        // If staff doesn't have permission for ticket's group, we need to change the ticket's group
        // This allows admin to assign cross-region tickets
        let targetGroupIdForAutoChange: number | null = null
        if (!hasGroupPermission && !group_id) {
            // Check if staff is admin (admins have access to all groups)
            const isStaffAdmin = staffMember.role_ids?.includes(1) || staffMember.roles?.includes('Admin')

            if (!isStaffAdmin) {
                // Staff is not admin and doesn't have permission for this group
                // Auto-change ticket to staff's first available group (sorted by ID for predictability)
                if (staffGroupIds.length === 0) {
                    return validationErrorResponse(
                        `User ${staff_id} (${staffMember.email}) has no group permissions and cannot be assigned tickets. ` +
                        `Please configure group permissions for this user in Zammad.`
                    )
                }

                // Use staff's smallest group_id (most predictable choice)
                targetGroupIdForAutoChange = staffGroupIds[0]
                log.info('Auto-changing ticket group for staff assignment', {
                    ticketId,
                    fromGroupId: ticketGroupId,
                    toGroupId: targetGroupIdForAutoChange,
                    staff_id,
                })
                log.info('Staff group access', {
                    staff_id,
                    groupIds: staffGroupIds,
                })
            }
        }

        // Check if staff is on vacation
        if (staffMember.out_of_office) {
            const now = new Date()
            const startDate = staffMember.out_of_office_start_at
                ? new Date(staffMember.out_of_office_start_at)
                : null
            const endDate = staffMember.out_of_office_end_at
                ? new Date(staffMember.out_of_office_end_at)
                : null

            const isCurrentlyOnVacation = startDate && endDate
                ? (now >= startDate && now <= endDate)
                : (startDate ? now >= startDate : false)

            if (isCurrentlyOnVacation) {
                log.warning('Assigning ticket to staff who is on vacation', {
                    ticketId,
                    staff_id,
                })
            }
        }

        // Update ticket assignment
        const updateData: { owner_id: number; group?: string; state_id?: number } = {
            owner_id: staff_id,
        }

        // Auto-update state from 'new' to 'open' when assigning
        // This follows Zammad workflow: new tickets become open when assigned to staff
        if (ticket.state_id === 1) {
            updateData.state_id = 2 // new -> open
            log.info('Auto-updating ticket state from new to open on assignment', {
                ticketId,
                fromStateId: 1,
                toStateId: 2,
            })
        }

        // If group_id is explicitly provided, use it
        if (group_id) {
            const group = await zammadClient.getGroup(group_id)
            updateData.group = group.name
        }
        // If auto-changing group (staff doesn't have permission for current group), use target group
        else if (targetGroupIdForAutoChange !== null) {
            const group = await zammadClient.getGroup(targetGroupIdForAutoChange)
            updateData.group = group.name
            log.info('Moving ticket to group to enable assignment', {
                ticketId,
                groupName: group.name,
                groupId: targetGroupIdForAutoChange,
            })
        }

        const updatedTicket = await zammadClient.updateTicket(ticketId, updateData)

        try {
            const newOwnerRecipients = await resolveLocalUserIdsForZammadUserId(staff_id)
            for (const recipientUserId of newOwnerRecipients) {
                await notifyTicketAssigned({
                    recipientUserId,
                    ticketId,
                    ticketNumber: updatedTicket.number,
                    ticketTitle: updatedTicket.title,
                })
            }

            if (previousOwner && previousOwner.id !== staff_id) {
                const prevOwnerRecipients = await resolveLocalUserIdsForZammadUserId(previousOwner.id)
                for (const recipientUserId of prevOwnerRecipients) {
                    await notifyTicketUnassigned({
                        recipientUserId,
                        ticketId,
                        ticketNumber: updatedTicket.number,
                        ticketTitle: updatedTicket.title,
                    })
                }
            }
        } catch (notifyError) {
            log.error('Failed to create in-app notifications', {
                error: notifyError instanceof Error ? notifyError.message : notifyError,
            })
        }

        // Get the staff member's display name
        const ownerName = [staffMember.firstname, staffMember.lastname]
            .filter(Boolean)
            .join(' ') || staffMember.login || staffMember.email

        // Send email notification to previous owner if ticket was reassigned
        if (previousOwner && previousOwner.id !== staff_id && previousOwner.email) {
            try {
                log.info('Sending reassignment notification to previous owner', {
                    email: previousOwner.email,
                })
                const tEmail = await getTranslations({ locale: defaultLocale, namespace: 'emails.ticketAssign' })
                const emailBody = `
<p>${tEmail('greeting', { name: previousOwner.name })}</p>

<p>${tEmail('bodyIntro', { number: updatedTicket.number, title: updatedTicket.title })}</p>

<p><strong>${tEmail('newAssigneeLabel')}</strong> ${ownerName}</p>

<p>${tEmail('noLongerHandle')}</p>

<p>${tEmail('closing')}<br>
${tEmail('signature')}</p>
                `.trim()

                // Create an internal email article to notify the previous owner
                // internal: true ensures this notification is not visible to customers
                await zammadClient.createArticle({
                    ticket_id: ticketId,
                    subject: tEmail('subject', { number: updatedTicket.number }),
                    body: emailBody,
                    content_type: 'text/html',
                    type: 'email',
                    internal: true,  // Hide from customer view, but still send email
                    sender: 'Agent',
                    to: previousOwner.email,
                })

                log.info('Reassignment notification sent', {
                    email: previousOwner.email,
                })
            } catch (emailError) {
                // Log error but don't fail the assignment
                log.error('Failed to send reassignment notification', {
                    email: previousOwner.email,
                    error: emailError instanceof Error ? emailError.message : emailError,
                })
            }
        }

        return successResponse({
            message: 'Ticket assigned successfully',
            ticket: {
                id: updatedTicket.id,
                number: updatedTicket.number,
                title: updatedTicket.title,
                owner_id: updatedTicket.owner_id,
                owner_name: ownerName,                         // Include owner display name
                group_id: updatedTicket.group_id,
                state_id: updatedTicket.state_id,              // Include updated state_id
                state: mapStateIdToString(updatedTicket.state_id), // Map state_id to state name
            },
            assigned_to: {
                id: staffMember.id,
                name: ownerName,
                email: staffMember.email,
            }
        })
    } catch (error) {
        log.error('Assign ticket error', {
            error: error instanceof Error ? error.message : error,
        })

        // Check for Zammad permission errors
        if (error instanceof Error) {
            if (error.message.includes('Invalid value') && error.message.includes('owner_id')) {
                return validationErrorResponse(
                    'Unable to assign ticket: The staff member does not have permission to access this ticket\'s group. ' +
                    'This usually means the agent needs to be added to the appropriate group in Zammad, ' +
                    'or the ticket needs to be moved to a group the agent has access to.'
                )
            }
        }

        return serverErrorResponse('Failed to assign ticket')
    }
}

/**
 * DELETE /api/tickets/[id]/assign
 * Unassign ticket (remove owner)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const log = getApiLogger('TicketAssignAPI', request)

    try {
        await requireRole(['admin'])

        const { id } = await params
        const ticketId = parseInt(id, 10)

        if (isNaN(ticketId)) {
            return validationErrorResponse('Invalid ticket ID')
        }

        // Verify ticket exists and capture previous owner (if any)
        let previousOwnerId: number | null = null
        try {
            const ticket = await zammadClient.getTicket(ticketId)
            if (ticket.owner_id && ticket.owner_id > 1) {
                previousOwnerId = ticket.owner_id
            }
        } catch {
            return notFoundResponse('Ticket not found')
        }

        // Remove owner assignment (set to empty/unassigned)
        // In Zammad, setting owner_id to 1 typically means unassigned (system user)
        const updatedTicket = await zammadClient.updateTicket(ticketId, {
            owner_id: 1, // Zammad system user / unassigned
        })

        try {
            if (previousOwnerId) {
                const recipients = await resolveLocalUserIdsForZammadUserId(previousOwnerId)
                for (const recipientUserId of recipients) {
                    await notifyTicketUnassigned({
                        recipientUserId,
                        ticketId,
                        ticketNumber: updatedTicket.number,
                        ticketTitle: updatedTicket.title,
                    })
                }
            }
        } catch (notifyError) {
            log.error('Failed to create unassigned notification', {
                error: notifyError instanceof Error ? notifyError.message : notifyError,
            })
        }

        return successResponse({
            message: 'Ticket unassigned successfully',
            ticket: {
                id: updatedTicket.id,
                number: updatedTicket.number,
                title: updatedTicket.title,
                owner_id: updatedTicket.owner_id,
            }
        })
    } catch (error) {
        log.error('Unassign ticket error', {
            error: error instanceof Error ? error.message : error,
        })
        return serverErrorResponse('Failed to unassign ticket')
    }
}
