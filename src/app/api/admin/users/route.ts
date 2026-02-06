/**
 * Admin Users API
 *
 * @swagger
 * /api/admin/users:
 *   get:
 *     description: Get all users with pagination and filtering (Admin/Staff only)
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [customer, staff, admin]
 *         description: Filter by role
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter by region
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [zammad, mock]
 *           default: zammad
 *         description: Data source
 *     responses:
 *       200:
 *         description: A list of users
 *   post:
 *     description: Create a new user (Admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - full_name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               full_name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [customer, staff, admin]
 *               region:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
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
import { ZAMMAD_ROLES } from '@/lib/constants/zammad'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

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
  if (roleIds.includes(ZAMMAD_ROLES.ADMIN)) return 'admin'
  if (roleIds.includes(ZAMMAD_ROLES.AGENT)) return 'staff'
  return 'customer'
}

// Get region from Zammad group_ids (for staff/admin)
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

// Get region from Zammad note field (for customers)
function getRegionFromNote(note?: string): string | undefined {
  if (!note) return undefined
  const match = note.match(/Region:\s*(\S+)/)
  if (match && isValidRegion(match[1])) {
    return match[1]
  }
  return undefined
}

const ZAMMAD_USERS_PAGE_SIZE = 100
const ZAMMAD_USERS_MAX_SCAN_PAGES = 50

function mapZammadUser(user: any) {
  const role = getRoleFromZammad(user.role_ids || [])
  const regionFromGroups = getRegionFromGroupIds(user.group_ids)
  const regionFromNote = getRegionFromNote(user.note)
  const region = role === 'customer' ? regionFromNote : (regionFromGroups || regionFromNote)
  const mockUser = mockUsers[user.email]

  return {
    id: String(user.id),
    user_id: String(user.id),
    email: user.email,
    full_name: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.login,
    firstname: user.firstname || '',
    lastname: user.lastname || '',
    role,
    region: region || mockUser?.region,
    phone: user.phone || mockUser?.phone || '',
    language: mockUser?.language || 'en',
    active: user.active,
    verified: user.verified,
    zammad_id: user.id,
    created_at: user.created_at,
  }
}

function matchesLocalFilters(
  user: any,
  search: string,
  roleFilter: string,
  regionFilter: string,
  statusFilter: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase()
    const matched = user.full_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    if (!matched) return false
  }

  if (roleFilter && ['customer', 'staff', 'admin'].includes(roleFilter) && user.role !== roleFilter) {
    return false
  }

  if (regionFilter && user.region !== regionFilter) {
    return false
  }

  if (statusFilter === 'active' && user.active === false) {
    return false
  }

  if (statusFilter === 'disabled' && user.active !== false) {
    return false
  }

  return true
}

export async function GET(request: NextRequest) {
  try {
    // Allow both admin and staff to view users
    const currentUser = await requireRole(['admin', 'staff'])

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || ''
    const roleFilter = searchParams.get('role') || ''
    // Staff can only see users from their own region (enforced server-side)
    // Admin can see all regions or filter by specific region
    const regionFilter = currentUser.role === 'staff' && currentUser.region
      ? currentUser.region
      : (searchParams.get('region') || '')
    const source = searchParams.get('source') || 'zammad' // 'zammad' or 'mock'
    const statusFilter = searchParams.get('status') || ''

    // Fetch from Zammad (primary source)
    let allUsers: any[] = []

    if (source === 'zammad') {
      try {
        const query = search || '*'
        const hasLocalPostFilters = Boolean(roleFilter || regionFilter || statusFilter)

        // Fast path: when no local post-filters, use direct page+count from Zammad search.
        if (!hasLocalPostFilters && offset % limit === 0) {
          const page = Math.floor(offset / limit) + 1
          const [zammadUsers, total] = await Promise.all([
            zammadClient.searchUsersPaginated(query, limit, page),
            zammadClient.searchUsersTotalCount(query),
          ])

          const users = zammadUsers.map(mapZammadUser)
          return successResponse({
            users,
            pagination: {
              limit,
              offset,
              total,
            },
            source,
          })
        }

        // Filter path: scan paginated users and only retain requested window.
        const targetStart = offset
        const targetEnd = offset + limit
        let matchedTotal = 0
        const usersWindow: any[] = []
        let page = 1
        let reachedEnd = false

        while (page <= ZAMMAD_USERS_MAX_SCAN_PAGES) {
          const batch = await zammadClient.searchUsersPaginated(query, ZAMMAD_USERS_PAGE_SIZE, page)
          if (batch.length === 0) {
            reachedEnd = true
            break
          }

          for (const item of batch) {
            const mapped = mapZammadUser(item)
            if (!matchesLocalFilters(mapped, search, roleFilter, regionFilter, statusFilter)) {
              continue
            }

            if (matchedTotal >= targetStart && matchedTotal < targetEnd) {
              usersWindow.push(mapped)
            }

            matchedTotal++
          }

          if (batch.length < ZAMMAD_USERS_PAGE_SIZE) {
            reachedEnd = true
            break
          }

          page++
        }

        const truncated = !reachedEnd
        return successResponse({
          users: usersWindow,
          pagination: {
            limit,
            offset,
            total: matchedTotal,
            ...(truncated ? { truncated: true } : {}),
          },
          source,
        })
      } catch (error) {
        logger.warning('AdminUsers', 'Zammad unavailable, falling back to mock data', { data: { error: error instanceof Error ? error.message : error } })
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

    filteredUsers = filteredUsers.filter((entry) =>
      matchesLocalFilters(entry, search, roleFilter, regionFilter, statusFilter)
    )

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
    logger.error('AdminUsers', 'Failed to create user', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse('Failed to create user', error.message)
  }
}

