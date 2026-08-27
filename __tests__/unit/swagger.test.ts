import { describe, expect, it } from 'vitest'
import { getApiDocs } from '@/lib/swagger'

describe('OpenAPI generation', () => {
  it('generates the documented API specification', async () => {
    const spec = await getApiDocs() as {
      openapi?: string
      info?: { title?: string; version?: string }
      paths?: Record<string, unknown>
    }

    expect(spec.openapi).toBe('3.0.0')
    expect(spec.info).toMatchObject({
      title: 'Customer Service Platform API',
      version: '1.0.0',
    })
    expect(Object.keys(spec.paths ?? {}).length).toBeGreaterThan(0)
  })
})
