/**
 * API Response 工具函数单元测试
 */

import { describe, it, expect } from 'vitest'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
  serviceUnavailableResponse,
} from '@/lib/utils/api-response'

describe('successResponse', () => {
  it('should return 200 status by default', async () => {
    const response = successResponse({ message: 'OK' })
    expect(response.status).toBe(200)
  })

  it('should return custom status code', async () => {
    const response = successResponse({ message: 'Created' }, 201)
    expect(response.status).toBe(201)
  })

  it('should return JSON with success true', async () => {
    const response = successResponse({ id: 1, name: 'Test' })
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual({ id: 1, name: 'Test' })
  })

  it('should set correct content-type header', () => {
    const response = successResponse({ message: 'OK' })
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })
})

describe('errorResponse', () => {
  it('should return error with message', async () => {
    const response = errorResponse('BAD_REQUEST', 'Something went wrong', undefined, 400)
    const json = await response.json()
    expect(json.success).toBe(false)
    expect(json.error.message).toBe('Something went wrong')
    expect(response.status).toBe(400)
  })

  it('should include error code', async () => {
    const response = errorResponse('VALIDATION_ERROR', 'Invalid input')
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('should include details if provided', async () => {
    const details = { field: 'email', reason: 'invalid format' }
    const response = errorResponse('VALIDATION_ERROR', 'Invalid input', details)
    const json = await response.json()
    expect(json.error.details).toEqual(details)
  })
})

describe('unauthorizedResponse', () => {
  it('should return 401 status', async () => {
    const response = unauthorizedResponse()
    expect(response.status).toBe(401)
  })

  it('should return default message', async () => {
    const response = unauthorizedResponse()
    const json = await response.json()
    expect(json.error.message).toContain('Unauthorized')
  })

  it('should accept custom message', async () => {
    const response = unauthorizedResponse('Please login first')
    const json = await response.json()
    expect(json.error.message).toBe('Please login first')
  })
})

describe('forbiddenResponse', () => {
  it('should return 403 status', async () => {
    const response = forbiddenResponse()
    expect(response.status).toBe(403)
  })

  it('should return default message', async () => {
    const response = forbiddenResponse()
    const json = await response.json()
    expect(json.error.message).toContain('Forbidden')
  })
})

describe('notFoundResponse', () => {
  it('should return 404 status', async () => {
    const response = notFoundResponse()
    expect(response.status).toBe(404)
  })

  it('should accept resource name', async () => {
    const response = notFoundResponse('User')
    const json = await response.json()
    expect(json.error.message).toContain('User')
  })
})

describe('validationErrorResponse', () => {
  it('should return 400 status', async () => {
    const response = validationErrorResponse({ email: 'Invalid email' })
    expect(response.status).toBe(400)
  })

  it('should include validation errors', async () => {
    const errors = { email: 'Invalid email', password: 'Too short' }
    const response = validationErrorResponse(errors)
    const json = await response.json()
    expect(json.error.details).toEqual(errors)
  })
})

describe('serverErrorResponse', () => {
  it('should return 500 status', async () => {
    const response = serverErrorResponse()
    expect(response.status).toBe(500)
  })

  it('should return generic message', async () => {
    const response = serverErrorResponse()
    const json = await response.json()
    expect(json.error.message).toContain('Internal')
  })
})

describe('serviceUnavailableResponse', () => {
  it('should return 503 status', async () => {
    const response = serviceUnavailableResponse()
    expect(response.status).toBe(503)
  })

  it('should accept service name', async () => {
    const response = serviceUnavailableResponse('Zammad')
    const json = await response.json()
    expect(json.error.message).toContain('Zammad')
  })
})
