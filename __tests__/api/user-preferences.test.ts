/**
 * User Preferences API Integration Tests
 *
 * Tests for /api/user/preferences:
 * 1. Authentication required
 * 2. GET returns user notification preferences
 * 3. PUT updates preferences in Zammad
 * 4. Default preferences for mock users
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PUT } from '@/app/api/user/preferences/route'

// Mock auth module
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Mock Zammad client
vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
  },
}))

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'

// Test users
const mockCustomer = {
  id: 'cust_001',
  email: 'customer@test.com',
  role: 'customer' as const,
  full_name: 'Test Customer',
  region: 'asia-pacific',
  zammad_id: 100,
}

const mockZammadUserWithPrefs = {
  id: 100,
  email: 'customer@test.com',
  firstname: 'Test',
  lastname: 'Customer',
  preferences: {
    csp_notifications: {
      emailNotifications: false,
      desktopNotifications: true,
      ticketUpdates: false,
      conversationReplies: true,
      promotions: true,
    },
  },
}

const mockZammadUserNoPrefs = {
  id: 100,
  email: 'customer@test.com',
  firstname: 'Test',
  lastname: 'Customer',
  preferences: {},
}

describe('User Preferences API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/user/preferences', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('returns stored preferences from Zammad', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce(mockZammadUserWithPrefs)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.preferences).toEqual({
        emailNotifications: false,
        desktopNotifications: true,
        ticketUpdates: false,
        conversationReplies: true,
        promotions: true,
      })
    })

    it('returns default preferences when Zammad user has none', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce(mockZammadUserNoPrefs)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Should return defaults
      expect(data.data.preferences.emailNotifications).toBe(true)
      expect(data.data.preferences.desktopNotifications).toBe(false)
      expect(data.data.preferences.ticketUpdates).toBe(true)
      expect(data.data.preferences.conversationReplies).toBe(true)
      expect(data.data.preferences.promotions).toBe(false)
    })

    it('returns default preferences for mock users without zammad_id', async () => {
      const userWithoutZammad = { ...mockCustomer, zammad_id: undefined }
      vi.mocked(auth).mockResolvedValueOnce({
        user: userWithoutZammad,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.preferences.emailNotifications).toBe(true)
      expect(zammadClient.getUser).not.toHaveBeenCalled()
    })
  })

  describe('PUT /api/user/preferences', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ emailNotifications: false }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('updates preferences successfully in Zammad', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      // First call: getUser to fetch current preferences
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce(mockZammadUserNoPrefs)
      // Second call: updateUser with merged preferences
      vi.mocked(zammadClient.updateUser).mockResolvedValueOnce({
        ...mockZammadUserNoPrefs,
        preferences: {
          csp_notifications: {
            emailNotifications: false,
            desktopNotifications: true,
          },
        },
      })

      const request = new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          emailNotifications: false,
          desktopNotifications: true,
        }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.preferences.emailNotifications).toBe(false)
      expect(data.data.preferences.desktopNotifications).toBe(true)
      expect(zammadClient.updateUser).toHaveBeenCalledWith(100, expect.objectContaining({
        preferences: expect.objectContaining({
          csp_notifications: expect.objectContaining({
            emailNotifications: false,
            desktopNotifications: true,
          }),
        }),
      }))
    })

    it('returns local success for mock users without zammad_id', async () => {
      const userWithoutZammad = { ...mockCustomer, zammad_id: undefined }
      vi.mocked(auth).mockResolvedValueOnce({
        user: userWithoutZammad,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ promotions: true }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toContain('local only')
      expect(data.data.preferences.promotions).toBe(true)
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
    })

    it('validates input types for boolean preferences', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          emailNotifications: 'not-a-boolean', // Invalid type
        }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
