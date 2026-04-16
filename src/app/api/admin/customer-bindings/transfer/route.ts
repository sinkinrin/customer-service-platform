/**
 * POST /api/admin/customer-bindings/transfer — Transfer all customers from one staff to another
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
import { transferBindings } from '@/lib/ticket/customer-binding'
import { zammadClient } from '@/lib/zammad/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import { isServiceGroupAssignmentCutoverActive } from '@/lib/service-groups/cutover'

const TransferSchema = z.object({
  fromStaffZammadId: z.number().int().positive(),
  toStaffZammadId: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])

    if (isServiceGroupAssignmentCutoverActive()) {
      return serviceUnavailableResponse('Legacy customer binding mutations are disabled during service-group cutover')
    }

    const body = await request.json()
    const validation = TransferSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { fromStaffZammadId, toStaffZammadId } = validation.data

    if (fromStaffZammadId === toStaffZammadId) {
      return validationErrorResponse([{
        path: ['toStaffZammadId'],
        message: 'Cannot transfer to the same staff member',
      }])
    }

    // Validate target staff exists and is active
    try {
      const targetStaff = await zammadClient.getUser(toStaffZammadId)
      if (!targetStaff.active) {
        return validationErrorResponse([{ path: ['toStaffZammadId'], message: 'Target staff is inactive' }])
      }
    } catch {
      return validationErrorResponse([{ path: ['toStaffZammadId'], message: 'Target staff not found in Zammad' }])
    }

    const count = await transferBindings(fromStaffZammadId, toStaffZammadId)

    return successResponse({
      message: `Transferred ${count} customer binding(s)`,
      transferred: count,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    logger.error('AdminBindings', 'Transfer error', { data: { error: error.message } })
    return serverErrorResponse('Failed to transfer bindings')
  }
}
