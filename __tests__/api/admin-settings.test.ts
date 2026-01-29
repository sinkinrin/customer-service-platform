/**
 * Admin settings API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}))

vi.mock('@/lib/utils/ai-config', () => ({
  readAISettings: vi.fn(),
  writeAISettings: vi.fn(),
  updateEnvFile: vi.fn(),
}))

import { requireAuth, requireRole } from '@/lib/utils/auth'
import { readAISettings, writeAISettings, updateEnvFile } from '@/lib/utils/ai-config'

import { GET as GET_SETTINGS, PUT as PUT_SETTINGS } from '@/app/api/admin/settings/route'
import { GET as GET_AI_SETTINGS, PUT as PUT_AI_SETTINGS } from '@/app/api/admin/settings/ai/route'
import { POST as POST_AI_TEST } from '@/app/api/admin/settings/ai/test/route'

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Admin settings APIs', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'admin_1', role: 'admin' } as any)
    vi.mocked(requireRole).mockResolvedValue({ id: 'admin_1', role: 'admin' } as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
    global.fetch = originalFetch
  })

  describe('GET /api/admin/settings', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(requireRole).mockRejectedValue(new Error('Unauthorized'))

      const response = await GET_SETTINGS(createRequest('http://localhost:3000/api/admin/settings'))
      expect(response.status).toBe(401)
    })
  })

  describe('PUT /api/admin/settings', () => {
    it('rejects unknown keys', async () => {
      const request = createRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'unknown', value: 'x' }),
      })
      const response = await PUT_SETTINGS(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.success).toBe(false)
    })

    it('accepts valid setting updates', async () => {
      const request = createRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'businessTypes', value: [] }),
      })
      const response = await PUT_SETTINGS(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
    })
  })

  describe('GET /api/admin/settings/ai', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

      const response = await GET_AI_SETTINGS(createRequest('http://localhost:3000/api/admin/settings/ai'))
      expect(response.status).toBe(401)
    })
  })

  describe('PUT /api/admin/settings/ai', () => {
    it('validates input payload', async () => {
      const request = createRequest('http://localhost:3000/api/admin/settings/ai', {
        method: 'PUT',
        body: JSON.stringify({ enabled: true, temperature: 5 }),
      })
      const response = await PUT_AI_SETTINGS(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.success).toBe(false)
    })

    it('writes settings and updates env when api key is provided', async () => {
      vi.mocked(readAISettings).mockReturnValue({
        enabled: true,
        model: 'FastGPT',
        temperature: 0.7,
        systemPrompt: 'Hello',
        fastgptUrl: 'http://fastgpt',
        fastgptAppId: 'app',
        fastgptApiKey: 'key',
      } as any)

      const request = createRequest('http://localhost:3000/api/admin/settings/ai', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: true,
          model: 'FastGPT',
          temperature: 0.7,
          system_prompt: 'Hello',
          fastgpt_url: 'http://fastgpt',
          fastgpt_appid: 'app',
          fastgpt_api_key: 'key',
        }),
      })

      const response = await PUT_AI_SETTINGS(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(writeAISettings).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          model: 'FastGPT',
          temperature: 0.7,
          systemPrompt: 'Hello',
          fastgptUrl: 'http://fastgpt',
          fastgptAppId: 'app',
          fastgptApiKey: 'key',
        })
      )
      expect(updateEnvFile).toHaveBeenCalledWith('key')
    })
  })

  describe('POST /api/admin/settings/ai/test', () => {
    it('returns error when AI is disabled', async () => {
      vi.mocked(readAISettings).mockReturnValue({
        enabled: false,
        provider: 'fastgpt',
        fastgptUrl: '',
        fastgptAppId: '',
        fastgptApiKey: '',
      } as any)

      const response = await POST_AI_TEST(createRequest('http://localhost:3000/api/admin/settings/ai/test', { method: 'POST' }))
      const payload = await response.json()
      expect(response.status).toBe(200)
      expect(payload.success).toBe(false)
      expect(payload.connectivity).toBe(false)
      expect(payload.functional).toBe(false)
      expect(payload.error).toBe('AI is not enabled')
    })

    it('returns success with connectivity and functional status when FastGPT responds', async () => {
      vi.mocked(readAISettings).mockReturnValue({
        enabled: true,
        provider: 'fastgpt',
        model: 'FastGPT',
        temperature: 0.7,
        systemPrompt: 'Hello',
        fastgptUrl: 'http://fastgpt',
        fastgptAppId: 'app',
        fastgptApiKey: 'key',
      } as any)

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'pong' } }],
        }),
      })
      global.fetch = fetchMock as any

      const response = await POST_AI_TEST(createRequest('http://localhost:3000/api/admin/settings/ai/test', { method: 'POST' }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.connectivity).toBe(true)
      expect(payload.functional).toBe(true)
      expect(payload.provider).toBe('fastgpt')
    })
  })
})
