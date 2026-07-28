/**
 * User Profile API Integration Tests
 *
 * Tests for /api/user/profile:
 * 1. Authentication required
 * 2. GET returns user profile
 * 3. PUT updates profile in Zammad
 * 4. Validation errors for invalid input
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PUT } from '@/app/api/user/profile/route'

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
import { logger } from '@/lib/utils/logger'

// Test users
const mockCustomer = {
  id: 'cust_001',
  email: 'customer@test.com',
  role: 'customer' as const,
  full_name: 'Test Customer',
  phone: '+1234567890',
  language: 'en',
  region: 'asia-pacific',
  zammad_id: 100,
}

const mockZammadUser = {
  id: 100,
  email: 'customer@test.com',
  firstname: 'Test',
  lastname: 'Customer',
  phone: '+1234567890',
  preferences: {
    locale: 'en',
  },
}

describe('User Profile API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/user/profile', () => {
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

      const response = await GET(new NextRequest('http://localhost/api/user/profile', {
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

    it('returns profile from Zammad when user has zammad_id', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce(mockZammadUser)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.profile).toBeDefined()
      expect(data.data.profile.email).toBe('customer@test.com')
      expect(data.data.profile.full_name).toBe('Test Customer')
      expect(zammadClient.getUser).toHaveBeenCalledWith(100)
    })

    it('returns session data when no zammad_id', async () => {
      const userWithoutZammad = { ...mockCustomer, zammad_id: undefined }
      vi.mocked(auth).mockResolvedValueOnce({
        user: userWithoutZammad,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.profile.full_name).toBe('Test Customer')
      expect(zammadClient.getUser).not.toHaveBeenCalled()
    })

    it('falls back to session data when Zammad fetch fails', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser).mockRejectedValueOnce(new Error('Zammad unavailable'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.profile.full_name).toBe('Test Customer')
    })
  })

  describe('PUT /api/user/profile', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: 'New Name' }),
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

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        headers: {
          'X-CSP-Expected-User-Id': 'cust_previous',
        },
        body: JSON.stringify({ full_name: 'Stale Client Update' }),
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

    it('updates profile fields and locale without rewriting the preferences object', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { ...mockCustomer, email: 'stale-session@test.com' },
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Updated',
        lastname: 'Name',
      })
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockResolvedValueOnce({ message: 'ok' })

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: 'Updated Name',
          phone: '+9876543210',
          language: 'zh-CN',
        }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.outcome).toBe('complete')
      expect(data.data.profile.full_name).toBe('Updated Name')
      expect(data.data.profile.language).toBe('zh-CN')
      expect(zammadClient.updateUser).toHaveBeenCalledWith(100, {
        firstname: 'Updated',
        lastname: 'Name',
        phone: '+9876543210',
      })
      expect(zammadClient.getUser).not.toHaveBeenCalled()
      expect(zammadClient.updateCurrentUserPreferences).toHaveBeenCalledWith(
        { locale: 'zh-CN' },
        '100'
      )
    })

    it('confirms ordinary profile fields after an ambiguous write response', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(new Error('Response lost'))
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Confirmed',
        lastname: 'Customer',
        phone: '+44111111111',
      })

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: 'Confirmed Customer',
          phone: '+44111111111',
        }),
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toMatchObject({
        outcome: 'complete',
        profileStatus: 'confirmed-after-error',
        profile: {
          full_name: 'Confirmed Customer',
          phone: '+44111111111',
        },
      })
      expect(zammadClient.getUser).toHaveBeenCalledTimes(1)
      expect(zammadClient.updateCurrentUserPreferences).not.toHaveBeenCalled()
    })

    it('reconciles ordinary profile fields after a 408 write response', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(
        Object.assign(new Error('Profile request timed out'), { status: 408 })
      )
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Timed',
        lastname: 'Out',
        phone: '+44122222222',
      })

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: 'Timed Out',
          phone: '+44122222222',
        }),
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toMatchObject({
        outcome: 'complete',
        profileStatus: 'confirmed-after-error',
        profile: {
          full_name: 'Timed Out',
          phone: '+44122222222',
        },
      })
      expect(zammadClient.getUser).toHaveBeenCalledTimes(1)
    })

    it('returns OUTCOME_UNCONFIRMED when ordinary fields do not match after an ambiguous write', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(new Error('Response lost'))
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce(mockZammadUser)

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: 'Unconfirmed Name', language: 'fr' }),
      }))
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toMatchObject({
        code: 'OUTCOME_UNCONFIRMED',
        details: {
          phase: 'profile',
          fields: ['full_name'],
        },
      })
      expect(zammadClient.updateCurrentUserPreferences).not.toHaveBeenCalled()
    })

    it('returns OUTCOME_UNCONFIRMED when ordinary-field reconciliation fails', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(new Error('Response lost'))
      vi.mocked(zammadClient.getUser).mockRejectedValueOnce(new Error('Read-back unavailable'))

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ phone: '+44111111111' }),
      }))
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error.code).toBe('OUTCOME_UNCONFIRMED')
      expect(data.error.details).toMatchObject({ phase: 'profile', fields: ['phone'] })
    })

    it('maps a definitive ordinary-field 4xx to PROFILE_REJECTED without locale side effects', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(
        Object.assign(new Error('Validation failed'), { status: 422 })
      )

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: 'Rejected Name', language: 'fr' }),
      }))
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.error).toMatchObject({
        code: 'PROFILE_REJECTED',
        details: { upstreamStatus: 422 },
      })
      expect(zammadClient.getUser).not.toHaveBeenCalled()
      expect(zammadClient.updateCurrentUserPreferences).not.toHaveBeenCalled()
    })

    it('uses the locked preference endpoint for a locale-only update', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce({
        ...mockZammadUser,
        preferences: {
          locale: 'en',
          csp_notifications: {
            emailNotifications: false,
          },
        },
      } as any)
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockResolvedValueOnce({ message: 'ok' })

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ language: 'fr' }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.outcome).toBe('complete')
      expect(data.data.profile.language).toBe('fr')
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
      expect(zammadClient.updateCurrentUserPreferences).toHaveBeenCalledWith(
        { locale: 'fr' },
        '100'
      )
    })

    it('maps a definitive locale-only 4xx to LOCALE_REJECTED', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser)
        .mockResolvedValueOnce(mockZammadUser)
        .mockResolvedValueOnce(mockZammadUser)
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        Object.assign(new Error('Locale rejected'), { status: 422 })
      )

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ language: 'fr' }),
      }))
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.error).toMatchObject({
        code: 'LOCALE_REJECTED',
        details: { upstreamStatus: 422 },
      })
    })

    it('returns OUTCOME_UNCONFIRMED for a locale-only ambiguous response that reads back old state', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.getUser)
        .mockResolvedValueOnce(mockZammadUser)
        .mockResolvedValueOnce(mockZammadUser)
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        new Error('Response lost')
      )

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ language: 'fr' }),
      }))
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toMatchObject({
        code: 'OUTCOME_UNCONFIRMED',
        details: {
          phase: 'locale',
          requestedLocale: 'fr',
          observedLocale: 'en',
        },
      })
    })

    it('treats a rejected locale response as complete when confirmation shows it committed', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Committed',
        lastname: 'Profile',
      })
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        new Error('Response lost')
      )
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Committed',
        lastname: 'Profile',
        preferences: { locale: 'fr' },
      })

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: 'Committed Profile', language: 'fr' }),
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.outcome).toBe('complete')
      expect(data.data.profile).toMatchObject({
        full_name: 'Committed Profile',
        language: 'fr',
      })
      expect(logger.warning).not.toHaveBeenCalled()
    })

    it('returns an unconfirmed partial outcome when profile fields commit but an ambiguous locale response reads back old state', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Committed',
        lastname: 'Profile',
        phone: '+44123456789',
      })
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        new Error('Locale write failed')
      )
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Committed',
        lastname: 'Profile',
        phone: '+44123456789',
        preferences: { locale: 'en' },
      })

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: 'Committed Profile',
          phone: '+44123456789',
          language: 'fr',
        }),
      }))
      const data = await response.json()

      expect(response.status).toBe(207)
      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        outcome: 'partial',
        profile: {
          full_name: 'Committed Profile',
          phone: '+44123456789',
          language: 'en',
        },
        locale: {
          status: 'unconfirmed',
          requested: 'fr',
          actual: 'en',
        },
      })
      expect(logger.warning).toHaveBeenCalledWith(
        'UserProfile',
        'Profile fields updated but locale outcome remains unconfirmed',
        expect.objectContaining({
          data: expect.objectContaining({
            localeError: 'Locale write failed',
            actualLocale: 'en',
          }),
        })
      )
    })

    it('classifies a 408 locale response as unconfirmed when read-back shows the old locale', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Committed',
        lastname: 'Profile',
      })
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        Object.assign(new Error('Locale request timed out'), { status: 408 })
      )
      vi.mocked(zammadClient.getUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Committed',
        lastname: 'Profile',
        preferences: { locale: 'en' },
      })

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: 'Committed Profile', language: 'fr' }),
      }))
      const data = await response.json()

      expect(response.status).toBe(207)
      expect(data.data).toMatchObject({
        outcome: 'partial',
        locale: {
          status: 'unconfirmed',
          requested: 'fr',
          actual: 'en',
        },
      })
      expect(data.data.locale.status).not.toBe('rejected')
    })

    it('keeps a definitive locale rejection classified as rejected when confirmation fails', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Committed',
        lastname: 'Profile',
      })
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        Object.assign(new Error('Locale rejected'), { status: 422 })
      )
      vi.mocked(zammadClient.getUser).mockRejectedValueOnce(
        new Error('Confirmation unavailable')
      )

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: 'Committed Profile', language: 'fr' }),
      }))
      const data = await response.json()

      expect(response.status).toBe(207)
      expect(data.data).toMatchObject({
        outcome: 'partial',
        locale: {
          status: 'rejected',
          requested: 'fr',
          actual: null,
        },
      })
    })

    it('returns an unconfirmed partial outcome when locale confirmation also fails', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Committed',
        lastname: 'Profile',
      })
      vi.mocked(zammadClient.updateCurrentUserPreferences).mockRejectedValueOnce(
        new Error('Locale write failed')
      )
      vi.mocked(zammadClient.getUser).mockRejectedValueOnce(
        new Error('Confirmation unavailable')
      )

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: 'Committed Profile', language: 'fr' }),
      }))
      const data = await response.json()

      expect(response.status).toBe(207)
      expect(data.data).toMatchObject({
        outcome: 'partial',
        profile: {
          full_name: 'Committed Profile',
          language: 'en',
        },
        locale: {
          status: 'unconfirmed',
          requested: 'fr',
          actual: null,
        },
      })
      expect(logger.warning).toHaveBeenCalledWith(
        'UserProfile',
        'Profile fields updated but locale outcome could not be confirmed',
        expect.objectContaining({
          data: expect.objectContaining({
            localeError: 'Locale write failed',
            confirmationError: 'Confirmation unavailable',
          }),
        })
      )
    })

    it('rejects unsupported profile locales', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ language: 'de' }),
      })

      const response = await PUT(request)

      expect(response.status).toBe(400)
      expect(zammadClient.getUser).not.toHaveBeenCalled()
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
      expect(zammadClient.updateCurrentUserPreferences).not.toHaveBeenCalled()
    })

    it('returns local success when no zammad_id (mock users)', async () => {
      const userWithoutZammad = { ...mockCustomer, zammad_id: undefined }
      vi.mocked(auth).mockResolvedValueOnce({
        user: userWithoutZammad,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: 'New Name' }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toContain('local only')
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
      expect(zammadClient.updateCurrentUserPreferences).not.toHaveBeenCalled()
    })

    it('validates input and returns error for empty name', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: '' }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('validates input and returns error for a whitespace-only name', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const response = await PUT(new NextRequest('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: '   ' }),
      }))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
    })
  })
})
