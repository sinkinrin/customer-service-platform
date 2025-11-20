/**
 * API Response Utilities
 * 
 * Helper functions for creating consistent API responses
 */

import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api.types'

export function successResponse<T>(data: T, status: number = 200): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
  }
  return NextResponse.json(response, { status })
}

export function errorResponse(
  code: string,
  message: string,
  details?: any,
  status: number = 400
): NextResponse {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  }
  return NextResponse.json(response, { status })
}

export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return errorResponse('UNAUTHORIZED', message, undefined, 401)
}

export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return errorResponse('FORBIDDEN', message, undefined, 403)
}

export function notFoundResponse(message: string = 'Not found'): NextResponse {
  return errorResponse('NOT_FOUND', message, undefined, 404)
}

export function validationErrorResponse(details: any): NextResponse {
  return errorResponse('VALIDATION_ERROR', 'Validation failed', details, 400)
}

export function serverErrorResponse(
  message: string = 'Internal server error',
  details?: any,
  status: number = 500
): NextResponse {
  return errorResponse('INTERNAL_ERROR', message, details, status)
}

export function serviceUnavailableResponse(
  message: string = 'Service temporarily unavailable',
  details?: any
): NextResponse {
  return errorResponse('SERVICE_UNAVAILABLE', message, details, 503)
}

