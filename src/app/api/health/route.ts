/**
 * Health Check API
 *
 * GET /api/health - Check API health
 *
 * TODO: Add real database health check when database is implemented
 */

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // TODO: Add real database connection check
    // For now, just return healthy status

    return NextResponse.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'mock', // TODO: Change to 'connected' when real database is added
        version: '0.1.0',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check failed',
          details: error.message,
        },
      },
      { status: 503 }
    )
  }
}

