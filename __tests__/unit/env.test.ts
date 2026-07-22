import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mutableEnv = process.env as Record<string, string | undefined>
const originalEnv = { ...process.env }

function restoreEnvironment() {
  for (const key of Object.keys(mutableEnv)) delete mutableEnv[key]
  Object.assign(mutableEnv, originalEnv)
}

function setValidProductionEnvironment() {
  mutableEnv.NODE_ENV = 'production'
  mutableEnv.AUTH_SECRET = 'a'.repeat(32)
  mutableEnv.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/env_test'
  mutableEnv.ZAMMAD_URL = 'http://127.0.0.1:65535/'
  mutableEnv.ZAMMAD_API_TOKEN = 'test-token'
  mutableEnv.ZAMMAD_WEBHOOK_SECRET = 'test-webhook-secret'
  mutableEnv.WEB_PLATFORM_URL = 'https://support.example.com'
  mutableEnv.NEXT_PUBLIC_ENABLE_MOCK_AUTH = 'false'
}

async function loadEnvModule() {
  vi.resetModules()
  return import('@/lib/env')
}

describe('environment configuration', () => {
  beforeEach(() => {
    restoreEnvironment()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    restoreEnvironment()
  })

  it('prefers AUTH_SECRET and falls back to NEXTAUTH_SECRET', async () => {
    mutableEnv.AUTH_SECRET = 'primary-secret'
    mutableEnv.NEXTAUTH_SECRET = 'fallback-secret'
    let envModule = await loadEnvModule()

    expect(envModule.hasAuthSecret()).toBe(true)
    expect(envModule.getAuthSecret()).toBe('primary-secret')

    delete mutableEnv.AUTH_SECRET
    envModule = await loadEnvModule()

    expect(envModule.hasAuthSecret()).toBe(true)
    expect(envModule.getAuthSecret()).toBe('fallback-secret')
  })

  it('warns when development requirements are missing', async () => {
    mutableEnv.NODE_ENV = 'development'
    delete mutableEnv.DATABASE_URL
    delete mutableEnv.ZAMMAD_URL
    delete mutableEnv.ZAMMAD_API_TOKEN
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { validateEnv } = await loadEnvModule()

    validateEnv()

    expect(warning).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'))
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('ZAMMAD_URL'))
  })

  it('rejects missing production requirements', async () => {
    setValidProductionEnvironment()
    delete mutableEnv.AUTH_SECRET
    delete mutableEnv.NEXTAUTH_SECRET
    const { validateEnv } = await loadEnvModule()

    expect(() => validateEnv()).toThrow('AUTH_SECRET (or NEXTAUTH_SECRET)')
  })

  it('accepts NEXTAUTH_SECRET as the production auth secret', async () => {
    setValidProductionEnvironment()
    delete mutableEnv.AUTH_SECRET
    mutableEnv.NEXTAUTH_SECRET = 'b'.repeat(32)
    const { validateEnv } = await loadEnvModule()

    expect(() => validateEnv()).not.toThrow()
  })

  it('rejects short production auth secrets', async () => {
    setValidProductionEnvironment()
    mutableEnv.AUTH_SECRET = 'replace-me'
    const { validateEnv } = await loadEnvModule()

    expect(() => validateEnv()).toThrow('at least 32 characters')
  })

  it('rejects production mock authentication', async () => {
    setValidProductionEnvironment()
    mutableEnv.NEXT_PUBLIC_ENABLE_MOCK_AUTH = 'true'
    const { validateEnv } = await loadEnvModule()

    expect(() => validateEnv()).toThrow('Mock authentication MUST NOT be enabled')
  })

  it('requires a public platform URL when welcome email is enabled', async () => {
    setValidProductionEnvironment()
    delete mutableEnv.WEB_PLATFORM_URL
    const { validateEnv } = await loadEnvModule()

    expect(() => validateEnv()).toThrow('WEB_PLATFORM_URL is required')
  })

  it('allows a missing platform URL when welcome email is disabled', async () => {
    setValidProductionEnvironment()
    delete mutableEnv.WEB_PLATFORM_URL
    mutableEnv.EMAIL_USER_WELCOME_EMAIL_ENABLED = 'false'
    const { validateEnv } = await loadEnvModule()

    expect(() => validateEnv()).not.toThrow()
  })

  it('requires a webhook secret in production', async () => {
    setValidProductionEnvironment()
    delete mutableEnv.ZAMMAD_WEBHOOK_SECRET
    const { validateEnv } = await loadEnvModule()

    expect(() => validateEnv()).toThrow('ZAMMAD_WEBHOOK_SECRET is required')
  })

  it('returns typed defaults and parses email feature flags', async () => {
    mutableEnv.NODE_ENV = 'test'
    mutableEnv.LOG_LEVEL = 'debug'
    mutableEnv.EMAIL_USER_AUTO_PASSWORD_ENABLED = 'false'
    mutableEnv.EMAIL_USER_WELCOME_EMAIL_ENABLED = 'false'
    const { getEnv } = await loadEnvModule()

    expect(getEnv()).toMatchObject({
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
      EMAIL_USER_AUTO_PASSWORD_ENABLED: false,
      EMAIL_USER_WELCOME_EMAIL_ENABLED: false,
    })
  })

  it('enables mock auth outside production and never enables it in production', async () => {
    mutableEnv.NODE_ENV = 'development'
    let envModule = await loadEnvModule()
    expect(envModule.isMockAuthEnabled()).toBe(true)

    mutableEnv.NODE_ENV = 'production'
    mutableEnv.NEXT_PUBLIC_ENABLE_MOCK_AUTH = 'true'
    envModule = await loadEnvModule()
    expect(envModule.isMockAuthEnabled()).toBe(false)
  })

  it('does not repeat non-strict validation warnings', async () => {
    mutableEnv.NODE_ENV = 'development'
    delete mutableEnv.DATABASE_URL
    delete mutableEnv.ZAMMAD_URL
    delete mutableEnv.ZAMMAD_API_TOKEN
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ensureEnvValidation } = await loadEnvModule()

    ensureEnvValidation({ strict: false })
    ensureEnvValidation({ strict: false })

    expect(warning).toHaveBeenCalledTimes(1)
  })

  it('reruns validation when strict mode follows non-strict mode', async () => {
    mutableEnv.NODE_ENV = 'development'
    delete mutableEnv.DATABASE_URL
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ensureEnvValidation } = await loadEnvModule()

    ensureEnvValidation({ strict: false })
    mutableEnv.NODE_ENV = 'production'

    expect(() => ensureEnvValidation({ strict: true })).toThrow('Missing required environment variables')
    expect(warning).toHaveBeenCalled()
  })
})
