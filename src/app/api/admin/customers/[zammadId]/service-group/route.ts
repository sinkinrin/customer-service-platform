import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { assignCustomerToServiceGroup, findCustomerServiceGroup } from '@/lib/service-groups/customer-assignment-service'
import { getServiceGroup } from '@/lib/service-groups/service-group-service'
import { migrateCustomerOpenTicketsToGroup } from '@/lib/service-groups/ticket-migration-service'
import { getGroupIdByRegion } from '@/lib/constants/regions'
import { mapServiceBaseRegionToRegionValue } from '@/lib/service-groups/service-group-service'
import { z } from 'zod'

const AssignCustomerSchema = z.object({
  serviceGroupId: z.number().int().positive(),
})

export async function GET(_request: NextRequest, { params }: { params: Promise<{ zammadId: string }> }) {
  try {
    await requireRole(['admin'])
    const { zammadId } = await params
    const customerZammadId = Number(zammadId)
    if (Number.isNaN(customerZammadId)) {
      return validationErrorResponse([{ path: ['zammadId'], message: 'Invalid customer id' }])
    }

    const assignment = await findCustomerServiceGroup(customerZammadId)
    return successResponse({ assignment })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    return serverErrorResponse('Failed to fetch customer service group')
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ zammadId: string }> }) {
  try {
    await requireRole(['admin'])
    const { zammadId } = await params
    const customerZammadId = Number(zammadId)
    if (Number.isNaN(customerZammadId)) {
      return validationErrorResponse([{ path: ['zammadId'], message: 'Invalid customer id' }])
    }

    const body = await request.json()
    const validation = AssignCustomerSchema.safeParse(body)
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const serviceGroup = await getServiceGroup(validation.data.serviceGroupId)
    if (!serviceGroup) {
      return validationErrorResponse([{ path: ['serviceGroupId'], message: 'Service group not found' }])
    }

    const assignment = await assignCustomerToServiceGroup(
      customerZammadId,
      validation.data.serviceGroupId,
      `admin-customer-route:${customerZammadId}`
    )

    await migrateCustomerOpenTicketsToGroup(
      customerZammadId,
      getGroupIdByRegion(mapServiceBaseRegionToRegionValue(serviceGroup.baseRegion)),
      serviceGroup.staffZammadId
    )

    return successResponse({ assignment })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    return serverErrorResponse('Failed to assign customer service group')
  }
}
