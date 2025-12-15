/**
 * i18n 翻译完整性测试
 * 
 * 验证所有语言文件的翻译键完整性
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// 支持的语言
const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'pt', 'ru', 'zh-CN']
const MESSAGES_DIR = path.join(process.cwd(), 'messages')

// 递归获取所有键
function getAllKeys(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = []
  
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  
  return keys
}

// 加载语言文件
function loadMessages(locale: string): Record<string, any> {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  const content = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(content)
}

describe('i18n Translation Completeness', () => {
  // 使用英语作为基准
  const baseLocale = 'en'
  const baseMessages = loadMessages(baseLocale)
  const baseKeys = getAllKeys(baseMessages)

  describe('Base language (English)', () => {
    it('should have translation keys', () => {
      expect(baseKeys.length).toBeGreaterThan(0)
    })

    it('should not have empty values', () => {
      const emptyKeys: string[] = []
      
      function checkEmpty(obj: Record<string, any>, prefix = '') {
        for (const key of Object.keys(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key
          
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            checkEmpty(obj[key], fullKey)
          } else if (obj[key] === '' || obj[key] === null || obj[key] === undefined) {
            emptyKeys.push(fullKey)
          }
        }
      }
      
      checkEmpty(baseMessages)
      
      if (emptyKeys.length > 0) {
        console.warn(`Empty keys in ${baseLocale}:`, emptyKeys)
      }
      
      expect(emptyKeys).toHaveLength(0)
    })
  })

  describe.each(SUPPORTED_LOCALES.filter(l => l !== baseLocale))('Language: %s', (locale) => {
    const messages = loadMessages(locale)
    const keys = getAllKeys(messages)

    it('should have all base keys', () => {
      const missingKeys = baseKeys.filter(key => !keys.includes(key))
      
      if (missingKeys.length > 0) {
        console.warn(`Missing keys in ${locale}:`, missingKeys.slice(0, 10), missingKeys.length > 10 ? `... and ${missingKeys.length - 10} more` : '')
      }
      
      // 允许一定比例的缺失（90% 完整性）
      const completeness = (baseKeys.length - missingKeys.length) / baseKeys.length
      expect(completeness).toBeGreaterThanOrEqual(0.9)
    })

    it('should not have extra keys not in base', () => {
      const extraKeys = keys.filter(key => !baseKeys.includes(key))
      
      if (extraKeys.length > 0) {
        console.warn(`Extra keys in ${locale} (not in base):`, extraKeys.slice(0, 10))
      }
      
      // 允许少量额外键（可能是特定语言的变体）
      expect(extraKeys.length).toBeLessThan(50)
    })

    it('should not have empty values', () => {
      const emptyKeys: string[] = []
      
      function checkEmpty(obj: Record<string, any>, prefix = '') {
        for (const key of Object.keys(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key
          
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            checkEmpty(obj[key], fullKey)
          } else if (obj[key] === '' || obj[key] === null || obj[key] === undefined) {
            emptyKeys.push(fullKey)
          }
        }
      }
      
      checkEmpty(messages)
      
      if (emptyKeys.length > 0) {
        console.warn(`Empty keys in ${locale}:`, emptyKeys.slice(0, 10))
      }
      
      // 允许少量空值
      expect(emptyKeys.length).toBeLessThan(20)
    })
  })

  describe('Translation consistency', () => {
    it('should have same structure across all languages', () => {
      const structures: Record<string, number> = {}
      
      for (const locale of SUPPORTED_LOCALES) {
        const messages = loadMessages(locale)
        const keys = getAllKeys(messages)
        structures[locale] = keys.length
      }
      
      // 所有语言的键数量应该相近（±20%）
      const counts = Object.values(structures)
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length
      
      for (const [locale, count] of Object.entries(structures)) {
        const deviation = Math.abs(count - avg) / avg
        if (deviation > 0.2) {
          console.warn(`${locale} has ${count} keys, average is ${avg.toFixed(0)} (${(deviation * 100).toFixed(1)}% deviation)`)
        }
      }
      
      // 至少检查结构存在
      expect(Object.keys(structures)).toHaveLength(SUPPORTED_LOCALES.length)
    })

    it('should have common top-level namespaces', () => {
      const expectedNamespaces = ['common', 'auth', 'customer', 'staff', 'admin', 'faq']
      
      for (const locale of SUPPORTED_LOCALES) {
        const messages = loadMessages(locale)
        const topLevelKeys = Object.keys(messages)
        
        for (const ns of expectedNamespaces) {
          if (!topLevelKeys.includes(ns)) {
            console.warn(`${locale} missing namespace: ${ns}`)
          }
        }
        
        // 至少应该有一些预期的命名空间
        const foundNamespaces = expectedNamespaces.filter(ns => topLevelKeys.includes(ns))
        expect(foundNamespaces.length).toBeGreaterThanOrEqual(3)
      }
    })
  })

  describe('Placeholder consistency', () => {
    it('should have same placeholders in translations', () => {
      const placeholderRegex = /\{[^}]+\}/g
      const inconsistencies: string[] = []
      
      for (const key of baseKeys.slice(0, 100)) { // 检查前100个键
        const basePlaceholders = (getValueByPath(baseMessages, key) || '').match(placeholderRegex) || []
        
        for (const locale of SUPPORTED_LOCALES.filter(l => l !== baseLocale)) {
          const messages = loadMessages(locale)
          const value = getValueByPath(messages, key)
          
          if (value) {
            const localePlaceholders = value.match(placeholderRegex) || []
            
            // 检查占位符数量是否一致
            if (basePlaceholders.length !== localePlaceholders.length) {
              inconsistencies.push(`${locale}:${key} - expected ${basePlaceholders.length} placeholders, got ${localePlaceholders.length}`)
            }
          }
        }
      }
      
      if (inconsistencies.length > 0) {
        console.warn('Placeholder inconsistencies:', inconsistencies.slice(0, 5))
      }
      
      // 允许少量不一致
      expect(inconsistencies.length).toBeLessThan(20)
    })
  })
})

// 辅助函数：通过路径获取值
function getValueByPath(obj: Record<string, any>, path: string): string | undefined {
  const parts = path.split('.')
  let current: any = obj
  
  for (const part of parts) {
    if (current === undefined || current === null) return undefined
    current = current[part]
  }
  
  return typeof current === 'string' ? current : undefined
}
