import { NextRequest } from 'next/server'
import { ServiceBaseRegion } from '@prisma/client'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { getServiceGroup, updateServiceGroup } from '@/lib/service-groups/service-group-service'
import { migrateServiceGroupOpenTickets } from '@/lib/service-groups/ticket-migration-service'
import { zammadClient } from '@/lib/zammad/client'
import { getGroupIdByRegion } from '@/lib/constants/regions'
import { mapServiceBaseRegionToRegionValue } from '@/lib/service-groups/service-group-service'
import { z } from 'zod'

const UpdateServiceGroupSchema = z.object({
  name: z.string().min(1).optional(),
  baseRegion: z.nativeEnum(ServiceBaseRegion).optional(),
  staffZammadId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['admin'])
    const { id } = await params
    const serviceGroupId = Number(id)
    if (Number.isNaN(serviceGroupId)) {
      return validationErrorResponse([{ path: ['id'], message: 'Invalid service group id' }])
    }

    const current = await getServiceGroup(serviceGroupId)
    if (!current) {
      return notFoundResponse('Service group not found')
    }

    const body = await request.json()
    const validation = UpdateServiceGroupSchema.safeParse(body)
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const input = validation.data
    const nextBaseRegion = input.baseRegion || current.baseRegion
    const nextStaffZammadId = input.staffZammadId || current.staffZammadId

    if (input.staffZammadId || input.baseRegion) {
      await ensureStaffHasBaseRegionAccess(nextStaffZammadId, nextBaseRegion)
    }

    const serviceGroup = await updateServiceGroup(serviceGroupId, input)

    if ((input.staffZammadId && input.staffZammadId !== current.staffZammadId) || (input.baseRegion && input.baseRegion !== current.baseRegion)) {
      await migrateServiceGroupOpenTickets(
        serviceGroupId,
        getGroupIdByRegion(mapServiceBaseRegionToRegionValue(nextBaseRegion)),
        nextStaffZammadId
      )
    }

    return successResponse({ serviceGroup })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    if (error.message === 'Target staff is inactive') {
      return validationErrorResponse([{ path: ['staffZammadId'], message: error.message }])
    }
    return serverErrorResponse('Failed to update service group')
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['admin'])
    const { id } = await params
    const serviceGroupId = Number(id)
    if (Number.isNaN(serviceGroupId)) {
      return validationErrorResponse([{ path: ['id'], message: 'Invalid service group id' }])
    }
    const current = await getServiceGroup(serviceGroupId)
    if (!current) {
      return notFoundResponse('Service group not found')
    }
    const serviceGroup = await updateServiceGroup(serviceGroupId, { isActive: false })
    return successResponse({ serviceGroup })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    return serverErrorResponse('Failed to deactivate service group')
  }
}
