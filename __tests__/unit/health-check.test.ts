/**
 * Health Check API 单元测试
 * 
 * 测试健康检查端点的响应格式和状态判断逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/zammad/health-check', () => ({
  checkZammadHealth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/env', () => ({
  ensureEnvValidation: vi.fn(),
  isProduction: vi.fn(() => false),
  hasAuthSecret: vi.fn(() => true),
}))

import { checkZammadHealth } from '@/lib/zammad/health-check'
import { prisma } from '@/lib/prisma'
import { ensureEnvValidation, isProduction } from '@/lib/env'

describe('Health Check Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment
    process.env.DATABASE_URL = 'postgresql://test'
    process.env.ZAMMAD_URL = 'https://zammad.test'
    process.env.ZAMMAD_API_TOKEN = 'test-token'
  })

  describe('Service Status Determination', () => {
    it('should return healthy when all services are connected', async () => {
      vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: true })
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('healthy')
      expect(json.data.services.zammad.status).toBe('connected')
      expect(json.data.services.database.status).toBe('connected')
    })

    it('should return degraded when Zammad is not connected', async () => {
      vi.mocked(checkZammadHealth).mockResolvedValue({ 
        isHealthy: false, 
        error: 'Connection refused' 
      })
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.data.status).toBe('degraded')
      expect(json.data.services.zammad.status).toBe('error')
      expect(json.data.services.database.status).toBe('connected')
    })

    it('should return degraded when database is not connected in dev', async () => {
      vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: true })
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection failed'))
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)
      vi.mocked(isProduction).mockReturnValue(false)

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      expect(json.data.status).toBe('degraded')
      expect(json.data.services.database.status).toBe('error')
    })

    it('should return unhealthy when env validation fails', async () => {
      vi.mocked(ensureEnvValidation).mockImplementation(() => {
        throw new Error('Missing required environment variables')
      })

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(503)
      expect(json.success).toBe(false)
      expect(json.data.status).toBe('unhealthy')
    })
  })

  describe('Response Format', () => {
    it('should include all required fields', async () => {
      vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: true })
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      // Check required fields
      expect(json.data).toHaveProperty('status')
      expect(json.data).toHaveProperty('timestamp')
      expect(json.data).toHaveProperty('version')
      expect(json.data).toHaveProperty('environment')
      expect(json.data).toHaveProperty('services')
      expect(json.data).toHaveProperty('config')
      expect(json.data).toHaveProperty('responseTimeMs')

      // Check services structure
      expect(json.data.services).toHaveProperty('zammad')
      expect(json.data.services).toHaveProperty('database')

      // Check config structure
      expect(json.data.config).toHaveProperty('mockAuthEnabled')
      expect(json.data.config).toHaveProperty('hasAuthSecret')
      expect(json.data.config).toHaveProperty('hasZammadConfig')
      expect(json.data.config).toHaveProperty('hasDatabaseConfig')
    })

    it('should include response time in milliseconds', async () => {
      vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: true })
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      expect(typeof json.data.responseTimeMs).toBe('number')
      expect(json.data.responseTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('should include valid timestamp', async () => {
      vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: true })
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      const timestamp = new Date(json.data.timestamp)
      expect(timestamp.getTime()).not.toBeNaN()
    })
  })

  describe('Config Detection', () => {
    it('should detect Zammad config presence', async () => {
      vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: true })
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)

      process.env.ZAMMAD_URL = 'https://zammad.test'
      process.env.ZAMMAD_API_TOKEN = 'test-token'

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      expect(json.data.config.hasZammadConfig).toBe(true)
    })

    it('should detect missing Zammad config', async () => {
      vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: false })
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)

      delete process.env.ZAMMAD_URL
      delete process.env.ZAMMAD_API_TOKEN

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      expect(json.data.config.hasZammadConfig).toBe(false)
    })

    it('should detect database config presence', async () => {
      vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: true })
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)

      process.env.DATABASE_URL = 'postgresql://test'

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      expect(json.data.config.hasDatabaseConfig).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle Zammad check throwing error', async () => {
      vi.mocked(checkZammadHealth).mockRejectedValue(new Error('Network error'))
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      expect(json.data.status).toBe('degraded')
      expect(json.data.services.zammad.status).toBe('error')
      expect(json.data.services.zammad.message).toBe('Network error')
    })

    it('should handle database check throwing error', async () => {
      vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: true })
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Database timeout'))
      vi.mocked(ensureEnvValidation).mockReturnValue(undefined)

      const { GET } = await import('@/app/api/health/route')
      const response = await GET()
      const json = await response.json()

      expect(json.data.services.database.status).toBe('error')
      expect(json.data.services.database.message).toBe('Database timeout')
    })
  })
})
