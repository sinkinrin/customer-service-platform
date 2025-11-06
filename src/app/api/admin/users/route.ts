/**
 * Admin Users API
 *
 * GET /api/admin/users - Get all users with pagination and filtering
 * POST /api/admin/users - Create a new user (admin only)
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
  validationErrorResponse,
} from '@/lib/utils/api-response'
import { mockUsers, mockPasswords } from '@/lib/mock-auth'
import { zammadClient } from '@/lib/zammad/client'
import { getGroupIdByRegion, isValidRegion } from '@/lib/constants/regions'
import { z } from 'zod'

// Validation schema for creating a new user
const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  role: z.enum(['customer', 'staff', 'admin'], {
    errorMap: () => ({ message: 'Role must be customer, staff, or admin' })
  }),
  region: z.string().refine(isValidRegion, {
    message: 'Invalid region'
  }),
  phone: z.string().optional(),
  language: z.string().optional(),
})

// TODO: Replace with real database when implemented
export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin'])

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || ''
    const roleFilter = searchParams.get('role') || ''

    // Convert mockUsers object to array
    const allUsers = Object.values(mockUsers)

    // Apply filters
    let filteredUsers = allUsers

    if (search) {
      const searchLower = search.toLowerCase()
      filteredUsers = filteredUsers.filter(user =>
        user.full_name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      )
    }

    if (roleFilter && ['customer', 'staff', 'admin'].includes(roleFilter)) {
      filteredUsers = filteredUsers.filter(user => user.role === roleFilter)
    }

    // Apply pagination
    const paginatedUsers = filteredUsers.slice(offset, offset + limit)

    return successResponse({
      users: paginatedUsers,
      pagination: {
        limit,
        offset,
        total: filteredUsers.length,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch users', error.message)
  }
}

/**
 * Create a new user (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin permission
    await requireRole(['admin'])

    // Parse and validate request body
    const body = await request.json()
    const validation = CreateUserSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { email, password, full_name, role, region, phone, language } = validation.data

    // Check if user already exists
    if (mockUsers[email]) {
      return validationErrorResponse([{
        path: ['email'],
        message: 'User with this email already exists'
      }])
    }

    // Prepare Zammad user data
    const [firstname, ...lastnameArr] = full_name.split(' ')
    const lastname = lastnameArr.join(' ') || firstname

    // Determine Zammad role
    let zammadRoles: string[]
    if (role === 'admin') {
      zammadRoles = ['Admin', 'Agent']
    } else if (role === 'staff') {
      zammadRoles = ['Agent']
    } else {
      zammadRoles = ['Customer']
    }

    // Prepare group_ids for staff (assign to region group)
    let groupIds: Record<string, string[]> | undefined
    if (role === 'staff') {
      const groupId = getGroupIdByRegion(region as any)
      groupIds = {
        [groupId.toString()]: ['full']  // Full permission for staff in their region
      }
    }

    // Create user in Zammad
    const zammadUser = await zammadClient.createUser({
      login: email,
      email,
      firstname,
      lastname,
      password,
      roles: zammadRoles,
      phone: phone || '',
      note: `Region: ${region}`,
      group_ids: groupIds,
      active: true,
      verified: true,
    })

    // Create user in mock system
    const mockUser = {
      id: `user-${Date.now()}`,
      email,
      role,
      full_name,
      phone,
      language: language || 'zh-CN',
      region,
      zammad_id: zammadUser.id,
      created_at: new Date().toISOString(),
    }

    // Store in mock data
    mockUsers[email] = mockUser
    mockPasswords[email] = password

    return successResponse({
      user: mockUser,
      zammad_user: zammadUser,
    }, 201)

  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    console.error('Failed to create user:', error)
    return serverErrorResponse('Failed to create user', error.message)
  }
}

