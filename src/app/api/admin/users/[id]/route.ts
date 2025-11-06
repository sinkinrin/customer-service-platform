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
import { z } from 'zod'

const UpdateUserSchema = z.object({
  role: z.enum(['customer', 'staff', 'admin']).optional(),
  full_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  language: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['admin'])
    const supabase = await createClient()

    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return notFoundResponse('User not found')
      }
      throw error
    }

    return successResponse(user)
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
    const supabase = await createClient()

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateUserSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    // Update user profile
    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update(validation.data)
      .eq('user_id', params.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return notFoundResponse('User not found')
      }
      throw error
    }

    return successResponse(updated)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to update user', error.message)
  }
}

