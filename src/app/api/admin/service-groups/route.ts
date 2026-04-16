import { NextRequest } from 'next/server'
import { ServiceBaseRegion } from '@prisma/client'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { createServiceGroup, listServiceGroups } from '@/lib/service-groups/service-group-service'
import { zammadClient } from '@/lib/zammad/client'
import { getGroupIdByRegion } from '@/lib/constants/regions'
import { mapServiceBaseRegionToRegionValue } from '@/lib/service-groups/service-group-service'
import { z } from 'zod'

const CreateServiceGroupSchema = z.object({
  name: z.string().min(1),
  baseRegion: z.nativeEnum(ServiceBaseRegion),
  staffZammadId: z.number().int().positive(),
})

async function ensureStaffHasBaseRegionAccess(staffZammadId: number, baseRegion: ServiceBaseRegion) {
  const staff = await zammadClient.getUser(staffZammadId)
  if (!staff.active) {
    throw new Error('Target staff is inactive')
  }

  const groupId = getGroupIdByRegion(mapServiceBaseRegionToRegionValue(baseRegion))
  const existing = staff.group_ids || {}
  if (!Object.prototype.hasOwnProperty.call(existing, String(groupId))) {
    await zammadClient.updateUser(staffZammadId, {
      group_ids: {
        ...existing,
        [groupId]: ['full'],
      },
    })
  }
}

export async function GET() {
  try {
    await requireRole(['admin'])
    const serviceGroups = await listServiceGroups({ includeInactive: true })
    return successResponse({ serviceGroups })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    return serverErrorResponse('Failed to list service groups')
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])
    const body = await request.json()
    const validation = CreateServiceGroupSchema.safeParse(body)
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const input = validation.data
    await ensureStaffHasBaseRegionAccess(input.staffZammadId, input.baseRegion)
    const serviceGroup = await createServiceGroup(input)
    return successResponse({ serviceGroup }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    if (error.message === 'Target staff is inactive') {
      return validationErrorResponse([{ path: ['staffZammadId'], message: error.message }])
    }
    return serverErrorResponse('Failed to create service group')
  }
}
