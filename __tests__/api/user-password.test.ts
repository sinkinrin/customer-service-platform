/**
 * User Password API Integration Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PUT } from '@/app/api/user/password/route'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    authenticateUserStrict: vi.fn(),
    updateUser: vi.fn(),
  },
}))

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'

const mockCustomer = {
  id: 'cust_001',
  email: 'customer@test.com',
  role: 'customer' as const,
  full_name: 'Test Customer',
  region: 'asia-pacific',
  zammad_id: 100,
}

const mockZammadUser = {
  id: 100,
  email: 'customer@test.com',
  firstname: 'Test',
  lastname: 'Customer',
}

const currentPassword = 'current-password'
const newPassword = 'new-password-123'

function mockAuthenticatedSession() {
  vi.mocked(auth).mockResolvedValueOnce({
    user: mockCustomer,
    expires: new Date(Date.now() + 3600000).toISOString(),
  })
}

function createPasswordRequest(expectedUserId: string = mockCustomer.id): NextRequest {
  return new NextRequest('http://localhost/api/user/password', {
    method: 'PUT',
    headers: {
      'X-CSP-Expected-User-Id': expectedUserId,
    },
    body: JSON.stringify({
      currentPassword,
      newPassword,
      confirmPassword: newPassword,
    }),
  })
}

describe('User Password API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('PUT /api/user/password', () => {
    it('returns 409 without authenticating or updating when the expected user no longer matches', async () => {
      mockAuthenticatedSession()

      const response = await PUT(createPasswordRequest('cust_previous'))
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toMatchObject({
        success: false,
        error: { code: 'IDENTITY_CHANGED' },
      })
      expect(zammadClient.authenticateUserStrict).not.toHaveBeenCalled()
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
    })

    it('updates the password once when Zammad returns a normal success response', async () => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict).mockResolvedValueOnce(mockZammadUser as any)
      vi.mocked(zammadClient.updateUser).mockResolvedValueOnce(mockZammadUser as any)

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toMatchObject({
        updateStatus: 'updated',
        message: 'Password updated successfully',
      })
      expect(zammadClient.authenticateUserStrict).toHaveBeenCalledTimes(1)
      expect(zammadClient.authenticateUserStrict).toHaveBeenCalledWith(
        mockCustomer.email,
        currentPassword
      )
      expect(zammadClient.updateUser).toHaveBeenCalledTimes(1)
      expect(zammadClient.updateUser).toHaveBeenCalledWith(mockCustomer.zammad_id, {
        password: newPassword,
      })
    })

    it('returns a current-password validation error when credentials are rejected', async () => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict).mockResolvedValueOnce(null)

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      })
      expect(zammadClient.authenticateUserStrict).toHaveBeenCalledWith(
        mockCustomer.email,
        currentPassword
      )
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
    })

    it('returns 503 without writing when current-password verification is unavailable', async () => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict).mockRejectedValueOnce(
        Object.assign(new Error('Zammad unavailable'), { status: 503 })
      )

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data).toMatchObject({
        success: false,
        error: { code: 'CURRENT_PASSWORD_VERIFICATION_UNAVAILABLE' },
      })
      expect(zammadClient.authenticateUserStrict).toHaveBeenCalledTimes(1)
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
    })

    it('rejects a current-password authentication result for a different Zammad user', async () => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict).mockResolvedValueOnce({
        ...mockZammadUser,
        id: 101,
      } as any)

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('ACCOUNT_IDENTITY_MISMATCH')
      expect(zammadClient.authenticateUserStrict).toHaveBeenCalledTimes(1)
      expect(zammadClient.authenticateUserStrict).toHaveBeenCalledWith(
        mockCustomer.email,
        currentPassword
      )
      expect(zammadClient.updateUser).not.toHaveBeenCalled()
    })

    it('maps an explicit update 404 to NOT_FOUND without reconciliation', async () => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict).mockResolvedValueOnce(mockZammadUser as any)
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(
        Object.assign(new Error('User not found'), { status: 404 })
      )

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(zammadClient.authenticateUserStrict).toHaveBeenCalledTimes(1)
      expect(zammadClient.updateUser).toHaveBeenCalledTimes(1)
    })

    it.each([400, 422])(
      'maps an explicit update %i to PASSWORD_REJECTED without reconciliation',
      async (status) => {
        mockAuthenticatedSession()
        vi.mocked(zammadClient.authenticateUserStrict).mockResolvedValueOnce(mockZammadUser as any)
        vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(
          Object.assign(new Error('Password policy rejected the update'), { status })
        )

        const response = await PUT(createPasswordRequest())
        const data = await response.json()

        expect(response.status).toBe(422)
        expect(data.error).toMatchObject({
          code: 'PASSWORD_REJECTED',
          details: { upstreamStatus: status },
        })
        expect(zammadClient.authenticateUserStrict).toHaveBeenCalledTimes(1)
        expect(zammadClient.updateUser).toHaveBeenCalledTimes(1)
      }
    )

    it.each([401, 403])(
      'maps an explicit update %i to PASSWORD_UPDATE_AUTHORIZATION_FAILED without reconciliation',
      async (status) => {
        mockAuthenticatedSession()
        vi.mocked(zammadClient.authenticateUserStrict).mockResolvedValueOnce(mockZammadUser as any)
        vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(
          Object.assign(new Error('Update authorization rejected'), { status })
        )

        const response = await PUT(createPasswordRequest())
        const data = await response.json()

        expect(response.status).toBe(502)
        expect(data.error).toMatchObject({
          code: 'PASSWORD_UPDATE_AUTHORIZATION_FAILED',
          details: { upstreamStatus: status },
        })
        expect(zammadClient.authenticateUserStrict).toHaveBeenCalledTimes(1)
        expect(zammadClient.updateUser).toHaveBeenCalledTimes(1)
      }
    )

    it('maps another definite update 4xx to PASSWORD_UPDATE_REJECTED without reconciliation', async () => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict).mockResolvedValueOnce(mockZammadUser as any)
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(
        Object.assign(new Error('Conflict'), { status: 409 })
      )

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.error).toMatchObject({
        code: 'PASSWORD_UPDATE_REJECTED',
        details: { upstreamStatus: 409 },
      })
      expect(zammadClient.authenticateUserStrict).toHaveBeenCalledTimes(1)
      expect(zammadClient.updateUser).toHaveBeenCalledTimes(1)
    })

    it('reconciles an update 408 by authenticating with the new password', async () => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict)
        .mockResolvedValueOnce(mockZammadUser as any)
        .mockResolvedValueOnce(mockZammadUser as any)
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(
        Object.assign(new Error('Request timeout'), { status: 408 })
      )

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.updateStatus).toBe('confirmed-after-error')
      expect(vi.mocked(zammadClient.authenticateUserStrict).mock.calls).toEqual([
        [mockCustomer.email, currentPassword],
        [mockCustomer.email, newPassword],
      ])
      expect(zammadClient.updateUser).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['network failure', new TypeError('fetch failed')],
      ['upstream 5xx', Object.assign(new Error('upstream failed'), { status: 503 })],
      ['successful response body parse failure', new SyntaxError('Unexpected end of JSON input')],
    ])('confirms the new password after an ambiguous %s', async (_caseName, updateError) => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict)
        .mockResolvedValueOnce(mockZammadUser as any)
        .mockResolvedValueOnce(mockZammadUser as any)
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(updateError)

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toMatchObject({
        updateStatus: 'confirmed-after-error',
        message: 'Password updated successfully',
      })
      expect(vi.mocked(zammadClient.authenticateUserStrict).mock.calls).toEqual([
        [mockCustomer.email, currentPassword],
        [mockCustomer.email, newPassword],
      ])
      expect(zammadClient.updateUser).toHaveBeenCalledTimes(1)
    })

    it('returns OUTCOME_UNCONFIRMED when new-password authentication returns null', async () => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict)
        .mockResolvedValueOnce(mockZammadUser as any)
        .mockResolvedValueOnce(null)
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(new Error('response lost'))

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toMatchObject({
        code: 'OUTCOME_UNCONFIRMED',
        details: { phase: 'password' },
      })
      expect(zammadClient.updateUser).toHaveBeenCalledTimes(1)
    })

    it('returns OUTCOME_UNCONFIRMED when new-password authentication throws', async () => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict)
        .mockResolvedValueOnce(mockZammadUser as any)
        .mockRejectedValueOnce(new Error('authentication service unavailable'))
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(new Error('response lost'))

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error.code).toBe('OUTCOME_UNCONFIRMED')
      expect(zammadClient.updateUser).toHaveBeenCalledTimes(1)
    })

    it('returns OUTCOME_UNCONFIRMED when new-password authentication resolves another user', async () => {
      mockAuthenticatedSession()
      vi.mocked(zammadClient.authenticateUserStrict)
        .mockResolvedValueOnce(mockZammadUser as any)
        .mockResolvedValueOnce({ ...mockZammadUser, id: 101 } as any)
      vi.mocked(zammadClient.updateUser).mockRejectedValueOnce(new Error('response lost'))

      const response = await PUT(createPasswordRequest())
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error.code).toBe('OUTCOME_UNCONFIRMED')
      expect(zammadClient.updateUser).toHaveBeenCalledTimes(1)
    })
  })
})
