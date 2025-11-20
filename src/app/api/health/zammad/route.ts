/**
 * Zammad Service Health Check API
 * 
 * GET /api/health/zammad - Check if Zammad service is available
 */

import { NextRequest } from 'next/server'
import { checkZammadHealth } from '@/lib/zammad/health-check'
import { successResponse, serverErrorResponse } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const healthCheck = await checkZammadHealth()
    
    if (healthCheck.isHealthy) {
      return successResponse({
        service: 'zammad',
        status: 'healthy',
        available: true,
        message: 'Zammad service is available',
      })
    } else {
      return successResponse({
        service: 'zammad',
        status: 'unhealthy',
        available: false,
        message: healthCheck.error || 'Zammad service is not available',
      }, 503)
    }
  } catch (error) {
    console.error('Health check error:', error)
    return serverErrorResponse(
      'Failed to check Zammad service health',
      { service: 'zammad', available: false }
    )
  }
}

