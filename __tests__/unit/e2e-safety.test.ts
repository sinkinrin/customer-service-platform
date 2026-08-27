import { describe, expect, it } from 'vitest'
import {
  assertSafeE2EEnvironment,
  isExplicitTestDatabaseUrl,
} from '../../scripts/e2e-safety'

const safeEnv = {
  RUN_ISOLATED_E2E: 'true',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/customer_service_e2e_test',
  ZAMMAD_URL: 'http://127.0.0.1:65535/',
} as NodeJS.ProcessEnv

describe('E2E safety guard', () => {
  it('rejects E2E execution without explicit isolated opt-in', () => {
    expect(() => assertSafeE2EEnvironment({ ...safeEnv, RUN_ISOLATED_E2E: undefined })).toThrow(
      'disabled by default'
    )
  })

  it('rejects databases without an explicit test name', () => {
    expect(() => assertSafeE2EEnvironment({
      ...safeEnv,
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/customer_service',
    })).toThrow('explicit "test" or "e2e" name segment')
  })

  it.each(['customer_service_latest', 'customer_service_contest'])(
    'rejects a non-test database whose name only contains test letters: %s',
    databaseName => {
      expect(isExplicitTestDatabaseUrl(
        `postgresql://postgres:postgres@127.0.0.1:5432/${databaseName}`
      )).toBe(false)
      expect(() => assertSafeE2EEnvironment({
        ...safeEnv,
        DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:5432/${databaseName}`,
      })).toThrow('explicit "test" or "e2e" name segment')
    }
  )

  it.each(['test', 'test_customer_service', 'customer-service-test', 'customer.service.e2e'])(
    'accepts an explicit test database name segment: %s',
    databaseName => {
      expect(isExplicitTestDatabaseUrl(
        `postgresql://postgres:postgres@127.0.0.1:5432/${databaseName}`
      )).toBe(true)
      expect(() => assertSafeE2EEnvironment({
        ...safeEnv,
        DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:5432/${databaseName}`,
      })).not.toThrow()
    }
  )

  it('rejects remote services unless they are explicitly allowed', () => {
    expect(() => assertSafeE2EEnvironment({
      ...safeEnv,
      ZAMMAD_URL: 'https://support.example.com/',
    })).toThrow('Remote E2E services are disabled')
  })

  it('accepts loopback services with a test database', () => {
    expect(() => assertSafeE2EEnvironment(safeEnv)).not.toThrow()
  })

  it('allows explicitly approved remote isolated services', () => {
    expect(() => assertSafeE2EEnvironment({
      ...safeEnv,
      DATABASE_URL: 'postgresql://tester:secret@db.test.example.com:5432/customer_service_e2e_test',
      ZAMMAD_URL: 'https://zammad.test.example.com/',
      ALLOW_REMOTE_E2E_SERVICES: 'true',
    })).not.toThrow()
  })
})
