/**
 * Staff Vacation API
 *
 * GET /api/staff/vacation - Get current user's vacation status
 * PUT /api/staff/vacation - Set vacation period
 * DELETE /api/staff/vacation - Cancel vacation
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import {
    successResponse,
    validationErrorResponse,
    serverErrorResponse,
    forbiddenResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { z } from 'zod'
import { mockUsers, type MockUser } from '@/lib/mock-auth'

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
 * Helper to find mock user by email
 */
function findMockUserByEmail(email: string): MockUser | undefined {
    return Object.values(mockUsers).find((u: MockUser) => u.email === email)
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

        // Get Zammad user ID from mock users
        const mockUser = findMockUserByEmail(user.email)
        if (!mockUser?.zammad_id) {
            return serverErrorResponse('User not linked to Zammad')
        }

        const vacationStatus = await zammadClient.getOutOfOffice(mockUser.zammad_id)

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
        console.error('[API] Get vacation status error:', error)
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

        // Get Zammad user ID
        const mockUser = findMockUserByEmail(user.email)
        if (!mockUser?.zammad_id) {
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
                    console.warn('[API] Warning: Replacement agent is also on vacation during this period')
                }
            }
        }

        await zammadClient.setOutOfOffice(mockUser.zammad_id, {
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
        console.error('[API] Set vacation error:', error)
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

        const mockUser = findMockUserByEmail(user.email)
        if (!mockUser?.zammad_id) {
            return serverErrorResponse('User not linked to Zammad')
        }

        await zammadClient.cancelOutOfOffice(mockUser.zammad_id)

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
        console.error('[API] Cancel vacation error:', error)
        return serverErrorResponse('Failed to cancel vacation')
    }
}

