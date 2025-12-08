/**
 * Zammad Service Health Check API
 * 
 * GET /api/health/zammad - Check if Zammad service is available
 */

import { NextRequest } from 'next/server'
import { checkZammadHealth } from '@/lib/zammad/health-check'
import { successResponse, serviceUnavailableResponse, serverErrorResponse } from '@/lib/utils/api-response'

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
      // Return error response with success: false when service is unavailable
      return serviceUnavailableResponse(
        healthCheck.error || 'Zammad service is not available',
        {
          service: 'zammad',
          status: 'unhealthy',
          available: false,
        }
      )
    }
  } catch (error) {
    console.error('Health check error:', error)
    return serverErrorResponse(
      'Failed to check Zammad service health',
      { service: 'zammad', available: false }
    )
  }
}

