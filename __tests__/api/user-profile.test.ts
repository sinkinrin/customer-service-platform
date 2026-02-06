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

    it('updates profile successfully in Zammad', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })
      vi.mocked(zammadClient.updateUser).mockResolvedValueOnce({
        ...mockZammadUser,
        firstname: 'Updated',
        lastname: 'Name',
      })

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
      expect(data.data.profile.full_name).toBe('Updated Name')
      expect(zammadClient.updateUser).toHaveBeenCalledWith(100, expect.objectContaining({
        firstname: 'Updated',
        lastname: 'Name',
        phone: '+9876543210',
        preferences: { locale: 'zh-CN' },
      }))
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
  })
})
