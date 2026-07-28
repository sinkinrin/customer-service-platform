/**
 * Zammad Client 单元测试
 *
 * 测试内容：
 * 1. 配置验证 - 未配置时应抛出错误
 * 2. X-On-Behalf-Of 头部正确添加
 * 3. 超时重试机制
 * 4. 错误处理逻辑
 * 5. API 请求格式验证
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ZammadClient, ZammadHttpError } from '@/lib/zammad/client'
import { server } from '@tests/mocks/server'
import { http, HttpResponse } from 'msw'

// 基础 URL 用于测试
const TEST_BASE_URL = 'http://zammad.test'
const TEST_TOKEN = 'test-token'

describe('ZammadClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    delete process.env.ZAMMAD_URL
    delete process.env.ZAMMAD_API_TOKEN
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('配置验证', () => {
    it('should throw error when not configured (empty strings)', async () => {
      const client = new ZammadClient('', '')

      await expect(client.getTicket(1)).rejects.toThrow(
        'Zammad is not configured. Please set ZAMMAD_URL and ZAMMAD_API_TOKEN environment variables.'
      )
    })

    it('should throw error when baseUrl is missing', async () => {
      const client = new ZammadClient('', 'valid-token')

      await expect(client.getTicket(1)).rejects.toThrow(/not configured/)
    })

    it('should throw error when apiToken is missing', async () => {
      const client = new ZammadClient('http://localhost', '')

      await expect(client.getTicket(1)).rejects.toThrow(/not configured/)
    })

    it('should use environment variables when constructor params not provided', async () => {
      process.env.ZAMMAD_URL = 'http://env-zammad.test'
      process.env.ZAMMAD_API_TOKEN = 'env-token'

      // 添加 MSW handler 来验证请求
      let capturedRequest: Request | null = null
      server.use(
        http.get('http://env-zammad.test/api/v1/tickets/1', ({ request }) => {
          capturedRequest = request
          return HttpResponse.json({ id: 1, title: 'Test Ticket' })
        })
      )

      const client = new ZammadClient()
      await client.getTicket(1)

      expect(capturedRequest).not.toBeNull()
      expect(capturedRequest!.headers.get('Authorization')).toBe('Token token=env-token')
    })

    it('should strip trailing slash from baseUrl', async () => {
      let capturedUrl = ''
      server.use(
        http.get('http://zammad.test/api/v1/tickets/1', ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({ id: 1 })
        })
      )

      const client = new ZammadClient('http://zammad.test/', 'token')
      await client.getTicket(1)

      expect(capturedUrl).toBe('http://zammad.test/api/v1/tickets/1')
    })
  })

  describe('请求头验证', () => {
    it('should set correct Authorization header', async () => {
      let capturedHeaders: Headers | null = null
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/1`, ({ request }) => {
          capturedHeaders = request.headers
          return HttpResponse.json({ id: 1 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.getTicket(1)

      expect(capturedHeaders!.get('Authorization')).toBe(`Token token=${TEST_TOKEN}`)
    })

    it('should set Content-Type and Accept headers', async () => {
      let capturedHeaders: Headers | null = null
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/1`, ({ request }) => {
          capturedHeaders = request.headers
          return HttpResponse.json({ id: 1 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.getTicket(1)

      expect(capturedHeaders!.get('Content-Type')).toBe('application/json')
      expect(capturedHeaders!.get('Accept')).toBe('application/json')
    })

    it('should add X-On-Behalf-Of header when onBehalfOf is provided', async () => {
      let capturedHeaders: Headers | null = null
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/1`, ({ request }) => {
          capturedHeaders = request.headers
          return HttpResponse.json({ id: 1 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.getTicket(1, 'user@example.com')

      expect(capturedHeaders!.get('X-On-Behalf-Of')).toBe('user@example.com')
    })

    it('should NOT include X-On-Behalf-Of header when not provided', async () => {
      let capturedHeaders: Headers | null = null
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/1`, ({ request }) => {
          capturedHeaders = request.headers
          return HttpResponse.json({ id: 1 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.getTicket(1)

      expect(capturedHeaders!.get('X-On-Behalf-Of')).toBeNull()
    })
  })

  describe('用户认证', () => {
    it.each([401, 403])(
      'authenticateUserStrict should return null for credential rejection %i',
      async (status) => {
        server.use(
          http.get(`${TEST_BASE_URL}/api/v1/users/me`, () => (
            HttpResponse.json({ error: 'Authentication failed' }, { status })
          ))
        )

        const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)

        await expect(
          client.authenticateUserStrict('customer@test.com', 'wrong-password')
        ).resolves.toBeNull()
      }
    )

    it('authenticateUserStrict should surface an upstream 503 with its status', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/users/me`, () => (
          HttpResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
        ))
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      const error = await client.authenticateUserStrict(
        'customer@test.com',
        'current-password'
      ).catch(caught => caught)

      expect(error).toBeInstanceOf(ZammadHttpError)
      expect(error).toMatchObject({
        message: 'Authentication service unavailable',
        status: 503,
      })
    })

    it('authenticateUserStrict should reject malformed successful JSON', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/users/me`, () => (
          new HttpResponse('{"id":', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        ))
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)

      await expect(
        client.authenticateUserStrict('customer@test.com', 'current-password')
      ).rejects.toBeInstanceOf(SyntaxError)
    })

    it('authenticateUser should preserve the compatibility null-on-error contract', async () => {
      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      vi.spyOn(client, 'authenticateUserStrict').mockRejectedValueOnce(
        new ZammadHttpError('Authentication service unavailable', 503)
      )

      await expect(
        client.authenticateUser('customer@test.com', 'current-password')
      ).resolves.toBeNull()
    })
  })

  describe('API 方法', () => {
    it('createTicket should POST to /tickets', async () => {
      let capturedBody: unknown = null
      let capturedMethod = ''
      server.use(
        http.post(`${TEST_BASE_URL}/api/v1/tickets`, async ({ request }) => {
          capturedMethod = request.method
          capturedBody = await request.json()
          return HttpResponse.json({ id: 1 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      const ticketData = { title: 'Test', group_id: 1, customer_id: 1 }
      await client.createTicket(ticketData)

      expect(capturedMethod).toBe('POST')
      expect(capturedBody).toEqual(ticketData)
    })

    it('updateTicket should PUT to /tickets/:id', async () => {
      let capturedBody: unknown = null
      let capturedMethod = ''
      server.use(
        http.put(`${TEST_BASE_URL}/api/v1/tickets/123`, async ({ request }) => {
          capturedMethod = request.method
          capturedBody = await request.json()
          return HttpResponse.json({ id: 123 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      const updateData = { state_id: 2 }
      await client.updateTicket(123, updateData)

      expect(capturedMethod).toBe('PUT')
      expect(capturedBody).toEqual(updateData)
    })

    it('deleteTicket should DELETE to /tickets/:id', async () => {
      let capturedMethod = ''
      server.use(
        http.delete(`${TEST_BASE_URL}/api/v1/tickets/123`, ({ request }) => {
          capturedMethod = request.method
          return HttpResponse.json({})
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.deleteTicket(123)

      expect(capturedMethod).toBe('DELETE')
    })

    it('getTickets should include pagination params', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.getTickets(2, 50)

      expect(capturedUrl).toContain('page=2')
      expect(capturedUrl).toContain('per_page=50')
    })

    it('searchTickets should format numeric query as ticket number', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/search`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.searchTickets('12345')

      expect(capturedUrl).toContain('query=number%3A12345')
    })

    it('searchTickets should add wildcards to plain text query', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/search`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.searchTickets('login issue')

      expect(capturedUrl).toContain('title')
    })

    it('searchTickets should include explicit page parameter', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/search`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.searchTickets('state:*', 20, undefined, 3)

      expect(capturedUrl).toContain('limit=20')
      expect(capturedUrl).toContain('page=3')
    })

    it('searchTickets should include sort parameters when provided', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/search`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.searchTickets('state:*', 20, undefined, 2, 'priority_id', 'asc')

      expect(capturedUrl).toContain('sort_by=priority_id')
      expect(capturedUrl).toContain('order_by=asc')
    })

    it('searchTicketsRawQuery should not auto-format pre-built DSL query', async () => {
      let capturedQuery = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/search`, ({ request }) => {
          capturedQuery = new URL(request.url).searchParams.get('query') || ''
          return HttpResponse.json([])
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.searchTicketsRawQuery('state:* AND title:*login issue*', 20, undefined, 2, 'created_at', 'desc')

      expect(capturedQuery).toBe('state:* AND title:*login issue*')
    })

    it('searchTicketsTotalCount should request only_total_count', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/search`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({ total_count: 93 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      const total = await client.searchTicketsTotalCount('state:*')

      expect(capturedUrl).toContain('only_total_count=true')
      expect(total).toBe(93)
    })

    it('searchTicketsTotalCountRawQuery should keep pre-built DSL query', async () => {
      let capturedQuery = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/search`, ({ request }) => {
          capturedQuery = new URL(request.url).searchParams.get('query') || ''
          return HttpResponse.json({ total_count: 12 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      const total = await client.searchTicketsTotalCountRawQuery('state:* AND group_id:101')

      expect(capturedQuery).toBe('state:* AND group_id:101')
      expect(total).toBe(12)
    })

    it('createArticle should POST to /ticket_articles', async () => {
      let capturedBody: unknown = null
      server.use(
        http.post(`${TEST_BASE_URL}/api/v1/ticket_articles`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ id: 1 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      const articleData = { ticket_id: 1, body: 'Test body', type: 'note' }
      await client.createArticle(articleData)

      expect(capturedBody).toEqual(articleData)
    })

    it('getArticlesByTicket should GET /ticket_articles/by_ticket/:id', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/ticket_articles/by_ticket/123`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.getArticlesByTicket(123)

      expect(capturedUrl).toContain('/ticket_articles/by_ticket/123')
    })
  })

  describe('错误处理', () => {
    it('should throw error with human-readable message from API', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/v1/tickets`, () => {
          return HttpResponse.json(
            {
              error: 'Parameter validation failed',
              error_human: 'The ticket title is required',
            },
            { status: 400 }
          )
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await expect(client.createTicket({} as any)).rejects.toThrow(
        'The ticket title is required'
      )
    })

    it('should throw error with error field if error_human not present', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/v1/tickets`, () => {
          return HttpResponse.json(
            { error: 'validation_failed' },
            { status: 400 }
          )
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await expect(client.createTicket({} as any)).rejects.toThrow(
        'validation_failed'
      )
    })

    it('should expose the HTTP status while remaining compatible with Error callers', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/v1/tickets`, () => {
          return HttpResponse.json(
            { error: 'article_rejected', error_human: 'Article was rejected' },
            { status: 422 }
          )
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      const error = await client.createTicket({} as any).catch(caught => caught)

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ZammadHttpError)
      expect(error).toMatchObject({
        name: 'ZammadHttpError',
        message: 'Article was rejected',
        status: 422,
      })
    })

    it('should throw error on 404', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/999`, () => {
          return HttpResponse.json(
            { error: 'Ticket not found' },
            { status: 404 }
          )
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await expect(client.getTicket(999)).rejects.toThrow('Ticket not found')
    })
  })

  describe('重试机制', () => {
    it('should retry on 5xx errors', async () => {
      let callCount = 0
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/1`, () => {
          callCount++
          if (callCount === 1) {
            return HttpResponse.json(
              { error: 'Server error' },
              { status: 500 }
            )
          }
          return HttpResponse.json({ id: 1, title: 'Test' })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 1)
      const result = await client.getTicket(1)

      expect(callCount).toBe(2)
      expect(result).toEqual({ id: 1, title: 'Test' })
    })

    it('should not retry 4xx errors', async () => {
      let callCount = 0
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/999`, () => {
          callCount++
          return HttpResponse.json(
            { error: 'Ticket not found' },
            { status: 404 }
          )
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 2)
      await expect(client.getTicket(999)).rejects.toThrow('Ticket not found')
      expect(callCount).toBe(1)
    })

    it('should not retry POST requests on 5xx errors', async () => {
      let callCount = 0
      server.use(
        http.post(`${TEST_BASE_URL}/api/v1/tickets`, () => {
          callCount++
          return HttpResponse.json(
            { error: 'Server error after an unknown write outcome' },
            { status: 500 }
          )
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 2)
      await expect(client.createTicket({} as any)).rejects.toThrow('unknown write outcome')
      expect(callCount).toBe(1)
    })

    it('should not retry POST requests after a network error', async () => {
      let callCount = 0
      server.use(
        http.post(`${TEST_BASE_URL}/api/v1/tickets`, () => {
          callCount++
          return HttpResponse.error()
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 2)
      await expect(client.createTicket({} as any)).rejects.toThrow()
      expect(callCount).toBe(1)
    })

    it('should retry GET requests after a network error', async () => {
      let callCount = 0
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/1`, () => {
          callCount++
          if (callCount === 1) return HttpResponse.error()
          return HttpResponse.json({ id: 1, title: 'Recovered' })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 1)
      await expect(client.getTicket(1)).resolves.toEqual({ id: 1, title: 'Recovered' })
      expect(callCount).toBe(2)
    })

    it('should retry GET requests when a successful response contains invalid JSON', async () => {
      let callCount = 0
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/1`, () => {
          callCount++
          if (callCount === 1) {
            return HttpResponse.text('{"id":', {
              headers: { 'Content-Type': 'application/json' },
            })
          }
          return HttpResponse.json({ id: 1, title: 'Recovered body' })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 1)
      await expect(client.getTicket(1)).resolves.toEqual({ id: 1, title: 'Recovered body' })
      expect(callCount).toBe(2)
    })

    it('should retry GET requests when reading a successful response body fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockRejectedValue(new TypeError('terminated')),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ id: 1, title: 'Recovered stream' }),
        } as unknown as Response)

      try {
        const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 1)
        await expect(client.getTicket(1)).resolves.toEqual({ id: 1, title: 'Recovered stream' })
        expect(fetchSpy).toHaveBeenCalledTimes(2)
      } finally {
        fetchSpy.mockRestore()
      }
    })

    it('should normalize response body timeouts after GET retries are exhausted', async () => {
      const timeoutError = new Error('The operation timed out')
      timeoutError.name = 'TimeoutError'
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(timeoutError),
      } as unknown as Response)

      try {
        const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 1)
        await expect(client.getTicket(1)).rejects.toThrow('Request timeout')
        expect(fetchSpy).toHaveBeenCalledTimes(2)
      } finally {
        fetchSpy.mockRestore()
      }
    })

    it('should not retry POST requests when parsing a successful response fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input')),
      } as unknown as Response)

      try {
        const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 2)
        await expect(client.createTicket({} as any)).rejects.toThrow('Unexpected end of JSON input')
        expect(fetchSpy).toHaveBeenCalledTimes(1)
      } finally {
        fetchSpy.mockRestore()
      }
    })

    it('should accept empty 204 responses without parsing JSON', async () => {
      server.use(
        http.delete(`${TEST_BASE_URL}/api/v1/tickets/123`, () => {
          return new HttpResponse(null, { status: 204 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 1)
      await expect(client.deleteTicket(123)).resolves.toBeUndefined()
    })

    it('should respect maxRetries limit', async () => {
      let callCount = 0
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tickets/1`, () => {
          callCount++
          return HttpResponse.json(
            { error: 'Server error' },
            { status: 500 }
          )
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN, 100, 2)
      await expect(client.getTicket(1)).rejects.toThrow('Server error')

      // Original + 2 retries = 3 calls
      expect(callCount).toBe(3)
    })
  })

  describe('Knowledge Base 方法', () => {
    it('getKnowledgeBaseInit should GET /knowledge_bases/init', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/knowledge_bases/init`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({})
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.getKnowledgeBaseInit()

      expect(capturedUrl).toContain('/knowledge_bases/init')
    })

    it('searchKnowledgeBase should include locale and limit params', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/knowledge_bases/search`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.searchKnowledgeBase('password reset', 'zh-CN', 20)

      expect(capturedUrl).toContain('query=password+reset')
      expect(capturedUrl).toContain('locale=zh-CN')
      expect(capturedUrl).toContain('limit=20')
    })
  })

  describe('User 和 Group 管理', () => {
    it('getCurrentUser should GET /users/me', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/users/me`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({ id: 1, email: 'test@example.com' })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.getCurrentUser()

      expect(capturedUrl).toContain('/users/me')
    })

    it('updateCurrentUserPreferences should update only supplied keys on behalf of the user', async () => {
      let capturedBody: unknown = null
      let capturedHeaders: Headers | null = null
      let capturedMethod = ''
      server.use(
        http.put(`${TEST_BASE_URL}/api/v1/users/preferences`, async ({ request }) => {
          capturedMethod = request.method
          capturedHeaders = request.headers
          capturedBody = await request.json()
          return HttpResponse.json({ message: 'ok' })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.updateCurrentUserPreferences(
        { locale: 'zh-CN' },
        'user@example.com'
      )

      expect(capturedMethod).toBe('PUT')
      expect(capturedHeaders!.get('X-On-Behalf-Of')).toBe('user@example.com')
      expect(capturedBody).toEqual({ locale: 'zh-CN' })
    })

    it('createUser should POST to /users', async () => {
      let capturedBody: unknown = null
      server.use(
        http.post(`${TEST_BASE_URL}/api/v1/users`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ id: 1 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      const userData = { email: 'test@example.com', login: 'test', firstname: 'Test' }
      await client.createUser(userData)

      expect(capturedBody).toEqual(userData)
    })

    it('searchUsersPaginated should include page and limit', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/users/search`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.searchUsersPaginated('*', 25, 2)

      expect(capturedUrl).toContain('limit=25')
      expect(capturedUrl).toContain('page=2')
    })

    it('searchUsersTotalCount should request only_total_count', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/users/search`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({ total_count: 44 })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      const total = await client.searchUsersTotalCount('*')

      expect(capturedUrl).toContain('only_total_count=true')
      expect(total).toBe(44)
    })

    it('getGroups should GET /groups', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/groups`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.getGroups()

      expect(capturedUrl).toContain('/groups')
    })
  })

  describe('Tag 管理', () => {
    it('getTags should GET /tags with object and o_id params', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/tags`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({ tags: ['urgent', 'vip'] })
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      const tags = await client.getTags(123)

      expect(capturedUrl).toContain('object=Ticket')
      expect(capturedUrl).toContain('o_id=123')
      expect(tags).toEqual(['urgent', 'vip'])
    })

    it('addTag should POST to /tags/add', async () => {
      let capturedBody: unknown = null
      server.use(
        http.post(`${TEST_BASE_URL}/api/v1/tags/add`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({})
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.addTag(123, 'priority')

      expect(capturedBody).toEqual({
        item: 'priority',
        object: 'Ticket',
        o_id: 123,
      })
    })

    it('removeTag should DELETE to /tags/remove', async () => {
      let capturedBody: unknown = null
      server.use(
        http.delete(`${TEST_BASE_URL}/api/v1/tags/remove`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({})
        })
      )

      const client = new ZammadClient(TEST_BASE_URL, TEST_TOKEN)
      await client.removeTag(123, 'old-tag')

      expect(capturedBody).toEqual({
        item: 'old-tag',
        object: 'Ticket',
        o_id: 123,
      })
    })
  })
})

