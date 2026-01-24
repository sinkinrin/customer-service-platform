/**
 * Email Notification Triggers API
 * 
 * GET /api/admin/triggers - List all triggers
 * POST /api/admin/triggers - Create a new trigger
 */

import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { logger } from '@/lib/utils/logger'
import type { CreateTriggerRequest } from '@/lib/zammad/types'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    if (session.user.role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Admin access required', undefined, 403)
    }

    const triggers = await zammadClient.getTriggers()
    
    return successResponse({
      triggers,
      count: triggers.length,
    })
  } catch (error) {
    logger.error('Triggers', 'Failed to list triggers', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    if (session.user.role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Admin access required', undefined, 403)
    }

    const body = await request.json() as CreateTriggerRequest

    if (!body.name || !body.condition || !body.perform) {
      return errorResponse('INVALID_REQUEST', 'Missing required fields: name, condition, perform', undefined, 400)
    }

    const trigger = await zammadClient.createTrigger(body)
    
    return successResponse({
      trigger,
      message: 'Trigger created successfully',
    })
  } catch (error) {
    logger.error('Triggers', 'Failed to create trigger', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}
