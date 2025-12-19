/**
 * Ticket Assignment API
 *
 * PUT /api/tickets/[id]/assign - Assign ticket to a staff member
 * DELETE /api/tickets/[id]/assign - Unassign ticket
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    validationErrorResponse,
    serverErrorResponse,
    notFoundResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { z } from 'zod'

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

        // Verify ticket exists
        let ticket
        try {
            ticket = await zammadClient.getTicket(ticketId)
        } catch {
            return notFoundResponse('Ticket not found')
        }

        // Verify staff member exists and is an agent
        let staffMember
        try {
            staffMember = await zammadClient.getUser(staff_id)
            // Check via role_ids (Agent role is typically ID 2) - consistent with zammadClient.getAgents()
            const isAgent = staffMember.role_ids?.includes(2) || staffMember.roles?.includes('Agent')
            if (!isAgent) {
                return validationErrorResponse('Selected user is not a staff member')
            }
        } catch {
            return notFoundResponse('Staff member not found')
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

        // Update ticket assignment and state
        // When assigning a ticket, also change state from 'new' to 'open'
        const updateData: { owner_id: number; state?: string; group?: string } = {
            owner_id: staff_id,
        }

        // Only change state to 'open' if ticket is currently 'new' (state_id = 1)
        if (ticket.state_id === 1) {
            updateData.state = 'open'
        }

        // If group_id is provided, also update the group (for email tickets without region)
        if (group_id) {
            const group = await zammadClient.getGroup(group_id)
            updateData.group = group.name
        }

        const updatedTicket = await zammadClient.updateTicket(ticketId, updateData)

        return successResponse({
            message: 'Ticket assigned successfully',
            ticket: {
                id: updatedTicket.id,
                number: updatedTicket.number,
                title: updatedTicket.title,
                owner_id: updatedTicket.owner_id,
                group_id: updatedTicket.group_id,
            },
            assigned_to: {
                id: staffMember.id,
                name: [staffMember.firstname, staffMember.lastname].filter(Boolean).join(' ') || staffMember.login || staffMember.email,
                email: staffMember.email,
            }
        })
    } catch (error) {
        console.error('[API] Assign ticket error:', error)
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

        // Verify ticket exists
        try {
            await zammadClient.getTicket(ticketId)
        } catch {
            return notFoundResponse('Ticket not found')
        }

        // Remove owner assignment (set to empty/unassigned)
        // In Zammad, setting owner_id to 1 typically means unassigned (system user)
        const updatedTicket = await zammadClient.updateTicket(ticketId, {
            owner_id: 1, // Zammad system user / unassigned
        })

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
