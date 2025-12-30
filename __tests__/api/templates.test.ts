/**
 * Templates API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    replyTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

import { GET as GET_TEMPLATES, POST as POST_TEMPLATES } from '@/app/api/templates/route'
import { GET as GET_TEMPLATE, PUT as PUT_TEMPLATE, DELETE as DELETE_TEMPLATE } from '@/app/api/templates/[id]/route'

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Templates API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/templates', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const response = await GET_TEMPLATES(createRequest('http://localhost:3000/api/templates'))
      expect(response.status).toBe(401)
    })

    it('forbids customers', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'customer' } } as any)

      const response = await GET_TEMPLATES(createRequest('http://localhost:3000/api/templates'))
      expect(response.status).toBe(403)
    })

    it('applies region filter for staff', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { role: 'staff', region: 'asia-pacific' },
      } as any)
      vi.mocked(prisma.replyTemplate.findMany).mockResolvedValue([])

      const response = await GET_TEMPLATES(createRequest('http://localhost:3000/api/templates'))
      expect(response.status).toBe(200)

      expect(prisma.replyTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { region: 'asia-pacific' },
              { region: null },
            ],
          }),
        })
      )
    })
  })

  describe('POST /api/templates', () => {
    it('validates request body', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'staff' } } as any)

      const request = createRequest('http://localhost:3000/api/templates', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
      })
      const response = await POST_TEMPLATES(request)

      expect(response.status).toBe(400)
    })

    it('creates templates for staff', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'staff', id: 'staff_1' } } as any)
      vi.mocked(prisma.replyTemplate.create).mockResolvedValue({ id: 1, name: 'Welcome' } as any)

      const request = createRequest('http://localhost:3000/api/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Welcome',
          content: 'Hello',
          category: 'first_contact',
          region: 'asia-pacific',
        }),
      })
      const response = await POST_TEMPLATES(request)
      const payload = await response.json()

      expect(response.status).toBe(201)
      expect(payload.success).toBe(true)
      expect(prisma.replyTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdById: 'staff_1',
            region: 'asia-pacific',
          }),
        })
      )
    })
  })

  describe('Template detail endpoints', () => {
    it('returns 400 for invalid id', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'staff' } } as any)

      const response = await GET_TEMPLATE(createRequest('http://localhost:3000/api/templates/invalid'), {
        params: Promise.resolve({ id: 'invalid' }),
      })
      expect(response.status).toBe(400)
    })

    it('updates template data', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'staff' } } as any)
      vi.mocked(prisma.replyTemplate.update).mockResolvedValue({ id: 2, name: 'Updated' } as any)

      const request = createRequest('http://localhost:3000/api/templates/2', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      })
      const response = await PUT_TEMPLATE(request, { params: Promise.resolve({ id: '2' }) })

      expect(response.status).toBe(200)
      expect(prisma.replyTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
        })
      )
    })

    it('only allows admin to delete', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'staff' } } as any)

      const response = await DELETE_TEMPLATE(createRequest('http://localhost:3000/api/templates/2', { method: 'DELETE' }), {
        params: Promise.resolve({ id: '2' }),
      })
      expect(response.status).toBe(403)
    })
  })
})
