import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalZammadUrl = process.env.ZAMMAD_URL
const originalZammadToken = process.env.ZAMMAD_API_TOKEN

describe('Zammad health-check request coalescing', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAMMAD_URL = 'http://zammad.test'
    process.env.ZAMMAD_API_TOKEN = 'test-token'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalZammadUrl === undefined) {
      delete process.env.ZAMMAD_URL
    } else {
      process.env.ZAMMAD_URL = originalZammadUrl
    }
    if (originalZammadToken === undefined) {
      delete process.env.ZAMMAD_API_TOKEN
    } else {
      process.env.ZAMMAD_API_TOKEN = originalZammadToken
    }
  })

  it('shares one upstream probe across concurrent callers', async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { checkZammadHealth } = await import('@/lib/zammad/health-check')
    const checks = [
      checkZammadHealth(),
      checkZammadHealth(),
      checkZammadHealth(),
      checkZammadHealth(),
      checkZammadHealth(),
    ]

    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveFetch?.(new Response('{}', { status: 200 }))

    await expect(Promise.all(checks)).resolves.toEqual([
      { isHealthy: true },
      { isHealthy: true },
      { isHealthy: true },
      { isHealthy: true },
      { isHealthy: true },
    ])
  })

  it('serves a completed probe from the short-lived cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { checkZammadHealth } = await import('@/lib/zammad/health-check')

    await expect(checkZammadHealth()).resolves.toEqual({ isHealthy: true })
    await expect(checkZammadHealth()).resolves.toEqual({ isHealthy: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
