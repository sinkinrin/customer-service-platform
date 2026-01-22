/**
 * API Logger Utility
 *
 * Provides request-scoped logging for API routes with automatic
 * request ID extraction from headers.
 *
 * @example
 * // In API route handler
 * import { getApiLogger } from '@/lib/utils/api-logger'
 *
 * export async function GET(request: NextRequest) {
 *   const log = getApiLogger('TicketAPI', request)
 *
 *   log.info('Fetching tickets')
 *   try {
 *     const tickets = await fetchTickets()
 *     log.info('Fetched tickets', { count: tickets.length })
 *     return successResponse(tickets)
 *   } catch (error) {
 *     log.error('Failed to fetch tickets', { error: error.message })
 *     return serverErrorResponse('Failed to fetch tickets')
 *   }
 * }
 */

import { NextRequest } from 'next/server'
import { logger } from './logger'

/**
 * Request-scoped logger interface
 */
export interface RequestLogger {
  debug: (message: string, data?: unknown) => void
  info: (message: string, data?: unknown) => void
  warning: (message: string, data?: unknown) => void
  error: (message: string, data?: unknown) => void
  /** The request ID for this request */
  requestId: string | undefined
}

/**
 * Get request ID from NextRequest headers
 */
export function getRequestId(request: NextRequest): string | undefined {
  const headers = (request as any)?.headers

  // NextRequest: headers is a Headers instance with .get()
  if (headers && typeof headers.get === 'function') {
    return headers.get('x-request-id') || undefined
  }

  // Tests/mocks may pass a plain object-like headers bag
  if (headers && typeof headers === 'object') {
    const value = (headers['x-request-id'] ?? headers['X-Request-Id']) as unknown
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  return undefined
}

/**
 * Create a request-scoped logger for API routes
 *
 * Automatically extracts request ID from the request headers
 * (set by middleware) and includes it in all log entries.
 *
 * @param module - The module/component name for log categorization
 * @param request - The NextRequest object (to extract request ID)
 * @returns A logger with bound request ID
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const log = getApiLogger('TicketAPI', request)
 *   log.info('Creating ticket', { title: 'Bug report' })
 *   // Output: [2025-01-22 10:30:45] [INFO] [TicketAPI] [G4-S-15-...] Creating ticket
 * }
 */
export function getApiLogger(module: string, request: NextRequest): RequestLogger {
  const requestId = getRequestId(request)

  return {
    requestId,
    debug: (message: string, data?: unknown) => {
      logger.debug(module, message, { requestId, data })
    },
    info: (message: string, data?: unknown) => {
      logger.info(module, message, { requestId, data })
    },
    warning: (message: string, data?: unknown) => {
      logger.warning(module, message, { requestId, data })
    },
    error: (message: string, data?: unknown) => {
      logger.error(module, message, { requestId, data })
    },
  }
}

/**
 * Create a logger with a known request ID
 *
 * Use this when you already have the request ID (e.g., from context)
 * and don't have access to the NextRequest object.
 *
 * @param module - The module/component name
 * @param requestId - The request ID string
 * @returns A logger with bound request ID
 */
export function createApiLogger(module: string, requestId?: string): RequestLogger {
  return {
    requestId,
    debug: (message: string, data?: unknown) => {
      logger.debug(module, message, { requestId, data })
    },
    info: (message: string, data?: unknown) => {
      logger.info(module, message, { requestId, data })
    },
    warning: (message: string, data?: unknown) => {
      logger.warning(module, message, { requestId, data })
    },
    error: (message: string, data?: unknown) => {
      logger.error(module, message, { requestId, data })
    },
  }
}
