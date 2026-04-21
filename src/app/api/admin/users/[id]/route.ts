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
  forbiddenResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { mockUsers } from '@/lib/mock-auth'
import { getGroupIdByRegion, isValidRegion, REGIONS, type RegionValue } from '@/lib/constants/regions'
import { ZAMMAD_ROLES } from '@/lib/constants/zammad'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import { findCustomerServiceGroup, getCustomerAssignmentRegion } from '@/lib/service-groups/customer-assignment-service'
import { getPrimaryZammadUserRegion, getRegionFromZammadNote } from '@/lib/utils/zammad-user-regions'

// Map Zammad role_ids to our role names
function getRoleFromZammad(roleIds: number[]): 'admin' | 'staff' | 'customer' {
  if (roleIds.includes(ZAMMAD_ROLES.ADMIN)) return 'admin'
  if (roleIds.includes(ZAMMAD_ROLES.AGENT)) return 'staff'
  return 'customer'
}

function stripRegionNote(note?: string): string {
  if (!note) return ''

  return note
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => !/^Region:\s*\S+/i.test(line.trim()))
    .join('\n')
    .trim()
}

function cloneGroupIds(groupIds?: Record<string, string[]>) {
  return Object.fromEntries(
    Object.entries(groupIds || {}).map(([groupId, permissions]) => [groupId, [...permissions]])
  )
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
    const region = getPrimaryZammadUserRegion({
      role,
      note: zammadUser.note,
      groupIds: zammadUser.group_ids,
      customerAssignmentRegion: role === 'customer'
        ? await getCustomerAssignmentRegion(zammadUser.id)
        : undefined,
    })
    const assignment = role === 'customer' ? await findCustomerServiceGroup(zammadUser.id) : null
    let serviceGroupOwnerName: string | undefined
    if (assignment?.serviceGroup?.staffZammadId) {
      try {
        const owner = await zammadClient.getUser(assignment.serviceGroup.staffZammadId)
        serviceGroupOwnerName =
          [owner.firstname, owner.lastname].filter(Boolean).join(' ') ||
          owner.login ||
          owner.email
      } catch (ownerError) {
        logger.warning('AdminUsers', 'Failed to fetch service group owner', {
          data: {
            serviceGroupId: assignment.serviceGroup.id,
            staffZammadId: assignment.serviceGroup.staffZammadId,
            error: ownerError instanceof Error ? ownerError.message : ownerError,
          },
        })
      }
    }
    const mockUser = mockUsers[zammadUser.email]

    const user = {
      id: zammadUser.id,
      user_id: String(zammadUser.id),
      email: zammadUser.email,
      full_name: `${zammadUser.firstname || ''} ${zammadUser.lastname || ''}`.trim() || zammadUser.login,
      firstname: zammadUser.firstname || '',
      lastname: zammadUser.lastname || '',
      role,
      region: region || (role !== 'customer' ? mockUser?.region : undefined),
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
      service_group: assignment ? {
        id: assignment.serviceGroup.id,
        name: assignment.serviceGroup.name,
        owner_name: serviceGroupOwnerName,
      } : null,
    }

    return successResponse({ user })

  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return notFoundResponse('User not found')
    }
    logger.error('AdminUsers', 'Failed to fetch user', { data: { error: error instanceof Error ? error.message : error } })
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
    const existingRole = getRoleFromZammad(currentUser.role_ids || [])
    const targetRole = role || existingRole

    if (role && role !== 'customer' && existingRole === 'customer' && !region) {
      return validationErrorResponse([{ path: ['region'], message: 'Invalid region' }])
    }

    const currentRegion = getRegionFromZammadNote(currentUser.note) || getPrimaryZammadUserRegion({
      role: existingRole,
      note: currentUser.note,
      groupIds: currentUser.group_ids,
    })

    // Handle region change
    // - Staff/Admin: update group_ids in Zammad AND note field (note is fallback for regions without dedicated groups)
    // - Customer: update note field only (Zammad ignores group_ids for customers)
    if (region && targetRole !== 'customer' && region !== currentRegion) {
      // Always update note field with region (works for all roles, and serves as fallback)
      const existingNote = currentUser.note || ''
      const regionPattern = /Region:\s*\S+/
      if (regionPattern.test(existingNote)) {
        updateData.note = existingNote.replace(regionPattern, `Region: ${region}`)
      } else {
        updateData.note = existingNote ? `${existingNote}\nRegion: ${region}` : `Region: ${region}`
      }

      // For staff/admin, also set group_ids with full permissions
      const groupId = getGroupIdByRegion(region as RegionValue)
      updateData.group_ids = {
        ...cloneGroupIds(currentUser.group_ids),
        [groupId.toString()]: ['full'],
      }

      if (mockUsers[currentUser.email]) {
        mockUsers[currentUser.email].region = region
      }
    }

    if (role === 'customer' && existingRole !== 'customer') {
      updateData.group_ids = {}
      updateData.note = stripRegionNote(currentUser.note)

      if (mockUsers[currentUser.email]) {
        mockUsers[currentUser.email].region = undefined
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
    const updatedRole = targetRole
    const updatedRegion = getPrimaryZammadUserRegion({
      role: updatedRole,
      note: updatedUser.note,
      groupIds: updatedUser.group_ids,
      customerAssignmentRegion: updatedRole === 'customer'
        ? await getCustomerAssignmentRegion(updatedUser.id)
        : undefined,
    })

    return successResponse({
      user: {
        id: updatedUser.id,
        user_id: String(updatedUser.id),
        email: updatedUser.email,
        full_name: `${updatedUser.firstname || ''} ${updatedUser.lastname || ''}`.trim(),
        active: updatedUser.active,
        region: updatedRole === 'customer' ? updatedRegion : (updatedRegion || region),
        updated_at: updatedUser.updated_at,
      },
      message: 'User updated successfully',
    })

  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    logger.error('AdminUsers', 'Failed to update user', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse('Failed to update user', error.message)
  }
}
