/**
 * Staff Vacation API
 *
 * GET /api/staff/vacation - Get current user's vacation status
 * PUT /api/staff/vacation - Set vacation period
 * DELETE /api/staff/vacation - Cancel vacation
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { logger } from '@/lib/utils/logger'
import {
    successResponse,
    validationErrorResponse,
    serverErrorResponse,
    forbiddenResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { z } from 'zod'

// Schema for setting vacation
const SetVacationSchema = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    replacement_id: z.number().optional().nullable(),
}).refine(
    (data) => new Date(data.start_date) <= new Date(data.end_date),
    { message: 'End date must be after or equal to start date', path: ['end_date'] }
)

/**
 * Helper to get Zammad user ID from session or by email lookup
 * @param user - AuthUser from session
 * @returns Zammad user ID or null if not found
 */
async function getZammadUserId(user: { email: string; zammad_id?: number }): Promise<number | null> {
    // First try to use zammad_id from session (stored in database)
    if (user.zammad_id) {
        return user.zammad_id
    }
    
    // Fallback: look up user by email in Zammad
    try {
        const zammadUser = await zammadClient.getUserByEmail(user.email)
        return zammadUser?.id || null
    } catch (error) {
        logger.error('StaffVacation', 'Failed to get Zammad user by email', { data: { error: error instanceof Error ? error.message : error } })
        return null
    }
}

/**
 * GET /api/staff/vacation
 * Get current user's vacation status
 */
export async function GET() {
    try {
        const user = await requireAuth()

        // Only staff and admin can access vacation settings
        if (user.role !== 'staff' && user.role !== 'admin') {
            return forbiddenResponse('Only staff members can access vacation settings')
        }

        // Get Zammad user ID from session or by email lookup
        const zammadUserId = await getZammadUserId(user)
        if (!zammadUserId) {
            return serverErrorResponse('User not linked to Zammad')
        }

        const vacationStatus = await zammadClient.getOutOfOffice(zammadUserId)

        return successResponse({
            vacation: {
                is_on_vacation: vacationStatus.out_of_office,
                start_date: vacationStatus.out_of_office_start_at,
                end_date: vacationStatus.out_of_office_end_at,
                replacement: vacationStatus.replacement_user ? {
                    id: vacationStatus.replacement_user.id,
                    name: `${vacationStatus.replacement_user.firstname} ${vacationStatus.replacement_user.lastname}`,
                    email: vacationStatus.replacement_user.email,
                } : null,
            }
        })
    } catch (error) {
        logger.error('StaffVacation', 'Get vacation status error', { data: { error: error instanceof Error ? error.message : error } })
        return serverErrorResponse('Failed to get vacation status')
    }
}

/**
 * PUT /api/staff/vacation
 * Set vacation period
 */
export async function PUT(request: NextRequest) {
    try {
        const user = await requireAuth()

        if (user.role !== 'staff' && user.role !== 'admin') {
            return forbiddenResponse('Only staff members can set vacation')
        }

        const body = await request.json()
        const validationResult = SetVacationSchema.safeParse(body)

        if (!validationResult.success) {
            return validationErrorResponse(validationResult.error.errors[0].message)
        }

        const { start_date, end_date, replacement_id } = validationResult.data

        // Get Zammad user ID from session or by email lookup
        const zammadUserId = await getZammadUserId(user)
        if (!zammadUserId) {
            return serverErrorResponse('User not linked to Zammad')
        }

        // If replacement is specified, check they're not also on vacation
        if (replacement_id) {
            const replacementStatus = await zammadClient.getOutOfOffice(replacement_id)
            if (replacementStatus.out_of_office) {
                const replacementEnd = replacementStatus.out_of_office_end_at
                const requestedStart = start_date
                // Warn if replacement is on vacation during the requested period
                if (replacementEnd && new Date(replacementEnd) >= new Date(requestedStart)) {
                    logger.warning('StaffVacation', 'Replacement agent is also on vacation during this period', { data: { replacement_id, replacementEnd, requestedStart } })
                }
            }
        }

        await zammadClient.setOutOfOffice(zammadUserId, {
            out_of_office: true,
            out_of_office_start_at: start_date,
            out_of_office_end_at: end_date,
            out_of_office_replacement_id: replacement_id || null,
        })

        return successResponse({
            message: 'Vacation set successfully',
            vacation: {
                is_on_vacation: true,
                start_date,
                end_date,
                replacement_id,
            }
        })
    } catch (error) {
        logger.error('StaffVacation', 'Set vacation error', { data: { error: error instanceof Error ? error.message : error } })
        return serverErrorResponse('Failed to set vacation')
    }
}

/**
 * DELETE /api/staff/vacation
 * Cancel vacation
 */
export async function DELETE() {
    try {
        const user = await requireAuth()

        if (user.role !== 'staff' && user.role !== 'admin') {
            return forbiddenResponse('Only staff members can cancel vacation')
        }

        // Get Zammad user ID from session or by email lookup
        const zammadUserId = await getZammadUserId(user)
        if (!zammadUserId) {
            return serverErrorResponse('User not linked to Zammad')
        }

        await zammadClient.cancelOutOfOffice(zammadUserId)

        return successResponse({
            message: 'Vacation cancelled successfully',
            vacation: {
                is_on_vacation: false,
                start_date: null,
                end_date: null,
                replacement_id: null,
            }
        })
    } catch (error) {
        logger.error('StaffVacation', 'Cancel vacation error', { data: { error: error instanceof Error ? error.message : error } })
        return serverErrorResponse('Failed to cancel vacation')
    }
}

