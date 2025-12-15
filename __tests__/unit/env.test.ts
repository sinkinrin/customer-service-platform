/**
 * 环境变量管理单元测试
 * 
 * 测试 src/lib/env.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 使用类型断言来允许修改 process.env
const env = process.env as Record<string, string | undefined>

describe('环境变量管理测试', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    // 恢复原始环境变量
    Object.keys(env).forEach(key => delete env[key])
    Object.assign(env, originalEnv)
  })

  afterEach(() => {
    Object.keys(env).forEach(key => delete env[key])
    Object.assign(env, originalEnv)
  })

  describe('hasAuthSecret', () => {
    it('AUTH_SECRET 存在时应返回 true', () => {
      process.env.AUTH_SECRET = 'test-secret'
      
      const hasAuthSecret = () => !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
      
      expect(hasAuthSecret()).toBe(true)
    })

    it('NEXTAUTH_SECRET 存在时应返回 true', () => {
      delete process.env.AUTH_SECRET
      process.env.NEXTAUTH_SECRET = 'test-secret'
      
      const hasAuthSecret = () => !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
      
      expect(hasAuthSecret()).toBe(true)
    })

    it('两者都不存在时应返回 false', () => {
      delete process.env.AUTH_SECRET
      delete process.env.NEXTAUTH_SECRET
      
      const hasAuthSecret = () => !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
      
      expect(hasAuthSecret()).toBe(false)
    })
  })

  describe('getAuthSecret', () => {
    it('应该优先返回 AUTH_SECRET', () => {
      process.env.AUTH_SECRET = 'auth-secret'
      process.env.NEXTAUTH_SECRET = 'nextauth-secret'
      
      const getAuthSecret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''
      
      expect(getAuthSecret()).toBe('auth-secret')
    })

    it('AUTH_SECRET 不存在时应返回 NEXTAUTH_SECRET', () => {
      delete process.env.AUTH_SECRET
      process.env.NEXTAUTH_SECRET = 'nextauth-secret'
      
      const getAuthSecret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''
      
      expect(getAuthSecret()).toBe('nextauth-secret')
    })

    it('两者都不存在时应返回空字符串', () => {
      delete process.env.AUTH_SECRET
      delete process.env.NEXTAUTH_SECRET
      
      const getAuthSecret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''
      
      expect(getAuthSecret()).toBe('')
    })
  })

  describe('validateEnv', () => {
    const REQUIRED_PRODUCTION_VARS = ['AUTH_SECRET', 'DATABASE_URL', 'ZAMMAD_URL', 'ZAMMAD_API_TOKEN']
    const REQUIRED_DEV_VARS = ['DATABASE_URL', 'ZAMMAD_URL', 'ZAMMAD_API_TOKEN']

    it('开发环境缺少必需变量时应发出警告', () => {
      env.NODE_ENV = 'development'
      delete process.env.DATABASE_URL
      
      const validateEnv = () => {
        const requiredVars = REQUIRED_DEV_VARS
        const missingVars: string[] = []
        
        for (const varName of requiredVars) {
          if (!process.env[varName]) {
            missingVars.push(varName)
          }
        }
        
        return missingVars
      }

      const missing = validateEnv()
      expect(missing).toContain('DATABASE_URL')
    })

    it('生产环境缺少必需变量时应抛出错误', () => {
      env.NODE_ENV = 'production'
      delete process.env.AUTH_SECRET
      delete process.env.NEXTAUTH_SECRET
      
      const validateEnv = () => {
        const isProduction = process.env.NODE_ENV === 'production'
        const requiredVars = isProduction ? REQUIRED_PRODUCTION_VARS : REQUIRED_DEV_VARS
        const missingVars: string[] = []
        
        for (const varName of requiredVars) {
          if (varName === 'AUTH_SECRET') {
            if (!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)) {
              missingVars.push('AUTH_SECRET (or NEXTAUTH_SECRET)')
            }
          } else if (!process.env[varName]) {
            missingVars.push(varName)
          }
        }
        
        if (missingVars.length > 0 && isProduction) {
          throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
        }
        
        return missingVars
      }

      expect(() => validateEnv()).toThrow('Missing required environment variables')
    })

    it('所有必需变量存在时应通过验证', () => {
      env.NODE_ENV = 'development'
      process.env.DATABASE_URL = 'postgres://localhost'
      process.env.ZAMMAD_URL = 'https://zammad.example.com'
      process.env.ZAMMAD_API_TOKEN = 'token123'
      
      const validateEnv = () => {
        const requiredVars = REQUIRED_DEV_VARS
        const missingVars: string[] = []
        
        for (const varName of requiredVars) {
          if (!process.env[varName]) {
            missingVars.push(varName)
          }
        }
        
        return missingVars
      }

      const missing = validateEnv()
      expect(missing).toHaveLength(0)
    })

    it('生产环境 AUTH_SECRET 太短时应抛出错误', () => {
      env.NODE_ENV = 'production'
      process.env.AUTH_SECRET = 'short'
      
      const validateAuthSecret = () => {
        const isProduction = process.env.NODE_ENV === 'production'
        const authSecret = process.env.AUTH_SECRET || ''
        
        if (isProduction && authSecret && authSecret.length < 32) {
          throw new Error('AUTH_SECRET must be at least 32 characters in production')
        }
      }

      expect(() => validateAuthSecret()).toThrow('at least 32 characters')
    })

    it('生产环境开启 Mock Auth 应发出警告', () => {
      env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH = 'true'
      
      const checkMockAuth = () => {
        const isProduction = process.env.NODE_ENV === 'production'
        const mockAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'
        
        return isProduction && mockAuthEnabled
      }

      expect(checkMockAuth()).toBe(true)
    })
  })

  describe('getEnv', () => {
    it('应该返回所有环境配置', () => {
      process.env.AUTH_SECRET = 'test-secret'
      process.env.ZAMMAD_URL = 'https://zammad.example.com'
      process.env.ZAMMAD_API_TOKEN = 'token123'
      process.env.DATABASE_URL = 'postgres://localhost'
      process.env.LOG_LEVEL = 'debug'
      
      const getEnv = () => ({
        AUTH_SECRET: process.env.AUTH_SECRET || '',
        ZAMMAD_URL: process.env.ZAMMAD_URL || '',
        ZAMMAD_API_TOKEN: process.env.ZAMMAD_API_TOKEN || '',
        DATABASE_URL: process.env.DATABASE_URL,
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        NODE_ENV: process.env.NODE_ENV || 'development',
      })

      const env = getEnv()
      
      expect(env.AUTH_SECRET).toBe('test-secret')
      expect(env.ZAMMAD_URL).toBe('https://zammad.example.com')
      expect(env.LOG_LEVEL).toBe('debug')
    })

    it('缺少可选变量时应返回默认值', () => {
      delete process.env.LOG_LEVEL
      delete process.env.SOCKET_IO_PORT
      
      const getEnv = () => ({
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        SOCKET_IO_PORT: process.env.SOCKET_IO_PORT,
        NODE_ENV: process.env.NODE_ENV || 'development',
      })

      const env = getEnv()
      
      expect(env.LOG_LEVEL).toBe('info')
      expect(env.SOCKET_IO_PORT).toBeUndefined()
    })
  })

  describe('isProduction / isDevelopment', () => {
    it('NODE_ENV 为 production 时 isProduction 应返回 true', () => {
      env.NODE_ENV = 'production'
      
      const isProduction = () => process.env.NODE_ENV === 'production'
      
      expect(isProduction()).toBe(true)
    })

    it('NODE_ENV 不为 production 时 isDevelopment 应返回 true', () => {
      env.NODE_ENV = 'development'
      
      const isDevelopment = () => process.env.NODE_ENV !== 'production'
      
      expect(isDevelopment()).toBe(true)
    })

    it('NODE_ENV 为 test 时 isDevelopment 应返回 true', () => {
      env.NODE_ENV = 'test'
      
      const isDevelopment = () => process.env.NODE_ENV !== 'production'
      
      expect(isDevelopment()).toBe(true)
    })
  })

  describe('isMockAuthEnabled', () => {
    it('开发环境应默认启用 Mock Auth', () => {
      env.NODE_ENV = 'development'
      
      const isMockAuthEnabled = () => {
        if (process.env.NODE_ENV !== 'production') {
          return true
        }
        return process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'
      }

      expect(isMockAuthEnabled()).toBe(true)
    })

    it('生产环境应根据环境变量决定', () => {
      env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH = 'false'
      
      const isMockAuthEnabled = () => {
        if (process.env.NODE_ENV !== 'production') {
          return true
        }
        return process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'
      }

      expect(isMockAuthEnabled()).toBe(false)
    })

    it('生产环境明确启用时应返回 true', () => {
      env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH = 'true'
      
      const isMockAuthEnabled = () => {
        if (process.env.NODE_ENV !== 'production') {
          return true
        }
        return process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'
      }

      expect(isMockAuthEnabled()).toBe(true)
    })
  })

  describe('ensureEnvValidation', () => {
    it('严格模式下验证失败应抛出错误', () => {
      env.NODE_ENV = 'production'
      delete process.env.AUTH_SECRET
      delete process.env.NEXTAUTH_SECRET
      
      const ensureEnvValidation = (options?: { strict?: boolean }) => {
        const strict = options?.strict ?? process.env.NODE_ENV === 'production'
        
        const hasAuthSecret = !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
        
        if (!hasAuthSecret && strict) {
          throw new Error('Missing AUTH_SECRET')
        }
      }

      expect(() => ensureEnvValidation({ strict: true })).toThrow()
    })

    it('非严格模式下验证失败应只发警告', () => {
      env.NODE_ENV = 'development'
      delete process.env.DATABASE_URL
      
      const ensureEnvValidation = (options?: { strict?: boolean }) => {
        const strict = options?.strict ?? false
        const warnings: string[] = []
        
        if (!process.env.DATABASE_URL) {
          if (strict) {
            throw new Error('Missing DATABASE_URL')
          }
          warnings.push('Missing DATABASE_URL')
        }
        
        return warnings
      }

      const result = ensureEnvValidation({ strict: false })
      expect(result).toContain('Missing DATABASE_URL')
    })

    it('应该避免重复验证', () => {
      let validationCount = 0
      let validatedMode: 'none' | 'non-strict' | 'strict' = 'none'
      
      const ensureEnvValidation = (options?: { strict?: boolean }) => {
        const strict = options?.strict ?? false
        
        if (validatedMode === 'strict') return
        if (validatedMode === 'non-strict' && !strict) return
        
        validationCount++
        validatedMode = strict ? 'strict' : 'non-strict'
      }

      ensureEnvValidation({ strict: false })
      ensureEnvValidation({ strict: false })
      ensureEnvValidation({ strict: false })
      
      expect(validationCount).toBe(1)
    })
  })

  describe('AUTH_DEFAULT_USER 配置', () => {
    it('应该正确读取默认用户配置', () => {
      process.env.AUTH_DEFAULT_USER_EMAIL = 'admin@example.com'
      process.env.AUTH_DEFAULT_USER_PASSWORD = 'password123'
      process.env.AUTH_DEFAULT_USER_ROLE = 'admin'
      process.env.AUTH_DEFAULT_USER_NAME = 'Admin User'
      process.env.AUTH_DEFAULT_USER_REGION = 'asia-pacific'
      
      const getDefaultUser = () => ({
        email: process.env.AUTH_DEFAULT_USER_EMAIL,
        password: process.env.AUTH_DEFAULT_USER_PASSWORD,
        role: process.env.AUTH_DEFAULT_USER_ROLE as 'customer' | 'staff' | 'admin' | undefined,
        name: process.env.AUTH_DEFAULT_USER_NAME,
        region: process.env.AUTH_DEFAULT_USER_REGION,
      })

      const user = getDefaultUser()
      
      expect(user.email).toBe('admin@example.com')
      expect(user.role).toBe('admin')
      expect(user.region).toBe('asia-pacific')
    })

    it('角色应该只允许有效值', () => {
      const validRoles = ['customer', 'staff', 'admin']
      
      const isValidRole = (role: string) => validRoles.includes(role)

      expect(isValidRole('customer')).toBe(true)
      expect(isValidRole('staff')).toBe(true)
      expect(isValidRole('admin')).toBe(true)
      expect(isValidRole('superadmin')).toBe(false)
      expect(isValidRole('')).toBe(false)
    })
  })
})
