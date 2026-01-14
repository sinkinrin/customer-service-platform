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

/**
 * Map state_id to state string for frontend compatibility
 * Zammad state_id mapping (from actual Zammad API /api/v1/ticket_states):
 * 1 = new, 2 = open, 3 = pending reminder, 4 = closed, 5 = merged, 6 = pending close
 */
function mapStateIdToString(stateId: number): string {
  switch (stateId) {
    case 1:
      return 'new'
    case 2:
      return 'open'
    case 3:
      return 'pending reminder'
    case 4:
      return 'closed'
    case 5:
      return 'merged'
    case 6:
      return 'pending close'
    default:
      return 'closed'
  }
}

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
                    console.warn(`[API] Could not get previous owner info for owner_id ${ticket.owner_id}:`, err)
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
            console.error(`[API] Failed to get user ${staff_id}:`, error)
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
                console.log(`[API] Auto-changing ticket ${ticketId} from Group ${ticketGroupId} to Group ${targetGroupIdForAutoChange} for staff ${staff_id}`)
                console.log(`[API] Staff ${staff_id} has access to groups: ${staffGroupIds.join(', ')}`)
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
                console.warn(`[API] Warning: Assigning ticket ${ticketId} to staff ${staff_id} who is on vacation`)
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
            console.log(`[API] Auto-updating ticket ${ticketId} state from 'new' (1) to 'open' (2) on assignment`)
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
            console.log(`[API] Moving ticket ${ticketId} to group "${group.name}" (ID: ${targetGroupIdForAutoChange}) to enable assignment`)
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
            console.error('[Ticket Assign] Failed to create in-app notifications:', notifyError)
        }

        // Get the staff member's display name
        const ownerName = [staffMember.firstname, staffMember.lastname]
            .filter(Boolean)
            .join(' ') || staffMember.login || staffMember.email

        // Send email notification to previous owner if ticket was reassigned
        if (previousOwner && previousOwner.id !== staff_id && previousOwner.email) {
            try {
                console.log(`[API] Sending reassignment notification to previous owner: ${previousOwner.email}`)
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
                
                console.log(`[API] Reassignment notification sent to ${previousOwner.email}`)
            } catch (emailError) {
                // Log error but don't fail the assignment
                console.error(`[API] Failed to send reassignment notification to ${previousOwner.email}:`, emailError)
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
        console.error('[API] Assign ticket error:', error)

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
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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
            console.error('[Ticket Assign] Failed to create unassigned notification:', notifyError)
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
        console.error('[API] Unassign ticket error:', error)
        return serverErrorResponse('Failed to unassign ticket')
    }
}
