import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

async function loadEnvModule() {
  vi.resetModules()
  return import('@/lib/env')
}

describe('production env readiness', () => {
  beforeEach(() => {
    Object.keys(process.env).forEach((key) => delete process.env[key])
    Object.assign(process.env, originalEnv)
    process.env.NODE_ENV = 'production'
    process.env.AUTH_SECRET = 'a'.repeat(32)
    process.env.DATABASE_URL = 'postgres://localhost/test'
    process.env.ZAMMAD_URL = 'https://zammad.example.com'
    process.env.ZAMMAD_API_TOKEN = 'token'
    process.env.ZAMMAD_WEBHOOK_SECRET = 'webhook-secret'
    delete process.env.NEXTAUTH_SECRET
    delete process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH
  })

  afterEach(() => {
    Object.keys(process.env).forEach((key) => delete process.env[key])
    Object.assign(process.env, originalEnv)
  })

  it('fails in production when welcome email is enabled without WEB_PLATFORM_URL', async () => {
    delete process.env.WEB_PLATFORM_URL
    delete process.env.EMAIL_USER_WELCOME_EMAIL_ENABLED

    const { validateEnv } = await loadEnvModule()

    expect(() => validateEnv()).toThrow(
      'WEB_PLATFORM_URL is required in production when welcome email is enabled'
    )
  })

  it('allows missing WEB_PLATFORM_URL when welcome email is explicitly disabled', async () => {
    delete process.env.WEB_PLATFORM_URL
    process.env.EMAIL_USER_WELCOME_EMAIL_ENABLED = 'false'

    const { validateEnv } = await loadEnvModule()

    expect(() => validateEnv()).not.toThrow()
  })

  it('fails in production when ZAMMAD_WEBHOOK_SECRET is missing', async () => {
    delete process.env.ZAMMAD_WEBHOOK_SECRET
    process.env.EMAIL_USER_WELCOME_EMAIL_ENABLED = 'false'

    const { validateEnv } = await loadEnvModule()

    expect(() => validateEnv()).toThrow('ZAMMAD_WEBHOOK_SECRET is required in production')
  })
})
