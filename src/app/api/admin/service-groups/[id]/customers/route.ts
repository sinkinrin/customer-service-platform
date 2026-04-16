import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { assignCustomerToServiceGroup, clearCustomerAssignment } from '@/lib/service-groups/customer-assignment-service'
import { getServiceGroup } from '@/lib/service-groups/service-group-service'
import { migrateCustomerOpenTicketsToGroup } from '@/lib/service-groups/ticket-migration-service'
import { getGroupIdByRegion } from '@/lib/constants/regions'
import { mapServiceBaseRegionToRegionValue } from '@/lib/service-groups/service-group-service'
import { z } from 'zod'

const AssignCustomersSchema = z.object({
  customerZammadIds: z.array(z.number().int().positive()).min(1),
})

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['admin'])
    const { id } = await params
    const serviceGroupId = Number(id)
    if (Number.isNaN(serviceGroupId)) {
      return validationErrorResponse([{ path: ['id'], message: 'Invalid service group id' }])
    }
    const assignments = await prisma.customerGroupAssignment.findMany({
      where: { serviceGroupId },
      select: { customerZammadId: true },
    })
    return successResponse({ customers: assignments })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    return serverErrorResponse('Failed to list group customers')
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['admin'])
    const { id } = await params
    const serviceGroupId = Number(id)
    if (Number.isNaN(serviceGroupId)) {
      return validationErrorResponse([{ path: ['id'], message: 'Invalid service group id' }])
    }
    const body = await request.json()
    const validation = AssignCustomersSchema.safeParse(body)
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const serviceGroup = await getServiceGroup(serviceGroupId)
    if (!serviceGroup) {
      return validationErrorResponse([{ path: ['serviceGroupId'], message: 'Service group not found' }])
    }

    const groupId = getGroupIdByRegion(mapServiceBaseRegionToRegionValue(serviceGroup.baseRegion))
    for (const customerZammadId of validation.data.customerZammadIds) {
      await assignCustomerToServiceGroup(customerZammadId, serviceGroupId, 'service-group-bulk-route')
      await migrateCustomerOpenTicketsToGroup(customerZammadId, groupId, serviceGroup.staffZammadId)
    }

    return successResponse({ assigned: validation.data.customerZammadIds.length })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    return serverErrorResponse('Failed to assign customers to service group')
  }
}
