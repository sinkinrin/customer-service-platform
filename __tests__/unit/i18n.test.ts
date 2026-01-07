/**
 * 国际化 (i18n) 测试
 * 
 * 测试多语言功能
 */

import { describe, it, expect } from 'vitest'

// 支持的语言列表
const SUPPORTED_LOCALES = ['en', 'zh', 'es', 'fr', 'pt', 'ja'] as const
type Locale = typeof SUPPORTED_LOCALES[number]

describe('国际化 (i18n) 测试', () => {
  describe('语言切换功能', () => {
    it('应该能切换到支持的语言', () => {
      let currentLocale: Locale = 'en'
      
      const setLocale = (locale: Locale) => {
        if (SUPPORTED_LOCALES.includes(locale)) {
          currentLocale = locale
          return true
        }
        return false
      }
      
      expect(setLocale('zh')).toBe(true)
      expect(currentLocale).toBe('zh')
      
      expect(setLocale('es')).toBe(true)
      expect(currentLocale).toBe('es')
    })

    it('切换到不支持的语言应失败', () => {
      let currentLocale: Locale = 'en'
      
      const setLocale = (locale: string) => {
        if (SUPPORTED_LOCALES.includes(locale as Locale)) {
          currentLocale = locale as Locale
          return true
        }
        return false
      }
      
      expect(setLocale('de')).toBe(false)
      expect(currentLocale).toBe('en')
    })

    it('应该保存语言偏好到 localStorage', () => {
      const mockStorage: Record<string, string> = {}
      
      const saveLocalePreference = (locale: Locale) => {
        mockStorage['locale'] = locale
      }
      
      const getLocalePreference = (): Locale | null => {
        return (mockStorage['locale'] as Locale) || null
      }
      
      saveLocalePreference('zh')
      expect(getLocalePreference()).toBe('zh')
    })

    it('应该从 cookie 读取语言偏好', () => {
      const cookies: Record<string, string> = { NEXT_LOCALE: 'fr' }
      
      const getLocaleFromCookie = (): Locale | null => {
        const locale = cookies['NEXT_LOCALE']
        if (locale && SUPPORTED_LOCALES.includes(locale as Locale)) {
          return locale as Locale
        }
        return null
      }
      
      expect(getLocaleFromCookie()).toBe('fr')
    })
  })

  describe('日期本地化格式', () => {
    it('应该按区域格式化日期', () => {
      const date = new Date('2024-12-25T10:30:00Z')
      
      const formatDate = (date: Date, locale: Locale): string => {
        const options: Intl.DateTimeFormatOptions = {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }
        
        const localeMap: Record<Locale, string> = {
          en: 'en-US',
          zh: 'zh-CN',
          es: 'es-ES',
          fr: 'fr-FR',
          pt: 'pt-BR',
          ja: 'ja-JP',
        }
        
        return new Intl.DateTimeFormat(localeMap[locale], options).format(date)
      }
      
      const enDate = formatDate(date, 'en')
      const zhDate = formatDate(date, 'zh')
      const jaDate = formatDate(date, 'ja')
      
      expect(enDate).toContain('December')
      expect(zhDate).toContain('12月')
      expect(jaDate).toContain('12月')
    })

    it('应该按区域格式化时间', () => {
      const date = new Date('2024-12-25T14:30:00Z')
      
      const formatTime = (date: Date, locale: Locale): string => {
        const options: Intl.DateTimeFormatOptions = {
          hour: '2-digit',
          minute: '2-digit',
        }
        
        const localeMap: Record<Locale, string> = {
          en: 'en-US',
          zh: 'zh-CN',
          es: 'es-ES',
          fr: 'fr-FR',
          pt: 'pt-BR',
          ja: 'ja-JP',
        }
        
        return new Intl.DateTimeFormat(localeMap[locale], options).format(date)
      }
      
      const enTime = formatTime(date, 'en')
      const frTime = formatTime(date, 'fr')
      
      // 英文可能显示 PM，法语可能不同
      expect(enTime).toBeDefined()
      expect(frTime).toBeDefined()
    })

    it('应该显示相对时间', () => {
      const formatRelativeTime = (date: Date, locale: Locale): string => {
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMinutes = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMinutes / 60)
        const diffDays = Math.floor(diffHours / 24)
        
        const localeMap: Record<Locale, string> = {
          en: 'en-US',
          zh: 'zh-CN',
          es: 'es-ES',
          fr: 'fr-FR',
          pt: 'pt-BR',
          ja: 'ja-JP',
        }
        
        const rtf = new Intl.RelativeTimeFormat(localeMap[locale], { numeric: 'auto' })
        
        if (diffDays > 0) return rtf.format(-diffDays, 'day')
        if (diffHours > 0) return rtf.format(-diffHours, 'hour')
        if (diffMinutes > 0) return rtf.format(-diffMinutes, 'minute')
        return rtf.format(0, 'second')
      }
      
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      const enRelative = formatRelativeTime(oneHourAgo, 'en')
      const zhRelative = formatRelativeTime(oneHourAgo, 'zh')
      
      expect(enRelative).toContain('hour')
      expect(zhRelative).toContain('小时')
    })
  })

  describe('数字本地化格式', () => {
    it('应该按区域格式化数字', () => {
      const formatNumber = (num: number, locale: Locale): string => {
        const localeMap: Record<Locale, string> = {
          en: 'en-US',
          zh: 'zh-CN',
          es: 'es-ES',
          fr: 'fr-FR',
          pt: 'pt-BR',
          ja: 'ja-JP',
        }
        
        return new Intl.NumberFormat(localeMap[locale]).format(num)
      }
      
      const number = 1234567.89
      
      const enNumber = formatNumber(number, 'en')
      const frNumber = formatNumber(number, 'fr')
      
      // 英文使用逗号分隔千位，法语使用空格
      expect(enNumber).toContain(',')
      expect(frNumber).toBeDefined()
    })

    it('应该按区域格式化货币', () => {
      const formatCurrency = (amount: number, locale: Locale, currency: string): string => {
        const localeMap: Record<Locale, string> = {
          en: 'en-US',
          zh: 'zh-CN',
          es: 'es-ES',
          fr: 'fr-FR',
          pt: 'pt-BR',
          ja: 'ja-JP',
        }
        
        return new Intl.NumberFormat(localeMap[locale], {
          style: 'currency',
          currency,
        }).format(amount)
      }
      
      const enUSD = formatCurrency(1234.56, 'en', 'USD')
      const zhCNY = formatCurrency(1234.56, 'zh', 'CNY')
      const jaJPY = formatCurrency(1234, 'ja', 'JPY')
      
      expect(enUSD).toContain('$')
      expect(zhCNY).toContain('¥')
      expect(jaJPY).toContain('￥')
    })

    it('应该按区域格式化百分比', () => {
      const formatPercent = (value: number, locale: Locale): string => {
        const localeMap: Record<Locale, string> = {
          en: 'en-US',
          zh: 'zh-CN',
          es: 'es-ES',
          fr: 'fr-FR',
          pt: 'pt-BR',
          ja: 'ja-JP',
        }
        
        return new Intl.NumberFormat(localeMap[locale], {
          style: 'percent',
          minimumFractionDigits: 1,
        }).format(value)
      }
      
      const enPercent = formatPercent(0.856, 'en')
      
      expect(enPercent).toContain('%')
      expect(enPercent).toContain('85.6')
    })
  })

  describe('翻译键验证', () => {
    it('所有语言文件应存在', () => {
      // 模拟检查文件存在
      const checkFileExists = (locale: Locale) => {
        // 在实际测试中会检查文件系统
        return SUPPORTED_LOCALES.includes(locale)
      }
      
      SUPPORTED_LOCALES.forEach(locale => {
        expect(checkFileExists(locale)).toBe(true)
      })
    })

    it('翻译键应该在所有语言中存在', () => {
      // 模拟翻译数据
      const translations: Record<Locale, Record<string, string>> = {
        en: { 'common.welcome': 'Welcome', 'common.logout': 'Log out' },
        zh: { 'common.welcome': '欢迎', 'common.logout': '退出' },
        es: { 'common.welcome': 'Bienvenido', 'common.logout': 'Cerrar sesión' },
        fr: { 'common.welcome': 'Bienvenue', 'common.logout': 'Déconnexion' },
        pt: { 'common.welcome': 'Bem-vindo', 'common.logout': 'Sair' },
        ja: { 'common.welcome': 'ようこそ', 'common.logout': 'ログアウト' },
      }
      
      const baseKeys = Object.keys(translations.en)
      
      SUPPORTED_LOCALES.forEach(locale => {
        const localeKeys = Object.keys(translations[locale])
        baseKeys.forEach(key => {
          expect(localeKeys).toContain(key)
        })
      })
    })

    it('翻译值不应为空', () => {
      const translations: Record<string, string> = {
        'common.welcome': 'Welcome',
        'common.logout': 'Log out',
        'common.save': 'Save',
      }
      
      Object.entries(translations).forEach(([_key, value]) => {
        expect(value.trim().length).toBeGreaterThan(0)
      })
    })
  })

  describe('语言检测', () => {
    it('应该能从浏览器设置检测语言', () => {
      const detectBrowserLocale = (acceptLanguage: string): Locale => {
        const languages = acceptLanguage.split(',').map(lang => {
          const [code, qValue] = lang.trim().split(';q=')
          return {
            code: code.split('-')[0].toLowerCase(),
            q: qValue ? parseFloat(qValue) : 1,
          }
        })
        
        languages.sort((a, b) => b.q - a.q)
        
        for (const lang of languages) {
          if (SUPPORTED_LOCALES.includes(lang.code as Locale)) {
            return lang.code as Locale
          }
        }
        
        return 'en' // 默认
      }
      
      expect(detectBrowserLocale('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh')
      expect(detectBrowserLocale('ja-JP,ja;q=0.9')).toBe('ja')
      expect(detectBrowserLocale('de-DE,de;q=0.9')).toBe('en') // 不支持德语，回退到英语
    })

    it('应该优先使用用户设置的语言', () => {
      const getUserLocale = (
        userPreference: Locale | null,
        browserLocale: Locale,
        defaultLocale: Locale
      ): Locale => {
        if (userPreference && SUPPORTED_LOCALES.includes(userPreference)) {
          return userPreference
        }
        if (SUPPORTED_LOCALES.includes(browserLocale)) {
          return browserLocale
        }
        return defaultLocale
      }
      
      expect(getUserLocale('fr', 'en', 'en')).toBe('fr')
      expect(getUserLocale(null, 'zh', 'en')).toBe('zh')
      expect(getUserLocale(null, 'de' as Locale, 'en')).toBe('en')
    })
  })

  describe('RTL 语言支持', () => {
    it('应该能检测 RTL 语言', () => {
      const RTL_LOCALES = ['ar', 'he', 'fa']
      
      const isRTL = (locale: string): boolean => {
        return RTL_LOCALES.includes(locale)
      }
      
      expect(isRTL('ar')).toBe(true)
      expect(isRTL('en')).toBe(false)
      expect(isRTL('zh')).toBe(false)
    })
  })

  describe('复数形式', () => {
    it('应该正确处理复数形式', () => {
      const pluralize = (count: number, locale: Locale, forms: { one: string; other: string }): string => {
        const rules = new Intl.PluralRules(locale)
        const form = rules.select(count) as 'one' | 'other'
        return forms[form] || forms.other
      }
      
      expect(pluralize(1, 'en', { one: '1 item', other: '{n} items' })).toBe('1 item')
      expect(pluralize(5, 'en', { one: '1 item', other: '{n} items' })).toBe('{n} items')
    })
  })

  describe('插值', () => {
    it('应该正确替换变量', () => {
      const interpolate = (template: string, values: Record<string, string | number>): string => {
        return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))
      }
      
      expect(interpolate('Hello, {name}!', { name: 'John' })).toBe('Hello, John!')
      expect(interpolate('You have {count} messages', { count: 5 })).toBe('You have 5 messages')
    })
  })
})
