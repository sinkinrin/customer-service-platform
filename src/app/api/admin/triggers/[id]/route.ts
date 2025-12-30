/**
 * Individual Trigger Management API
 * 
 * GET /api/admin/triggers/[id] - Get trigger details
 * PUT /api/admin/triggers/[id] - Update trigger
 * DELETE /api/admin/triggers/[id] - Delete trigger
 */

import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/utils/api-response'
import type { UpdateTriggerRequest } from '@/lib/zammad/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    if (session.user.role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Admin access required', undefined, 403)
    }

    const { id } = await params
    const triggerId = parseInt(id, 10)
    
    if (isNaN(triggerId)) {
      return errorResponse('INVALID_REQUEST', 'Invalid trigger ID', undefined, 400)
    }

    const trigger = await zammadClient.getTrigger(triggerId)
    
    return successResponse({ trigger })
  } catch (error) {
    console.error('GET /api/admin/triggers/[id] error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    if (session.user.role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Admin access required', undefined, 403)
    }

    const { id } = await params
    const triggerId = parseInt(id, 10)
    
    if (isNaN(triggerId)) {
      return errorResponse('INVALID_REQUEST', 'Invalid trigger ID', undefined, 400)
    }

    const body = await request.json() as UpdateTriggerRequest
    const trigger = await zammadClient.updateTrigger(triggerId, body)
    
    return successResponse({
      trigger,
      message: 'Trigger updated successfully',
    })
  } catch (error) {
    console.error('PUT /api/admin/triggers/[id] error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    if (session.user.role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Admin access required', undefined, 403)
    }

    const { id } = await params
    const triggerId = parseInt(id, 10)
    
    if (isNaN(triggerId)) {
      return errorResponse('INVALID_REQUEST', 'Invalid trigger ID', undefined, 400)
    }

    await zammadClient.deleteTrigger(triggerId)
    
    return successResponse({
      message: 'Trigger deleted successfully',
    })
  } catch (error) {
    console.error('DELETE /api/admin/triggers/[id] error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}
