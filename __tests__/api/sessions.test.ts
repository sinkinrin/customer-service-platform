/**
 * Sessions API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

import { requireAuth } from '@/lib/utils/auth'

import { GET as GET_SESSIONS } from '@/app/api/sessions/route'
import { GET as GET_SESSION, DELETE as DELETE_SESSION } from '@/app/api/sessions/[id]/route'

function createRequest(url: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { headers })
}

describe('Sessions API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user_1' } as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/sessions', () => {
    it('returns mock session for valid requests', async () => {
      const request = createRequest('http://localhost:3000/api/sessions?page=1&limit=20', {
        'user-agent': 'test-agent',
      })
      const response = await GET_SESSIONS(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.sessions).toHaveLength(1)
      expect(payload.data.sessions[0].user_agent).toBe('test-agent')
    })

    it('returns empty sessions for invalid pagination', async () => {
      const request = createRequest('http://localhost:3000/api/sessions?page=0&limit=200')
      const response = await GET_SESSIONS(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.data.sessions).toHaveLength(0)
    })
  })

  describe('GET /api/sessions/[id]', () => {
    it('returns 404 for unknown session', async () => {
      const request = createRequest('http://localhost:3000/api/sessions/unknown')
      const response = await GET_SESSION(request, { params: Promise.resolve({ id: 'unknown' }) })
      expect(response.status).toBe(404)
    })

    it('returns session for current id', async () => {
      const request = createRequest('http://localhost:3000/api/sessions/mock-session-id', {
        'user-agent': 'test-agent',
      })
      const response = await GET_SESSION(request, { params: Promise.resolve({ id: 'mock-session-id' }) })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.session.id).toBe('mock-session-id')
    })
  })

  describe('DELETE /api/sessions/[id]', () => {
    it('returns 404 for unknown session', async () => {
      const request = createRequest('http://localhost:3000/api/sessions/unknown', { 'user-agent': 'test-agent' })
      const response = await DELETE_SESSION(request, { params: Promise.resolve({ id: 'unknown' }) })
      expect(response.status).toBe(404)
    })

    it('deletes current session', async () => {
      const request = createRequest('http://localhost:3000/api/sessions/mock-session-id')
      const response = await DELETE_SESSION(request, { params: Promise.resolve({ id: 'mock-session-id' }) })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.sessionId).toBe('mock-session-id')
    })
  })
})
