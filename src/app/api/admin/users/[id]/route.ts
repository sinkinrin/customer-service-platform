/**
 * Admin User Detail API
 *
 * GET /api/admin/users/[id] - Get user by Zammad ID
 * PUT /api/admin/users/[id] - Update user by Zammad ID
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
import { zammadClient } from '@/lib/zammad/client'
import { mockUsers } from '@/lib/mock-auth'
import { getRegionByGroupId, getGroupIdByRegion, isValidRegion, REGIONS, type RegionValue } from '@/lib/constants/regions'
import { z } from 'zod'

// Map Zammad role_ids to our role names
function getRoleFromZammad(roleIds: number[]): 'admin' | 'staff' | 'customer' {
  if (roleIds.includes(1)) return 'admin'
  if (roleIds.includes(2)) return 'staff'
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

const UpdateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
  region: z.string().optional().refine(
    (val) => !val || val === '' || isValidRegion(val),
    { message: `Invalid region. Must be one of: ${REGIONS.map(r => r.value).join(', ')}` }
  ),
  role: z.enum(['customer', 'staff', 'admin']).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin', 'staff'])

    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return validationErrorResponse([{ path: ['id'], message: 'Invalid user ID' }])
    }

    // Fetch from Zammad
    const zammadUser = await zammadClient.getUser(userId)

    if (!zammadUser) {
      return notFoundResponse('User not found')
    }

    const role = getRoleFromZammad(zammadUser.role_ids || [])
    // For staff/admin: get region from group_ids; for customers: get from note field
    const region = role === 'customer'
      ? getRegionFromNote(zammadUser.note)
      : getRegionFromGroupIds(zammadUser.group_ids)
    const mockUser = mockUsers[zammadUser.email]

    const user = {
      id: zammadUser.id,
      user_id: String(zammadUser.id),
      email: zammadUser.email,
      full_name: `${zammadUser.firstname || ''} ${zammadUser.lastname || ''}`.trim() || zammadUser.login,
      firstname: zammadUser.firstname || '',
      lastname: zammadUser.lastname || '',
      role,
      region: region || mockUser?.region,
      phone: zammadUser.phone || mockUser?.phone || '',
      language: mockUser?.language || 'en',
      active: zammadUser.active,
      verified: zammadUser.verified,
      out_of_office: zammadUser.out_of_office,
      out_of_office_start_at: zammadUser.out_of_office_start_at,
      out_of_office_end_at: zammadUser.out_of_office_end_at,
      created_at: zammadUser.created_at,
      updated_at: zammadUser.updated_at,
      last_login: zammadUser.last_login,
      tickets_open: zammadUser.preferences?.tickets_open || 0,
      tickets_closed: zammadUser.preferences?.tickets_closed || 0,
    }

    return successResponse({ user })

  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return notFoundResponse('User not found')
    }
    console.error('[User API] Error:', error)
    return serverErrorResponse('Failed to fetch user', error.message)
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return validationErrorResponse([{ path: ['id'], message: 'Invalid user ID' }])
    }

    const body = await request.json()
    const validation = UpdateUserSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { full_name, firstname, lastname, phone, active, region, role } = validation.data

    // Build update data
    const updateData: any = {}
    if (firstname !== undefined) updateData.firstname = firstname
    if (lastname !== undefined) updateData.lastname = lastname
    if (full_name) {
      // Split full_name into firstname and lastname
      // If only one word, use it as firstname and leave lastname empty
      const parts = full_name.trim().split(/\s+/)
      updateData.firstname = parts[0] || ''
      updateData.lastname = parts.slice(1).join(' ') || ''
    }
    if (phone !== undefined) updateData.phone = phone
    if (active !== undefined) updateData.active = active

    // Fetch current user for role check and mockUsers sync
    const currentUser = await zammadClient.getUser(userId)
    const currentRole = role || getRoleFromZammad(currentUser.role_ids || [])

    // Handle region change
    // - Staff/Admin: update group_ids in Zammad AND note field (note is fallback for regions without dedicated groups)
    // - Customer: update note field only (Zammad ignores group_ids for customers)
    if (region) {
      // Always update note field with region (works for all roles, and serves as fallback)
      const existingNote = currentUser.note || ''
      const regionPattern = /Region:\s*\S+/
      if (regionPattern.test(existingNote)) {
        updateData.note = existingNote.replace(regionPattern, `Region: ${region}`)
      } else {
        updateData.note = existingNote ? `${existingNote}\nRegion: ${region}` : `Region: ${region}`
      }

      // For staff/admin, also set group_ids with full permissions
      if (currentRole !== 'customer') {
        const groupId = getGroupIdByRegion(region as RegionValue)
        updateData.group_ids = { [groupId.toString()]: ['full'] }
      }

      // Also update mockUsers if exists (for local auth)
      if (mockUsers[currentUser.email]) {
        mockUsers[currentUser.email].region = region
      }
    }

    // Handle role change
    if (role) {
      // Map role to Zammad role_ids
      // 1 = Admin, 2 = Agent (staff), 3 = Customer
      const roleIdMap: Record<string, number[]> = {
        'admin': [1],
        'staff': [2],
        'customer': [3],
      }
      updateData.role_ids = roleIdMap[role]

      // Update mockUsers if exists
      if (mockUsers[currentUser.email]) {
        mockUsers[currentUser.email].role = role
      }
    }

    const updatedUser = await zammadClient.updateUser(userId, updateData)

    // Get region based on user role
    const updatedRole = role || currentRole
    const updatedRegion = updatedRole === 'customer'
      ? getRegionFromNote(updatedUser.note)
      : getRegionFromGroupIds(updatedUser.group_ids)

    return successResponse({
      user: {
        id: updatedUser.id,
        user_id: String(updatedUser.id),
        email: updatedUser.email,
        full_name: `${updatedUser.firstname || ''} ${updatedUser.lastname || ''}`.trim(),
        active: updatedUser.active,
        region: updatedRegion || region,
        updated_at: updatedUser.updated_at,
      },
      message: 'User updated successfully',
    })

  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    console.error('[User API] Error:', error)
    return serverErrorResponse('Failed to update user', error.message)
  }
}
