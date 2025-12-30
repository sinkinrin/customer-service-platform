/**
 * Admin triggers API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getTriggers: vi.fn(),
    createTrigger: vi.fn(),
    getTrigger: vi.fn(),
    updateTrigger: vi.fn(),
    deleteTrigger: vi.fn(),
    findTriggerByName: vi.fn(),
  },
}))

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'

import { GET as GET_TRIGGERS, POST as POST_TRIGGERS } from '@/app/api/admin/triggers/route'
import { GET as GET_TRIGGER, PUT as PUT_TRIGGER, DELETE as DELETE_TRIGGER } from '@/app/api/admin/triggers/[id]/route'
import { POST as POST_TRIGGERS_SETUP } from '@/app/api/admin/triggers/setup/route'

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Admin triggers APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/admin/triggers', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const response = await GET_TRIGGERS()
      expect(response.status).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'staff' } } as any)

      const response = await GET_TRIGGERS()
      expect(response.status).toBe(403)
    })

    it('returns triggers for admin users', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any)
      vi.mocked(zammadClient.getTriggers).mockResolvedValue([{ id: 1 }, { id: 2 }] as any)

      const response = await GET_TRIGGERS()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.count).toBe(2)
    })
  })

  describe('POST /api/admin/triggers', () => {
    it('validates required fields', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any)

      const request = createRequest('http://localhost:3000/api/admin/triggers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Missing condition' }),
      })
      const response = await POST_TRIGGERS(request)

      expect(response.status).toBe(400)
    })

    it('creates trigger for admin users', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any)
      vi.mocked(zammadClient.createTrigger).mockResolvedValue({ id: 10, name: 'New' } as any)

      const request = createRequest('http://localhost:3000/api/admin/triggers', {
        method: 'POST',
        body: JSON.stringify({ name: 'New', condition: {}, perform: {} }),
      })
      const response = await POST_TRIGGERS(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(zammadClient.createTrigger).toHaveBeenCalled()
    })
  })

  describe('Trigger detail endpoints', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any)
    })

    it('returns 400 for invalid trigger id', async () => {
      const response = await GET_TRIGGER(createRequest('http://localhost:3000/api/admin/triggers/invalid'), {
        params: Promise.resolve({ id: 'invalid' }),
      })

      expect(response.status).toBe(400)
    })

    it('updates trigger', async () => {
      vi.mocked(zammadClient.updateTrigger).mockResolvedValue({ id: 5 } as any)

      const request = createRequest('http://localhost:3000/api/admin/triggers/5', {
        method: 'PUT',
        body: JSON.stringify({ active: true }),
      })
      const response = await PUT_TRIGGER(request, { params: Promise.resolve({ id: '5' }) })

      expect(response.status).toBe(200)
      expect(zammadClient.updateTrigger).toHaveBeenCalledWith(5, { active: true })
    })

    it('deletes trigger', async () => {
      const request = createRequest('http://localhost:3000/api/admin/triggers/7', { method: 'DELETE' })
      const response = await DELETE_TRIGGER(request, { params: Promise.resolve({ id: '7' }) })

      expect(response.status).toBe(200)
      expect(zammadClient.deleteTrigger).toHaveBeenCalledWith(7)
    })
  })

  describe('POST /api/admin/triggers/setup', () => {
    it('creates default triggers when missing', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any)
      vi.mocked(zammadClient.findTriggerByName).mockResolvedValue(null)
      vi.mocked(zammadClient.createTrigger).mockImplementation(async (payload: any) => ({
        id: Math.floor(Math.random() * 1000) + 1,
        name: payload.name,
      }))

      const response = await POST_TRIGGERS_SETUP()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.summary.total).toBe(3)
      expect(payload.data.results).toHaveLength(3)
      expect(zammadClient.createTrigger).toHaveBeenCalledTimes(3)
    })
  })
})
