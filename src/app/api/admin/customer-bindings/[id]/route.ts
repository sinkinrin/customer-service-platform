/**
 * DELETE /api/admin/customer-bindings/[id] — Deactivate a binding
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  notFoundResponse,
  serverErrorResponse,
  serviceUnavailableResponse,
} from '@/lib/utils/api-response'
import { deactivateBinding } from '@/lib/ticket/customer-binding'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'
import { isServiceGroupAssignmentCutoverActive } from '@/lib/service-groups/cutover'

type RouteParams = { params: Promise<{ id: string }> }

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    if (isServiceGroupAssignmentCutoverActive()) {
      return serviceUnavailableResponse('Legacy customer binding mutations are disabled during service-group cutover')
    }

    const { id } = await params
    const bindingId = parseInt(id)

    if (isNaN(bindingId)) {
      return validationErrorResponse([{ path: ['id'], message: 'Invalid binding ID' }])
    }

    const binding = await prisma.customerStaffBinding.findUnique({ where: { id: bindingId } })
    if (!binding) {
      return notFoundResponse('Binding not found')
    }

    await deactivateBinding(bindingId)

    return successResponse({ message: 'Binding deactivated successfully' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse()
    if (error.message === 'Forbidden') return forbiddenResponse()
    logger.error('AdminBindings', 'DELETE error', { data: { error: error.message } })
    return serverErrorResponse('Failed to deactivate binding')
  }
}
