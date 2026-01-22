/**
 * Health Check API
 *
 * GET /api/health - Check overall service health
 *
 * Returns:
 * - Service status (healthy/unhealthy)
 * - Zammad connection status
 * - Database connection status
 * - Environment configuration status
 */

import { NextResponse } from "next/server"
import { checkZammadHealth } from "@/lib/zammad/health-check"
import { prisma } from "@/lib/prisma"
import { ensureEnvValidation, isProduction, hasAuthSecret } from "@/lib/env"
import { logger } from "@/lib/utils/logger"

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  version: string
  environment: string
  services: {
    zammad: {
      status: "connected" | "disconnected" | "error"
      message?: string
    }
    database: {
      status: "connected" | "disconnected" | "error"
      message?: string
    }
  }
  config: {
    mockAuthEnabled: boolean
    hasAuthSecret: boolean
    hasZammadConfig: boolean
    hasDatabaseConfig: boolean
  }
}

export async function GET() {
  const startTime = Date.now()

  // Initialize result
  const result: HealthCheckResult = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    environment: process.env.NODE_ENV || "development",
    services: {
      zammad: { status: "disconnected" },
      database: { status: "disconnected" },
    },
    config: {
      mockAuthEnabled:
        process.env.NODE_ENV !== "production" ||
        process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true",
      hasAuthSecret: hasAuthSecret(),
      hasZammadConfig:
        !!process.env.ZAMMAD_URL && !!process.env.ZAMMAD_API_TOKEN,
      hasDatabaseConfig: !!process.env.DATABASE_URL,
    },
  }

  try {
    ensureEnvValidation()
  } catch (error) {
    result.status = "unhealthy"
    result.services.database = {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Environment validation failed",
    }
    return NextResponse.json(
      {
        success: false,
        data: {
          ...result,
          responseTimeMs: Date.now() - startTime,
        },
      },
      { status: 503 }
    )
  }

  // Check Zammad connection
  try {
    const zammadHealth = await checkZammadHealth()
    if (zammadHealth.isHealthy) {
      result.services.zammad = { status: "connected" }
    } else {
      result.services.zammad = {
        status: "error",
        message: zammadHealth.error || "Zammad connection failed",
      }
      result.status = "degraded"
    }
  } catch (error) {
    result.services.zammad = {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    }
    result.status = "degraded"
  }

  // Check database connection
  if (!process.env.DATABASE_URL) {
    result.services.database = {
      status: "error",
      message: "DATABASE_URL is not configured",
    }
    result.status = isProduction() ? "unhealthy" : "degraded"
  } else {
    try {
      // Simple query to verify database connection
      await prisma.$queryRaw`SELECT 1`
      result.services.database = { status: "connected" }
    } catch (error) {
      result.services.database = {
        status: "error",
        message: error instanceof Error ? error.message : "Database connection failed",
      }
      // Database failure makes the service unhealthy
      result.status = result.status === "degraded" ? "unhealthy" : "degraded"
    }
  }

  // Add response time
  const responseTime = Date.now() - startTime

  // Log health check result
  logger.info("Health", "Health check completed", {
    data: { status: result.status, responseTimeMs: responseTime },
  })

  const httpStatus =
    result.status === "healthy"
      ? 200
      : result.status === "degraded"
        ? 200
        : 503

  return NextResponse.json(
    {
      success: result.status !== "unhealthy",
      data: {
        ...result,
        responseTimeMs: responseTime,
      },
    },
    { status: httpStatus }
  )
}
