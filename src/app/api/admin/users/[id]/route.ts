/**
 * Admin User Detail API
 *
 * GET /api/admin/users/[id] - Get user details
 * PUT /api/admin/users/[id] - Update user (role, status)
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { mockUsers } from '@/lib/mock-auth'
import { z } from 'zod'

const UpdateUserSchema = z.object({
  role: z.enum(['customer', 'staff', 'admin']).optional(),
  full_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  language: z.string().optional(),
  region: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['admin'])

    // Find user by ID in mock data
    const user = Object.values(mockUsers).find(u => u.id === params.id)

    if (!user) {
      return notFoundResponse('User not found')
    }

    // Return with user_id for frontend compatibility
    return successResponse({
      ...user,
      user_id: user.id,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch user', error.message)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['admin'])

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateUserSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    // Find user by ID in mock data
    const userEmail = Object.keys(mockUsers).find(email => mockUsers[email].id === params.id)

    if (!userEmail) {
      return notFoundResponse('User not found')
    }

    // Update user in mock data
    const currentUser = mockUsers[userEmail]
    const updatedUser = {
      ...currentUser,
      ...validation.data,
      updated_at: new Date().toISOString(),
    }

    // Update the mock data store
    mockUsers[userEmail] = updatedUser

    // Return with user_id for frontend compatibility
    return successResponse({
      ...updatedUser,
      user_id: updatedUser.id,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to update user', error.message)
  }
}

