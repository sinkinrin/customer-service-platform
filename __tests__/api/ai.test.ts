/**
 * AI APIs integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/ai-config', () => ({
  readAISettings: vi.fn(),
}))

import { readAISettings } from '@/lib/utils/ai-config'

import { POST as POST_CHAT } from '@/app/api/ai/chat/route'
import { GET as GET_AI_HEALTH } from '@/app/api/ai/health/route'

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('AI APIs', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
    global.fetch = originalFetch
  })

  describe('POST /api/ai/chat', () => {
    it('validates request payload', async () => {
      const response = await POST_CHAT(
        createRequest('http://localhost:3000/api/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ conversationId: 'c1' }),
        })
      )

      expect(response.status).toBe(400)
    })

    it('blocks when AI is disabled', async () => {
      vi.mocked(readAISettings).mockReturnValue({
        enabled: false,
      } as any)

      const response = await POST_CHAT(
        createRequest('http://localhost:3000/api/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ conversationId: 'c1', message: 'hi' }),
        })
      )

      expect(response.status).toBe(403)
    })

    it('returns 500 when FastGPT is not configured', async () => {
      vi.mocked(readAISettings).mockReturnValue({
        enabled: true,
        provider: 'fastgpt',
        fastgptUrl: '',
        fastgptAppId: '',
        fastgptApiKey: '',
      } as any)

      const response = await POST_CHAT(
        createRequest('http://localhost:3000/api/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ conversationId: 'c1', message: 'hi' }),
        })
      )

      expect(response.status).toBe(500)
    })

    it('returns AI response when FastGPT succeeds', async () => {
      vi.mocked(readAISettings).mockReturnValue({
        enabled: true,
        provider: 'fastgpt',
        model: 'FastGPT',
        fastgptUrl: 'http://fastgpt',
        fastgptAppId: 'app',
        fastgptApiKey: 'key',
      } as any)

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'hello there' } }],
        }),
      })
      global.fetch = fetchMock as any

      const response = await POST_CHAT(
        createRequest('http://localhost:3000/api/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ conversationId: 'c1', message: 'hi' }),
        })
      )
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.message).toBe('hello there')
    })

    it('returns event stream when stream mode is requested', async () => {
      vi.mocked(readAISettings).mockReturnValue({
        enabled: true,
        provider: 'fastgpt',
        model: 'FastGPT',
        fastgptUrl: 'http://fastgpt',
        fastgptAppId: 'app',
        fastgptApiKey: 'key',
      } as any)

      const encoder = new TextEncoder()
      const upstreamStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: answer\ndata: {"choices":[{"delta":{"content":"hello"}}]}\n\n'))
          controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
          controller.close()
        },
      })

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        body: upstreamStream,
      })
      global.fetch = fetchMock as any

      const response = await POST_CHAT(
        createRequest('http://localhost:3000/api/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ conversationId: 'c1', message: 'hi', stream: true }),
        })
      )
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/event-stream')
      expect(text).toContain('event: answer')
      expect(text).toContain('"hello"')
    })
  })

  describe('GET /api/ai/health', () => {
    it('reports disabled state', async () => {
      vi.mocked(readAISettings).mockReturnValue({ enabled: false } as any)

      const response = await GET_AI_HEALTH()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.status).toBe('disabled')
    })

    it('reports misconfiguration', async () => {
      vi.mocked(readAISettings).mockReturnValue({
        enabled: true,
        provider: 'fastgpt',
        fastgptUrl: '',
        fastgptAppId: '',
        fastgptApiKey: '',
      } as any)

      const response = await GET_AI_HEALTH()
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload.status).toBe('misconfigured')
    })

    it('reports healthy when FastGPT responds', async () => {
      vi.mocked(readAISettings).mockReturnValue({
        enabled: true,
        provider: 'fastgpt',
        model: 'FastGPT',
        fastgptUrl: 'http://fastgpt',
        fastgptAppId: 'app',
        fastgptApiKey: 'key',
      } as any)

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      })
      global.fetch = fetchMock as any

      const response = await GET_AI_HEALTH()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.status).toBe('healthy')
    })

    it('reports unreachable when fetch fails', async () => {
      vi.mocked(readAISettings).mockReturnValue({
        enabled: true,
        provider: 'fastgpt',
        fastgptUrl: 'http://fastgpt',
        fastgptAppId: 'app',
        fastgptApiKey: 'key',
      } as any)

      const fetchMock = vi.fn().mockRejectedValue(new Error('Network failed'))
      global.fetch = fetchMock as any

      const response = await GET_AI_HEALTH()
      const payload = await response.json()

      expect(response.status).toBe(503)
      expect(payload.status).toBe('unreachable')
    })
  })
})
