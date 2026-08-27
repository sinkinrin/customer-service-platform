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
    updateCurrentUserPreferences: vi.fn(),
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

    it('returns 409 without contacting Zammad when the expected user no longer matches', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const response = await GET(new NextRequest('http://localhost/api/user/preferences', {
        headers: {
          'X-CSP-Expected-User-Id': 'cust_previous',
        },
      }))
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toMatchObject({
        success: false,
        error: { code: 'IDENTITY_CHANGED' },
      })
      expect(zammadClient.getUser).not.toHaveBeenCalled()
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
      expect(zammadClient.updateCurrentUserPreferences).not.toHaveBeenCalled()
    })

    it('falls back to legacy notification preferences', async () => {
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

    it('prefers independent top-level keys over conflicting legacy values', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce({
        ...mockZammadUserWithPrefs,
        preferences: {
          ...mockZammadUserWithPrefs.preferences,
          csp_notification_email: true,
          csp_notification_desktop: false,
        },
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.preferences).toEqual({
        emailNotifications: true,
        desktopNotifications: false,
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

    it('returns 409 without contacting Zammad when the expected user no longer matches', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        headers: {
          'X-CSP-Expected-User-Id': 'cust_previous',
        },
        body: JSON.stringify({ emailNotifications: false }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toMatchObject({
        success: false,
        error: { code: 'IDENTITY_CHANGED' },
      })
      expect(zammadClient.getUser).not.toHaveBeenCalled()
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
      expect(zammadClient.updateCurrentUserPreferences).not.toHaveBeenCalled()
    })

    it('writes only the independent keys present in the request', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { ...mockCustomer, email: 'stale-session@test.com' },
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce({
        ...mockZammadUserNoPrefs,
        preferences: {
          locale: 'en',
          csp_notifications: {
            ticketUpdates: false,
          },
        },
      })
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockResolvedValueOnce({ message: 'ok' })

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
      expect(data.data.preferences.ticketUpdates).toBe(false)
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
      expect(zammadClient.updateCurrentUserPreferences).toHaveBeenCalledWith(
        {
          csp_notification_email: false,
          csp_notification_desktop: true,
        },
        '100'
      )
    })

    it('confirms requested preference keys after an ambiguous write response', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser)
        .mockResolvedValueOnce(mockZammadUserNoPrefs)
        .mockResolvedValueOnce({
          ...mockZammadUserNoPrefs,
          preferences: {
            csp_notification_email: false,
            csp_notification_promotions: true,
          },
        })
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        new Error('Response lost')
      )

      const response = await PUT(new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ emailNotifications: false, promotions: true }),
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toMatchObject({
        updateStatus: 'confirmed-after-error',
        preferences: {
          emailNotifications: false,
          promotions: true,
        },
      })
      expect(zammadClient.getUser).toHaveBeenCalledTimes(2)
    })

    it('reconciles requested preference keys after a 408 write response', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser)
        .mockResolvedValueOnce(mockZammadUserNoPrefs)
        .mockResolvedValueOnce({
          ...mockZammadUserNoPrefs,
          preferences: {
            csp_notification_email: false,
          },
        })
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        Object.assign(new Error('Preference request timed out'), { status: 408 })
      )

      const response = await PUT(new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ emailNotifications: false }),
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toMatchObject({
        updateStatus: 'confirmed-after-error',
        preferences: { emailNotifications: false },
      })
      expect(zammadClient.getUser).toHaveBeenCalledTimes(2)
    })

    it('returns OUTCOME_UNCONFIRMED when requested keys do not match after an ambiguous write', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser)
        .mockResolvedValueOnce(mockZammadUserNoPrefs)
        .mockResolvedValueOnce(mockZammadUserNoPrefs)
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        new Error('Response lost')
      )

      const response = await PUT(new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ emailNotifications: false }),
      }))
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toMatchObject({
        code: 'OUTCOME_UNCONFIRMED',
        details: { fields: ['emailNotifications'] },
      })
    })

    it('returns OUTCOME_UNCONFIRMED when preference reconciliation fails', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser)
        .mockResolvedValueOnce(mockZammadUserNoPrefs)
        .mockRejectedValueOnce(new Error('Read-back unavailable'))
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        new Error('Response lost')
      )

      const response = await PUT(new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ promotions: true }),
      }))
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error.code).toBe('OUTCOME_UNCONFIRMED')
    })

    it('maps a definitive preference 4xx to PREFERENCES_REJECTED', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce(mockZammadUserNoPrefs)
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        Object.assign(new Error('Validation failed'), { status: 422 })
      )

      const response = await PUT(new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ promotions: true }),
      }))
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.error).toMatchObject({
        code: 'PREFERENCES_REJECTED',
        details: { upstreamStatus: 422 },
      })
      expect(zammadClient.getUser).toHaveBeenCalledTimes(1)
    })

    it('skips the preference write when no fields are supplied', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce(mockZammadUserWithPrefs)

      const response = await PUT(new NextRequest('http://localhost/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({}),
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.updateStatus).toBe('unchanged')
      expect(zammadClient.updateCurrentUserPreferences).not.toHaveBeenCalled()
    })

    it('retains concurrent updates to different notification fields', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const sharedPreferences: Record<string, unknown> = {}
      let readCount = 0
      let releaseReads: (() => void) | undefined
      const bothReadsStarted = new Promise<void>((resolve) => {
        releaseReads = resolve
      })

      vi.mocked(zammadClient.getUser).mockImplementation(async () => {
        const preferencesSnapshot = { ...sharedPreferences }
        readCount += 1
        if (readCount === 2) {
          releaseReads?.()
        }
        await bothReadsStarted
        return {
          ...mockZammadUserNoPrefs,
          preferences: preferencesSnapshot,
        }
      })
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockImplementation(async (updates) => {
        Object.assign(sharedPreferences, updates)
        return { message: 'ok' }
      })

      const [emailResponse, promotionResponse] = await Promise.all([
        PUT(new NextRequest('http://localhost/api/user/preferences', {
          method: 'PUT',
          body: JSON.stringify({ emailNotifications: false }),
        })),
        PUT(new NextRequest('http://localhost/api/user/preferences', {
          method: 'PUT',
          body: JSON.stringify({ promotions: true }),
        })),
      ])

      expect(emailResponse.status).toBe(200)
      expect(promotionResponse.status).toBe(200)
      expect(sharedPreferences).toEqual({
        csp_notification_email: false,
        csp_notification_promotions: true,
      })
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
      expect(zammadClient.updateCurrentUserPreferences).not.toHaveBeenCalled()
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
