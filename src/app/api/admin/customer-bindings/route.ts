/**
 * Admin Customer-Staff Binding Management API
 *
 * GET  /api/admin/customer-bindings — List bindings (with filters)
 * POST /api/admin/customer-bindings — Create or update a binding (admin manual)
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  serviceUnavailableResponse,
} from '@/lib/utils/api-response'
import { listBindings, setBinding } from '@/lib/ticket/customer-binding'
import { zammadClient } from '@/lib/zammad/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import { isServiceGroupAssignmentCutoverActive } from '@/lib/service-groups/cutover'

const CreateBindingSchema = z.object({
  customerZammadId: z.number().int().positive(),
  staffZammadId: z.number().int().positive(),
  region: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin'])

    const { searchParams } = new URL(request.url)
    const staffZammadId = searchParams.get('staffZammadId')
    const customerZammadId = searchParams.get('customerZammadId')
    const region = searchParams.get('region')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    const result = await listBindings({
      staffZammadId: staffZammadId ? parseInt(staffZammadId) : undefined,
      customerZammadId: customerZammadId ? parseInt(customerZammadId) : undefined,
      region: region || undefined,
      page: isNaN(page) ? 1 : page,
      pageSize: isNaN(pageSize) ? 50 : Math.min(pageSize, 100),
    })

    return successResponse(result)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    logger.error('AdminBindings', 'GET error', { data: { error: error.message } })
    return serverErrorResponse('Failed to list bindings')
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])

    if (isServiceGroupAssignmentCutoverActive()) {
      return serviceUnavailableResponse('Legacy customer binding mutations are disabled during service-group cutover')
    }

    const body = await request.json()
    const validation = CreateBindingSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { customerZammadId, staffZammadId, region } = validation.data

    // Validate target staff exists and is active
    try {
      const staff = await zammadClient.getUser(staffZammadId)
      if (!staff.active) {
        return validationErrorResponse([{ path: ['staffZammadId'], message: 'Target staff is inactive' }])
      }
    } catch {
      return validationErrorResponse([{ path: ['staffZammadId'], message: 'Staff not found in Zammad' }])
    }

    const binding = await setBinding(customerZammadId, staffZammadId, region)

    return successResponse({ binding, message: 'Binding saved successfully' }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    logger.error('AdminBindings', 'POST error', { data: { error: error.message } })
    return serverErrorResponse('Failed to save binding')
  }
}
