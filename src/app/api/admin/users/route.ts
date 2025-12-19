/**
 * Admin Users API
 *
 * GET /api/admin/users - Get all users with pagination and filtering (from Zammad)
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
import { getGroupIdByRegion, isValidRegion, getRegionByGroupId } from '@/lib/constants/regions'
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

// Map Zammad role_ids to our role names
function getRoleFromZammad(roleIds: number[]): 'admin' | 'staff' | 'customer' {
  if (roleIds.includes(1)) return 'admin'
  if (roleIds.includes(2)) return 'staff'
  return 'customer'
}

// Get region from Zammad group_ids
function getRegionFromGroupIds(groupIds?: Record<string, string[]>): string | undefined {
  if (!groupIds) return undefined
  for (const [groupId, permissions] of Object.entries(groupIds)) {
    if (permissions.includes('full')) {
      const region = getRegionByGroupId(parseInt(groupId))
      if (region) return region
    }
  }
  return undefined
}

export async function GET(request: NextRequest) {
  try {
    // Allow both admin and staff to view users
    await requireRole(['admin', 'staff'])

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || ''
    const roleFilter = searchParams.get('role') || ''
    const regionFilter = searchParams.get('region') || ''
    const source = searchParams.get('source') || 'zammad' // 'zammad' or 'mock'

    // Fetch from Zammad (primary source)
    let allUsers: any[] = []

    if (source === 'zammad') {
      try {
        const zammadUsers = await zammadClient.getAllUsers('*')

        allUsers = zammadUsers.map(user => {
          const role = getRoleFromZammad(user.role_ids || [])
          const region = getRegionFromGroupIds(user.group_ids)

          // Augment with mockUsers data if available (for language preference etc.)
          const mockUser = mockUsers[user.email]

          return {
            id: String(user.id),
            user_id: String(user.id),
            email: user.email,
            full_name: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.login,
            role,
            region: region || mockUser?.region,
            phone: user.phone || mockUser?.phone || '',
            language: mockUser?.language || 'en',
            active: user.active,
            verified: user.verified,
            zammad_id: user.id,
            created_at: user.created_at,
          }
        })
      } catch (error) {
        console.warn('[Admin Users API] Zammad unavailable, falling back to mock data:', error)
        // Fall back to mock data
        allUsers = Object.values(mockUsers).map(user => ({
          ...user,
          user_id: user.id,
          active: true,
        }))
      }
    } else {
      // Use mock data directly
      allUsers = Object.values(mockUsers).map(user => ({
        ...user,
        user_id: user.id,
        active: true,
      }))
    }

    // Apply filters
    let filteredUsers = allUsers

    if (search) {
      const searchLower = search.toLowerCase()
      filteredUsers = filteredUsers.filter(user =>
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      )
    }

    if (roleFilter && ['customer', 'staff', 'admin'].includes(roleFilter)) {
      filteredUsers = filteredUsers.filter(user => user.role === roleFilter)
    }

    if (regionFilter) {
      filteredUsers = filteredUsers.filter(user => user.region === regionFilter)
    }

    // Status filter (active/disabled)
    const statusFilter = searchParams.get('status') || ''
    if (statusFilter === 'active') {
      filteredUsers = filteredUsers.filter(user => user.active !== false)
    } else if (statusFilter === 'disabled') {
      filteredUsers = filteredUsers.filter(user => user.active === false)
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
      source,
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

