/**
 * Zammad health endpoint tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/zammad/health-check', () => ({
  checkZammadHealth: vi.fn(),
}))

import { checkZammadHealth } from '@/lib/zammad/health-check'
import { GET } from '@/app/api/health/zammad/route'

describe('GET /api/health/zammad', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns healthy when Zammad is available', async () => {
    vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: true })

    const response = await GET({} as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.status).toBe('healthy')
  })

  it('returns 503 when Zammad is unavailable', async () => {
    vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: false, error: 'down' })

    const response = await GET({} as any)
    expect(response.status).toBe(503)
  })
})
