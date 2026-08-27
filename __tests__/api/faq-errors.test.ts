import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    faqArticle: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    faqCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    faqRating: {
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/cache/simple-cache', () => ({
  categoriesCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}))

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { categoriesCache } from '@/lib/cache/simple-cache'
import { requireAuth } from '@/lib/utils/auth'
import { GET as GET_FAQ_DETAIL } from '@/app/api/faq/[id]/route'
import { GET as GET_FAQ_CATEGORIES } from '@/app/api/faq/categories/route'
import { POST as POST_FAQ_RATING } from '@/app/api/faq/[id]/rating/route'

describe('FAQ error boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(categoriesCache.get).mockReturnValue(null)
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'user-1',
      role: 'customer',
    } as any)
  })

  it('rejects non-canonical article IDs', async () => {
    const request = new NextRequest('http://localhost:3000/api/faq/1abc')
    const response = await GET_FAQ_DETAIL(request, {
      params: Promise.resolve({ id: '1abc' }),
    })

    expect(response.status).toBe(400)
    expect(prisma.faqArticle.findFirst).not.toHaveBeenCalled()
  })

  it('hides FAQ detail database errors', async () => {
    vi.mocked(prisma.faqArticle.findFirst).mockRejectedValue(
      new Error('database unavailable at 10.0.0.20:5432')
    )
    const request = new NextRequest('http://localhost:3000/api/faq/1')

    const response = await GET_FAQ_DETAIL(request, {
      params: Promise.resolve({ id: '1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error.message).toBe('Failed to fetch FAQ article')
    expect(JSON.stringify(payload)).not.toContain('10.0.0.20')
  })

  it('hides FAQ category database errors', async () => {
    vi.mocked(prisma.faqCategory.findMany).mockRejectedValue(
      new Error('database unavailable at 10.0.0.20:5432')
    )
    const request = new NextRequest('http://localhost:3000/api/faq/categories')

    const response = await GET_FAQ_CATEGORIES(request)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error.message).toBe('Failed to fetch FAQ categories')
    expect(JSON.stringify(payload)).not.toContain('10.0.0.20')
  })

  it('returns 400 for malformed rating JSON', async () => {
    const request = {
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    } as NextRequest

    const response = await POST_FAQ_RATING(request, {
      params: Promise.resolve({ id: '1' }),
    })

    expect(response.status).toBe(400)
    expect(prisma.faqArticle.findUnique).not.toHaveBeenCalled()
  })

  it('hides FAQ rating database errors', async () => {
    vi.mocked(prisma.faqArticle.findUnique).mockRejectedValue(
      new Error('database unavailable at 10.0.0.20:5432')
    )
    const request = {
      json: async () => ({ is_helpful: true }),
    } as NextRequest

    const response = await POST_FAQ_RATING(request, {
      params: Promise.resolve({ id: '1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error.message).toBe('Failed to submit FAQ rating')
    expect(JSON.stringify(payload)).not.toContain('10.0.0.20')
  })
})
