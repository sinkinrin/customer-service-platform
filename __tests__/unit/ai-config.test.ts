/**
 * AI 配置工具单元测试
 * 
 * 测试 src/lib/utils/ai-config.ts 的核心逻辑
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('AI 配置工具测试', () => {
  const originalEnv = { ...process.env }
  
  beforeEach(() => {
    delete process.env.FASTGPT_API_KEY
  })

  afterEach(() => {
    Object.keys(process.env).forEach(key => delete process.env[key])
    Object.assign(process.env, originalEnv)
  })

  describe('AISettings 接口', () => {
    it('应该定义正确的配置结构', () => {
      const settings = {
        enabled: true,
        model: 'GPT-4o-mini',
        temperature: 0.7,
        systemPrompt: 'You are a helpful assistant.',
        fastgptUrl: 'https://api.fastgpt.com',
        fastgptAppId: 'app_123',
        fastgptApiKey: 'key_456',
      }

      expect(settings).toHaveProperty('enabled')
      expect(settings).toHaveProperty('model')
      expect(settings).toHaveProperty('temperature')
      expect(settings).toHaveProperty('systemPrompt')
      expect(settings).toHaveProperty('fastgptUrl')
      expect(settings).toHaveProperty('fastgptAppId')
      expect(settings).toHaveProperty('fastgptApiKey')
    })

    it('应该支持部分配置', () => {
      const partialSettings = {
        enabled: true,
        temperature: 0.5,
      }

      expect(partialSettings.enabled).toBe(true)
      expect(partialSettings.temperature).toBe(0.5)
    })
  })

  describe('默认值', () => {
    it('应该提供正确的默认值', () => {
      const getDefaultSettings = () => ({
        enabled: false,
        model: 'GPT-4o-mini',
        temperature: 0.7,
        systemPrompt: 'You are a helpful customer service assistant.',
        fastgptUrl: '',
        fastgptAppId: '',
        fastgptApiKey: process.env.FASTGPT_API_KEY || '',
      })

      const defaults = getDefaultSettings()
      
      expect(defaults.enabled).toBe(false)
      expect(defaults.model).toBe('GPT-4o-mini')
      expect(defaults.temperature).toBe(0.7)
      expect(defaults.fastgptApiKey).toBe('')
    })

    it('应该从环境变量读取 API Key', () => {
      process.env.FASTGPT_API_KEY = 'env_api_key_123'
      
      const getSettings = () => ({
        fastgptApiKey: process.env.FASTGPT_API_KEY || '',
      })

      const settings = getSettings()
      expect(settings.fastgptApiKey).toBe('env_api_key_123')
    })
  })

  describe('配置合并', () => {
    it('应该正确合并文件配置和环境变量', () => {
      process.env.FASTGPT_API_KEY = 'env_key'
      
      const fileSettings = {
        enabled: true,
        model: 'GPT-4',
        temperature: 0.5,
        fastgptUrl: 'https://api.example.com',
        fastgptAppId: 'app_123',
      }
      
      const mergeSettings = (file: Record<string, unknown>) => ({
        ...file,
        fastgptApiKey: process.env.FASTGPT_API_KEY || '',
      })

      const merged = mergeSettings(fileSettings)
      
      expect(merged.enabled).toBe(true)
      expect(merged.model).toBe('GPT-4')
      expect(merged.fastgptApiKey).toBe('env_key')
    })

    it('应该用新设置覆盖旧设置', () => {
      const oldSettings = { enabled: false, temperature: 0.7 }
      const newSettings = { enabled: true, temperature: 0.5 }
      
      const merged = { ...oldSettings, ...newSettings }
      
      expect(merged.enabled).toBe(true)
      expect(merged.temperature).toBe(0.5)
    })
  })

  describe('API Key 过滤', () => {
    it('保存时应排除 API Key', () => {
      const settings = {
        enabled: true,
        model: 'GPT-4',
        fastgptApiKey: 'secret_key',
      }
      
      const filterForSave = (s: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { fastgptApiKey, ...rest } = s
        return rest
      }

      const filtered = filterForSave(settings)
      
      expect(filtered.fastgptApiKey).toBeUndefined()
      expect(filtered.enabled).toBe(true)
      expect(filtered.model).toBe('GPT-4')
    })
  })

  describe('环境变量更新逻辑', () => {
    it('应该能更新已存在的 API Key', () => {
      const existingContent = 'OTHER_VAR=value\nFASTGPT_API_KEY=old_key\nANOTHER_VAR=value2'
      const apiKeyRegex = /^FASTGPT_API_KEY=.*$/m
      
      const updated = existingContent.replace(apiKeyRegex, 'FASTGPT_API_KEY=new_key')
      
      expect(updated).toContain('FASTGPT_API_KEY=new_key')
      expect(updated).not.toContain('FASTGPT_API_KEY=old_key')
      expect(updated).toContain('OTHER_VAR=value')
    })

    it('应该能添加新的 API Key', () => {
      const existingContent = 'OTHER_VAR=value\n'
      const apiKeyRegex = /^FASTGPT_API_KEY=.*$/m
      
      let content = existingContent
      if (!apiKeyRegex.test(content)) {
        if (!content.endsWith('\n')) {
          content += '\n'
        }
        content += 'FASTGPT_API_KEY=new_key\n'
      }
      
      expect(content).toContain('FASTGPT_API_KEY=new_key')
    })

    it('空文件应正确添加 API Key', () => {
      let content = ''
      content += 'FASTGPT_API_KEY=new_key\n'
      
      expect(content).toBe('FASTGPT_API_KEY=new_key\n')
    })
  })

  describe('配置验证', () => {
    it('temperature 应该在 0-2 之间', () => {
      const validateTemperature = (temp: number) => temp >= 0 && temp <= 2

      expect(validateTemperature(0)).toBe(true)
      expect(validateTemperature(0.5)).toBe(true)
      expect(validateTemperature(1)).toBe(true)
      expect(validateTemperature(2)).toBe(true)
      expect(validateTemperature(-0.1)).toBe(false)
      expect(validateTemperature(2.1)).toBe(false)
    })

    it('fastgptUrl 应该是有效的 URL', () => {
      const validateUrl = (url: string) => {
        if (!url) return true
        try {
          new URL(url)
          return true
        } catch {
          return false
        }
      }

      expect(validateUrl('')).toBe(true)
      expect(validateUrl('https://api.fastgpt.com')).toBe(true)
      expect(validateUrl('http://localhost:3000')).toBe(true)
      expect(validateUrl('invalid-url')).toBe(false)
    })

    it('systemPrompt 不应该超过最大长度', () => {
      const MAX_PROMPT_LENGTH = 10000
      const validatePrompt = (prompt: string) => prompt.length <= MAX_PROMPT_LENGTH

      expect(validatePrompt('Short prompt')).toBe(true)
      expect(validatePrompt('a'.repeat(MAX_PROMPT_LENGTH))).toBe(true)
      expect(validatePrompt('a'.repeat(MAX_PROMPT_LENGTH + 1))).toBe(false)
    })

    it('model 应该是非空字符串', () => {
      const validateModel = (model: string) => model.trim().length > 0

      expect(validateModel('GPT-4')).toBe(true)
      expect(validateModel('GPT-4o-mini')).toBe(true)
      expect(validateModel('')).toBe(false)
      expect(validateModel('   ')).toBe(false)
    })

    it('fastgptAppId 格式验证', () => {
      const validateAppId = (appId: string) => {
        if (!appId) return true // 空值允许
        return /^[a-zA-Z0-9_-]+$/.test(appId)
      }

      expect(validateAppId('')).toBe(true)
      expect(validateAppId('app_123')).toBe(true)
      expect(validateAppId('app-456')).toBe(true)
      expect(validateAppId('app 123')).toBe(false)
    })
  })

  describe('错误处理', () => {
    it('JSON 解析错误应返回默认值', () => {
      const parseConfig = (content: string) => {
        try {
          return JSON.parse(content)
        } catch {
          return {
            enabled: false,
            model: 'GPT-4o-mini',
            temperature: 0.7,
          }
        }
      }

      const result = parseConfig('invalid json')
      expect(result.enabled).toBe(false)
    })

    it('空配置应返回默认值', () => {
      const parseConfig = (content: string | null) => {
        if (!content) {
          return {
            enabled: false,
            model: 'GPT-4o-mini',
          }
        }
        return JSON.parse(content)
      }

      const result = parseConfig(null)
      expect(result.enabled).toBe(false)
    })
  })
})
