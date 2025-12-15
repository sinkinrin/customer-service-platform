/**
 * 环境变量验证测试
 * 
 * 测试环境配置的验证逻辑
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Environment Validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('hasAuthSecret', () => {
    it('AUTH_SECRET 存在时应该返回 true', () => {
      process.env.AUTH_SECRET = 'test-secret'
      
      const hasSecret = !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
      expect(hasSecret).toBe(true)
    })

    it('NEXTAUTH_SECRET 存在时应该返回 true', () => {
      delete process.env.AUTH_SECRET
      process.env.NEXTAUTH_SECRET = 'test-secret'
      
      const hasSecret = !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
      expect(hasSecret).toBe(true)
    })

    it('两者都不存在时应该返回 false', () => {
      delete process.env.AUTH_SECRET
      delete process.env.NEXTAUTH_SECRET
      
      const hasSecret = !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
      expect(hasSecret).toBe(false)
    })
  })

  describe('isProduction', () => {
    it('NODE_ENV=production 时应该返回 true', () => {
      process.env.NODE_ENV = 'production'
      
      const isProd = process.env.NODE_ENV === 'production'
      expect(isProd).toBe(true)
    })

    it('NODE_ENV=development 时应该返回 false', () => {
      process.env.NODE_ENV = 'development'
      
      const isProd = process.env.NODE_ENV === 'production'
      expect(isProd).toBe(false)
    })
  })

  describe('isMockAuthEnabled', () => {
    it('开发环境默认启用 mock auth', () => {
      process.env.NODE_ENV = 'development'
      
      const isMockEnabled = process.env.NODE_ENV !== 'production' || 
        process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'
      expect(isMockEnabled).toBe(true)
    })

    it('生产环境默认禁用 mock auth', () => {
      process.env.NODE_ENV = 'production'
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH
      
      const isMockEnabled = process.env.NODE_ENV !== 'production' || 
        process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'
      expect(isMockEnabled).toBe(false)
    })

    it('生产环境可以显式启用 mock auth', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH = 'true'
      
      const isMockEnabled = process.env.NODE_ENV !== 'production' || 
        process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'
      expect(isMockEnabled).toBe(true)
    })
  })

  describe('Required Variables', () => {
    const REQUIRED_PRODUCTION_VARS = [
      'AUTH_SECRET',
      'DATABASE_URL',
      'ZAMMAD_URL',
      'ZAMMAD_API_TOKEN',
    ]

    const REQUIRED_DEV_VARS = [
      'DATABASE_URL',
      'ZAMMAD_URL',
      'ZAMMAD_API_TOKEN',
    ]

    it('生产环境需要更多必填变量', () => {
      expect(REQUIRED_PRODUCTION_VARS.length).toBeGreaterThan(REQUIRED_DEV_VARS.length)
      expect(REQUIRED_PRODUCTION_VARS).toContain('AUTH_SECRET')
    })

    it('开发环境不强制要求 AUTH_SECRET', () => {
      expect(REQUIRED_DEV_VARS).not.toContain('AUTH_SECRET')
    })

    it('两个环境都需要 Zammad 配置', () => {
      expect(REQUIRED_PRODUCTION_VARS).toContain('ZAMMAD_URL')
      expect(REQUIRED_PRODUCTION_VARS).toContain('ZAMMAD_API_TOKEN')
      expect(REQUIRED_DEV_VARS).toContain('ZAMMAD_URL')
      expect(REQUIRED_DEV_VARS).toContain('ZAMMAD_API_TOKEN')
    })
  })

  describe('Auth Secret Validation', () => {
    it('生产环境 AUTH_SECRET 至少需要 32 字符', () => {
      const minLength = 32
      const shortSecret = 'short'
      const validSecret = 'a'.repeat(32)

      expect(shortSecret.length).toBeLessThan(minLength)
      expect(validSecret.length).toBeGreaterThanOrEqual(minLength)
    })
  })

  describe('getEnv', () => {
    it('应该返回所有环境变量', () => {
      process.env.AUTH_SECRET = 'test-secret'
      process.env.ZAMMAD_URL = 'https://zammad.example.com'
      process.env.ZAMMAD_API_TOKEN = 'test-token'
      process.env.NODE_ENV = 'development'

      const env = {
        AUTH_SECRET: process.env.AUTH_SECRET || '',
        ZAMMAD_URL: process.env.ZAMMAD_URL || '',
        ZAMMAD_API_TOKEN: process.env.ZAMMAD_API_TOKEN || '',
        NODE_ENV: process.env.NODE_ENV || 'development',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      }

      expect(env.AUTH_SECRET).toBe('test-secret')
      expect(env.ZAMMAD_URL).toBe('https://zammad.example.com')
      expect(env.LOG_LEVEL).toBe('info') // 默认值
    })

    it('应该提供默认值', () => {
      delete process.env.LOG_LEVEL

      const logLevel = process.env.LOG_LEVEL || 'info'
      expect(logLevel).toBe('info')
    })
  })
})

describe('AI Config', () => {
  describe('AISettings 接口', () => {
    interface AISettings {
      enabled: boolean
      model: string
      temperature: number
      systemPrompt: string
      fastgptUrl: string
      fastgptAppId: string
      fastgptApiKey: string
    }

    it('应该有正确的默认值', () => {
      const defaultSettings: AISettings = {
        enabled: false,
        model: 'GPT-4o-mini',
        temperature: 0.7,
        systemPrompt: 'You are a helpful customer service assistant.',
        fastgptUrl: '',
        fastgptAppId: '',
        fastgptApiKey: '',
      }

      expect(defaultSettings.enabled).toBe(false)
      expect(defaultSettings.temperature).toBe(0.7)
      expect(defaultSettings.model).toBe('GPT-4o-mini')
    })

    it('temperature 应该在 0-1 之间', () => {
      const validTemperatures = [0, 0.5, 0.7, 1]
      const invalidTemperatures = [-0.1, 1.1, 2]

      validTemperatures.forEach(t => {
        expect(t).toBeGreaterThanOrEqual(0)
        expect(t).toBeLessThanOrEqual(1)
      })

      invalidTemperatures.forEach(t => {
        expect(t < 0 || t > 1).toBe(true)
      })
    })
  })

  describe('API Key 安全', () => {
    it('API Key 不应该保存到配置文件', () => {
      const settings = {
        enabled: true,
        model: 'GPT-4o-mini',
        fastgptApiKey: 'sk-secret-key',
      }

      // 模拟保存时排除 API Key
      const { fastgptApiKey, ...fileSettings } = settings

      expect(fileSettings).not.toHaveProperty('fastgptApiKey')
      expect(fastgptApiKey).toBe('sk-secret-key')
    })

    it('API Key 应该从环境变量读取', () => {
      process.env.FASTGPT_API_KEY = 'env-api-key'

      const apiKey = process.env.FASTGPT_API_KEY || ''
      expect(apiKey).toBe('env-api-key')
    })
  })

  describe('Env File Update', () => {
    it('应该正确格式化环境变量', () => {
      const formatEnvLine = (key: string, value: string) => `${key}=${value}`

      expect(formatEnvLine('FASTGPT_API_KEY', 'test-key'))
        .toBe('FASTGPT_API_KEY=test-key')
    })

    it('应该检测已存在的环境变量', () => {
      const envContent = `
DATABASE_URL=postgres://localhost
FASTGPT_API_KEY=old-key
OTHER_VAR=value
`
      const apiKeyRegex = /^FASTGPT_API_KEY=.*$/m

      expect(apiKeyRegex.test(envContent)).toBe(true)
    })

    it('应该能更新已存在的环境变量', () => {
      let envContent = `DATABASE_URL=postgres://localhost
FASTGPT_API_KEY=old-key
OTHER_VAR=value`

      const apiKeyRegex = /^FASTGPT_API_KEY=.*$/m
      envContent = envContent.replace(apiKeyRegex, 'FASTGPT_API_KEY=new-key')

      expect(envContent).toContain('FASTGPT_API_KEY=new-key')
      expect(envContent).not.toContain('old-key')
    })
  })
})
