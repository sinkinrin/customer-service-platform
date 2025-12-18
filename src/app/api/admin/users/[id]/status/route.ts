/**
 * User Status Management API
 * 
 * PATCH /api/admin/users/[id]/status - Activate or disable a user (Admin only)
 * 
 * Updates user status in Zammad via updateUser API
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    unauthorizedResponse,
    serverErrorResponse,
    validationErrorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { mockUsers } from '@/lib/mock-auth'
import { z } from 'zod'

const UpdateStatusSchema = z.object({
    active: z.boolean(),
})

interface RouteParams {
    params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        // Verify admin permission
        await requireRole(['admin'])

        const { id } = await params
        const userId = parseInt(id)

        if (isNaN(userId)) {
            return validationErrorResponse([{
                path: ['id'],
                message: 'Invalid user ID'
            }])
        }

        // Parse and validate request body
        const body = await request.json()
        const validation = UpdateStatusSchema.safeParse(body)

        if (!validation.success) {
            return validationErrorResponse(validation.error.errors)
        }

        const { active } = validation.data

        // Update user status in Zammad
        const updatedUser = await zammadClient.updateUser(userId, {
            active,
        })

        // Sync with mockUsers if user exists there (by email)
        const mockUser = Object.values(mockUsers).find(u =>
            (u as any).zammad_id === userId || u.email === updatedUser.email
        )
        if (mockUser) {
            // Update mock user's active status if we track it
            ; (mockUser as any).active = active
        }

        return successResponse({
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                full_name: `${updatedUser.firstname || ''} ${updatedUser.lastname || ''}`.trim(),
                active: updatedUser.active,
                updated_at: updatedUser.updated_at,
            },
            message: active ? 'User activated successfully' : 'User disabled successfully',
        })

    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return unauthorizedResponse()
        }
        console.error('[User Status API] Error:', error)
        return serverErrorResponse('Failed to update user status', error.message)
    }
}

// GET current status
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        await requireRole(['admin', 'staff'])

        const { id } = await params
        const userId = parseInt(id)

        if (isNaN(userId)) {
            return validationErrorResponse([{
                path: ['id'],
                message: 'Invalid user ID'
            }])
        }

        const user = await zammadClient.getUser(userId)

        return successResponse({
            id: user.id,
            email: user.email,
            active: user.active,
            verified: user.verified,
        })

    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return unauthorizedResponse()
        }
        console.error('[User Status API] Error:', error)
        return serverErrorResponse('Failed to get user status', error.message)
    }
}
