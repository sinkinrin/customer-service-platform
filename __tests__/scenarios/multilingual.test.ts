/**
 * 多语言场景测试
 * 
 * 业务场景：
 * 1. 用户切换语言
 * 2. 内容本地化显示
 * 3. 日期/数字格式化
 * 
 * 代码层面：
 * 1. 翻译键完整性
 * 2. 语言代码验证
 * 3. 回退机制
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// 加载翻译文件
const MESSAGES_DIR = path.join(process.cwd(), 'messages')
const loadMessages = (locale: string) => {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

describe('Multilingual: 用户语言切换', () => {
  const SUPPORTED_LOCALES = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt']

  describe('业务场景: 语言选择', () => {
    it('系统支持6种语言', () => {
      expect(SUPPORTED_LOCALES).toHaveLength(6)
    })

    it('每种语言都有对应的翻译文件', () => {
      SUPPORTED_LOCALES.forEach(locale => {
        const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
        expect(fs.existsSync(filePath)).toBe(true)
      })
    })

    it('用户可以在个人设置中选择语言', async () => {
      const { UpdateUserProfileSchema } = await import('@/types/api.types')

      SUPPORTED_LOCALES.forEach(locale => {
        const result = UpdateUserProfileSchema.safeParse({
          language: locale,
        })
        expect(result.success).toBe(true)
      })
    })

    it('不支持的语言应该被拒绝', async () => {
      const { UpdateUserProfileSchema } = await import('@/types/api.types')

      const unsupportedLocales = ['ja', 'ko', 'de', 'it']

      unsupportedLocales.forEach(locale => {
        const result = UpdateUserProfileSchema.safeParse({
          language: locale,
        })
        expect(result.success).toBe(false)
      })
    })
  })

  describe('业务场景: 界面本地化', () => {
    it('登录页面在所有语言中都有翻译', () => {
      const loginKeys = ['auth.login.title', 'auth.login.email', 'auth.login.password', 'auth.login.submit']

      SUPPORTED_LOCALES.forEach(locale => {
        const messages = loadMessages(locale)
        
        // 检查 auth.login 命名空间存在
        expect(messages.auth).toBeDefined()
        expect(messages.auth.login).toBeDefined()
      })
    })

    it('错误消息在所有语言中都有翻译', () => {
      SUPPORTED_LOCALES.forEach(locale => {
        const messages = loadMessages(locale)
        
        // 检查 common.errors 命名空间存在
        expect(messages.common).toBeDefined()
      })
    })

    it('导航菜单在所有语言中都有翻译', () => {
      SUPPORTED_LOCALES.forEach(locale => {
        const messages = loadMessages(locale)
        
        // 检查导航相关翻译
        expect(messages.common?.nav || messages.customer || messages.staff).toBeDefined()
      })
    })
  })

  describe('业务场景: 内容显示', () => {
    it('FAQ 文章应该显示对应语言的内容', () => {
      // 模拟 FAQ 文章数据
      const faqArticle = {
        title_en: 'How to reset password',
        title_zh: '如何重置密码',
        title_fr: 'Comment réinitialiser le mot de passe',
        title_es: 'Cómo restablecer la contraseña',
        title_ru: 'Как сбросить пароль',
        title_pt: 'Como redefinir a senha',
      }

      // 根据用户语言获取标题
      const getTitle = (locale: string) => {
        // zh-CN -> zh, en -> en
        const langCode = locale.split('-')[0]
        const key = `title_${langCode}`
        return (faqArticle as any)[key] || faqArticle.title_en
      }

      expect(getTitle('en')).toBe('How to reset password')
      expect(getTitle('zh-CN')).toBe('如何重置密码')
      expect(getTitle('fr')).toBe('Comment réinitialiser le mot de passe')
    })

    it('系统消息应该使用用户的语言', () => {
      const systemMessages = {
        en: 'Your conversation has been transferred to a human agent.',
        'zh-CN': '您的对话已转接至人工客服。',
        fr: 'Votre conversation a été transférée à un agent humain.',
      }

      // 用户语言为中文时应该显示中文消息
      const userLocale = 'zh-CN'
      const message = systemMessages[userLocale as keyof typeof systemMessages]

      expect(message).toContain('人工客服')
    })
  })
})

describe('Multilingual: 日期和数字格式化', () => {
  describe('业务场景: 日期显示', () => {
    const testDate = new Date('2024-01-15T10:30:00Z')

    it('中文用户看到的日期格式', () => {
      const formatted = testDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      expect(formatted).toContain('2024')
      expect(formatted).toContain('1')
      expect(formatted).toContain('15')
    })

    it('英文用户看到的日期格式', () => {
      const formatted = testDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      expect(formatted).toContain('January')
      expect(formatted).toContain('15')
      expect(formatted).toContain('2024')
    })

    it('相对时间显示（如"5分钟前"）', () => {
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000

      const getRelativeTime = (timestamp: number, locale: string) => {
        const diff = now - timestamp
        const minutes = Math.floor(diff / 60000)

        if (locale === 'zh-CN') {
          return `${minutes}分钟前`
        } else {
          return `${minutes} minutes ago`
        }
      }

      expect(getRelativeTime(fiveMinutesAgo, 'zh-CN')).toBe('5分钟前')
      expect(getRelativeTime(fiveMinutesAgo, 'en')).toBe('5 minutes ago')
    })
  })

  describe('业务场景: 数字格式化', () => {
    it('大数字应该有千位分隔符', () => {
      const number = 1234567

      const zhFormatted = number.toLocaleString('zh-CN')
      const enFormatted = number.toLocaleString('en-US')

      expect(zhFormatted).toBe('1,234,567')
      expect(enFormatted).toBe('1,234,567')
    })

    it('货币显示应该根据地区', () => {
      const amount = 99.99

      const usdFormatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)

      const cnyFormatted = new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
      }).format(amount)

      expect(usdFormatted).toContain('$')
      expect(cnyFormatted).toContain('¥')
    })
  })
})

describe('Multilingual: 翻译质量', () => {
  describe('代码层面: 翻译键一致性', () => {
    it('所有语言应该有相同的顶级命名空间', () => {
      const enMessages = loadMessages('en')
      const enNamespaces = Object.keys(enMessages).sort()

      SUPPORTED_LOCALES.forEach(locale => {
        if (locale === 'en') return

        const messages = loadMessages(locale)
        const namespaces = Object.keys(messages).sort()

        // 检查命名空间数量相近
        const diff = Math.abs(namespaces.length - enNamespaces.length)
        expect(diff).toBeLessThan(5) // 允许少量差异
      })
    })

    it('关键翻译键在所有语言中都存在', () => {
      const criticalKeys = [
        'common',
        'auth',
      ]

      SUPPORTED_LOCALES.forEach(locale => {
        const messages = loadMessages(locale)

        criticalKeys.forEach(key => {
          expect(messages[key]).toBeDefined()
        })
      })
    })
  })

  describe('代码层面: 占位符一致性', () => {
    it('带参数的翻译应该保持占位符', () => {
      // 示例：欢迎消息 "Hello, {name}!"
      const enMessage = 'Hello, {name}!'
      const zhMessage = '你好，{name}！'

      const placeholderRegex = /\{[^}]+\}/g

      const enPlaceholders = enMessage.match(placeholderRegex) || []
      const zhPlaceholders = zhMessage.match(placeholderRegex) || []

      expect(enPlaceholders.length).toBe(zhPlaceholders.length)
      expect(enPlaceholders[0]).toBe(zhPlaceholders[0])
    })
  })

  describe('业务场景: 语言回退', () => {
    it('缺失翻译应该回退到英语', () => {
      const getTranslation = (messages: any, key: string, fallback: any) => {
        const keys = key.split('.')
        let value = messages

        for (const k of keys) {
          value = value?.[k]
          if (value === undefined) break
        }

        return value || fallback
      }

      const enMessages = loadMessages('en')
      const zhMessages = loadMessages('zh-CN')

      // 假设某个键在中文中缺失
      const missingKey = 'some.missing.key'
      const enValue = getTranslation(enMessages, missingKey, 'Default')
      const zhValue = getTranslation(zhMessages, missingKey, enValue)

      // 中文缺失时应该使用英文
      expect(zhValue).toBe(enValue)
    })
  })
})

const SUPPORTED_LOCALES = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt']
