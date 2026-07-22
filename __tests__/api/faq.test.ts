/**
 * FAQ API 集成测试
 *
 * 测试内容：
 * 1. 搜索功能
 * 2. 分类过滤
 * 3. 语言支持
 * 4. 缓存行为
 * 5. 输入验证
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/faq/route'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    faqArticle: {
      findMany: vi.fn(),
    },
  },
}))

// Mock cache
vi.mock('@/lib/cache/simple-cache', () => ({
  faqCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { faqCache } from '@/lib/cache/simple-cache'

// Mock FAQ data
const mockFaqArticle = {
  id: 1,
  categoryId: 1,
  views: 100,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  translations: [
    {
      title: '如何重置密码？',
      content: '请点击登录页面的"忘记密码"链接...',
      keywords: '["密码", "重置", "登录"]',
    },
  ],
  category: {
    name: '账户管理',
  },
  ratings: [
    { isHelpful: true },
    { isHelpful: true },
    { isHelpful: false },
  ],
}

// Helper to create mock request
function createMockRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('FAQ API 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(faqCache.get).mockReturnValue(null)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================================================
  // GET /api/faq
  // ============================================================================

  describe('GET /api/faq', () => {
    it('应返回 FAQ 列表', async () => {
      vi.mocked(prisma.faqArticle.findMany).mockResolvedValue([mockFaqArticle] as any)

      const request = createMockRequest('http://localhost:3000/api/faq')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.items).toHaveLength(1)
      expect(data.data.items[0].question).toBe('如何重置密码？')
    })

    it('应支持搜索查询', async () => {
      vi.mocked(prisma.faqArticle.findMany).mockResolvedValue([mockFaqArticle] as any)

      const request = createMockRequest('http://localhost:3000/api/faq?query=密码')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.query).toBe('密码')
    })

    it('应支持语言参数', async () => {
      vi.mocked(prisma.faqArticle.findMany).mockResolvedValue([mockFaqArticle] as any)

      const request = createMockRequest('http://localhost:3000/api/faq?language=en')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.language).toBe('en')
    })

    it('应支持分类过滤', async () => {
      vi.mocked(prisma.faqArticle.findMany).mockResolvedValue([mockFaqArticle] as any)

      const request = createMockRequest('http://localhost:3000/api/faq?categoryId=1')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(prisma.faqArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 1,
          }),
        })
      )
    })

    it('无效的 limit 应返回 400', async () => {
      const request = createMockRequest('http://localhost:3000/api/faq?limit=0')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    it('非整数 limit 应返回 400', async () => {
      const request = createMockRequest('http://localhost:3000/api/faq?limit=1.5')
      const response = await GET(request)

      expect(response.status).toBe(400)
      expect(prisma.faqArticle.findMany).not.toHaveBeenCalled()
    })

    it('无效的分类 ID 应返回 400', async () => {
      const request = createMockRequest('http://localhost:3000/api/faq?categoryId=abc')
      const response = await GET(request)

      expect(response.status).toBe(400)
      expect(prisma.faqArticle.findMany).not.toHaveBeenCalled()
    })

    it('过长搜索词应返回 400', async () => {
      const request = createMockRequest(`http://localhost:3000/api/faq?query=${'x'.repeat(201)}`)
      const response = await GET(request)

      expect(response.status).toBe(400)
      expect(prisma.faqArticle.findMany).not.toHaveBeenCalled()
    })

    it('应使用缓存（非搜索查询）', async () => {
      const cachedData = {
        items: [{ id: '1', question: 'Cached FAQ' }],
        total: 1,
      }
      vi.mocked(faqCache.get).mockReturnValue(cachedData)

      const request = createMockRequest('http://localhost:3000/api/faq')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.cached).toBe(true)
      expect(prisma.faqArticle.findMany).not.toHaveBeenCalled()
    })

    it('public forceRefresh 参数不应绕过缓存', async () => {
      vi.mocked(faqCache.get).mockReturnValue({ items: [{ id: 'cached' }] })

      const request = createMockRequest('http://localhost:3000/api/faq?forceRefresh=true')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(prisma.faqArticle.findMany).not.toHaveBeenCalled()
    })

    it('数据库异常不应暴露给匿名调用方', async () => {
      vi.mocked(prisma.faqArticle.findMany).mockRejectedValue(
        new Error('database unavailable at 10.0.0.20:5432')
      )

      const request = createMockRequest('http://localhost:3000/api/faq?query=test')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.message).toBe('Failed to fetch FAQ articles')
      expect(JSON.stringify(data)).not.toContain('10.0.0.20')
    })
  })
})

