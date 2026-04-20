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
import { assignCustomerToServiceGroup, reassignCustomersToServiceGroup } from '@/lib/service-groups/customer-assignment-service'
import {
  migrateServiceGroupOpenTicketsDetailed,
  rollbackTicketMigration,
} from '@/lib/service-groups/ticket-migration-service'
import { zammadClient } from '@/lib/zammad/client'
import { getGroupIdByRegion } from '@/lib/constants/regions'
import { mapServiceBaseRegionToRegionValue } from '@/lib/service-groups/service-group-service'
import { prisma } from '@/lib/prisma'
import { hasFullGroupAccess } from '@/lib/ticket/agent-helpers'
import { z } from 'zod'

const UpdateServiceGroupSchema = z.object({
  name: z.string().min(1).optional(),
  baseRegion: z.nativeEnum(ServiceBaseRegion).optional(),
  staffZammadId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
})

const DeactivateServiceGroupSchema = z.object({
  transferToServiceGroupId: z.number().int().positive(),
})

async function ensureStaffHasBaseRegionAccess(staffZammadId: number, baseRegion: ServiceBaseRegion) {
  const staff = await zammadClient.getUser(staffZammadId)
  if (!staff.active) {
    throw new Error('Target staff is inactive')
  }

  const isAgent = staff.role_ids?.includes(2) || staff.roles?.includes('Agent')
  const isAdmin = staff.role_ids?.includes(1) || staff.roles?.includes('Admin')
  if (!isAgent || isAdmin) {
    throw new Error('Target staff must be an agent')
  }

  const groupId = getGroupIdByRegion(mapServiceBaseRegionToRegionValue(baseRegion))
  const existing = staff.group_ids || {}
  if (!hasFullGroupAccess(existing, groupId)) {
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

    const current = await getServiceGroup(serviceGroupId, { includeInactive: true })
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
    const requiresMigration =
      (input.staffZammadId && input.staffZammadId !== current.staffZammadId) ||
      (input.baseRegion && input.baseRegion !== current.baseRegion)

    if (input.staffZammadId || input.baseRegion) {
      await ensureStaffHasBaseRegionAccess(nextStaffZammadId, nextBaseRegion)
    }

    const migration = requiresMigration
      ? await migrateServiceGroupOpenTicketsDetailed(
          serviceGroupId,
          getGroupIdByRegion(mapServiceBaseRegionToRegionValue(nextBaseRegion)),
          nextStaffZammadId
        )
      : null

    let serviceGroup
    try {
      serviceGroup = await updateServiceGroup(serviceGroupId, input)
    } catch (error) {
      if (migration) {
        try {
          await rollbackTicketMigration(migration.snapshots)
        } catch {
          // Best-effort rollback across systems.
        }
      }
      throw error
    }

    return successResponse({ serviceGroup })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    if (
      error.message === 'Target staff is inactive' ||
      error.message === 'Target staff must be an agent' ||
      error.message === 'Target service group owner must be an agent' ||
      error.message === 'Target service group owner is unavailable'
    ) {
      return validationErrorResponse([{ path: ['staffZammadId'], message: error.message }])
    }
    return serverErrorResponse('Failed to update service group')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['admin'])
    const { id } = await params
    const serviceGroupId = Number(id)
    if (Number.isNaN(serviceGroupId)) {
      return validationErrorResponse([{ path: ['id'], message: 'Invalid service group id' }])
    }

    const current = await getServiceGroup(serviceGroupId, { includeInactive: true })
    if (!current) {
      return notFoundResponse('Service group not found')
    }

    const body = await request.json()
    const validation = DeactivateServiceGroupSchema.safeParse(body)
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { transferToServiceGroupId } = validation.data
    if (transferToServiceGroupId === serviceGroupId) {
      return validationErrorResponse([{ path: ['transferToServiceGroupId'], message: 'Transfer target must be a different service group' }])
    }

    const transferTarget = await getServiceGroup(transferToServiceGroupId)
    if (!transferTarget) {
      return validationErrorResponse([{ path: ['transferToServiceGroupId'], message: 'Transfer target service group not found' }])
    }

    await ensureStaffHasBaseRegionAccess(transferTarget.staffZammadId, transferTarget.baseRegion)
    const migratedAssignments = await prisma.customerGroupAssignment.findMany({
      where: { serviceGroupId },
      select: { customerZammadId: true },
    })
    const migration = await migrateServiceGroupOpenTicketsDetailed(
      serviceGroupId,
      getGroupIdByRegion(mapServiceBaseRegionToRegionValue(transferTarget.baseRegion)),
      transferTarget.staffZammadId
    )

    try {
      await reassignCustomersToServiceGroup(
        serviceGroupId,
        transferToServiceGroupId,
        `service-group-deactivate:${serviceGroupId}->${transferToServiceGroupId}`
      )
    } catch (error) {
      try {
        await rollbackTicketMigration(migration.snapshots)
      } catch {
        // Best-effort rollback across systems.
      }
      throw error
    }

    let serviceGroup
    try {
      serviceGroup = await updateServiceGroup(serviceGroupId, { isActive: false })
    } catch (error) {
      for (const assignment of migratedAssignments) {
        try {
          await assignCustomerToServiceGroup(
            assignment.customerZammadId,
            serviceGroupId,
            `service-group-deactivate-rollback:${transferToServiceGroupId}->${serviceGroupId}`
          )
        } catch {
          // Best-effort rollback across systems.
        }
      }

      try {
        await rollbackTicketMigration(migration.snapshots)
      } catch {
        // Best-effort rollback across systems.
      }

      throw error
    }

    return successResponse({ serviceGroup })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    if (
      error.message === 'Target staff is inactive' ||
      error.message === 'Target staff must be an agent' ||
      error.message === 'Target service group owner must be an agent' ||
      error.message === 'Target service group owner is unavailable'
    ) {
      return validationErrorResponse([{ path: ['transferToServiceGroupId'], message: error.message }])
    }
    return serverErrorResponse('Failed to deactivate service group')
  }
}
