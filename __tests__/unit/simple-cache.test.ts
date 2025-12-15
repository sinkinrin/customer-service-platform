/**
 * SimpleCache 单元测试
 * 
 * 测试 LRU 缓存的核心功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SimpleCache } from '@/lib/cache/simple-cache'

describe('SimpleCache', () => {
  let cache: SimpleCache<string>

  beforeEach(() => {
    cache = new SimpleCache<string>(5, 60) // maxSize=5, ttl=60秒
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('基本操作', () => {
    it('应该能设置和获取值', () => {
      cache.set('key1', 'value1')
      
      expect(cache.get('key1')).toBe('value1')
    })

    it('获取不存在的键应该返回 null', () => {
      expect(cache.get('nonexistent')).toBeNull()
    })

    it('应该能检查键是否存在', () => {
      cache.set('key1', 'value1')
      
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('nonexistent')).toBe(false)
    })

    it('应该能删除键', () => {
      cache.set('key1', 'value1')
      
      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeNull()
    })

    it('删除不存在的键应该返回 false', () => {
      expect(cache.delete('nonexistent')).toBe(false)
    })

    it('应该能清空缓存', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      
      cache.clear()
      
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
    })
  })

  describe('TTL 过期', () => {
    it('未过期的值应该能获取', () => {
      cache.set('key1', 'value1', 10) // 10秒 TTL
      
      vi.advanceTimersByTime(5000) // 5秒后
      
      expect(cache.get('key1')).toBe('value1')
    })

    it('过期的值应该返回 null', () => {
      cache.set('key1', 'value1', 10) // 10秒 TTL
      
      vi.advanceTimersByTime(11000) // 11秒后
      
      expect(cache.get('key1')).toBeNull()
    })

    it('过期的值应该从缓存中删除', () => {
      cache.set('key1', 'value1', 10)
      
      vi.advanceTimersByTime(11000)
      cache.get('key1') // 触发删除
      
      const stats = cache.getStats()
      expect(stats.keys).not.toContain('key1')
    })

    it('应该使用自定义 TTL', () => {
      cache.set('key1', 'value1', 5) // 5秒
      cache.set('key2', 'value2', 20) // 20秒
      
      vi.advanceTimersByTime(10000) // 10秒后
      
      expect(cache.get('key1')).toBeNull() // 已过期
      expect(cache.get('key2')).toBe('value2') // 未过期
    })
  })

  describe('LRU 驱逐', () => {
    it('缓存满时应该驱逐最旧的条目', () => {
      // 填满缓存 (maxSize=5)
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      cache.set('key4', 'value4')
      cache.set('key5', 'value5')
      
      // 添加第6个，应该驱逐 key1
      cache.set('key6', 'value6')
      
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key6')).toBe('value6')
    })

    it('访问条目应该更新其最后访问时间', () => {
      cache.set('key1', 'value1')
      vi.advanceTimersByTime(1000)
      cache.set('key2', 'value2')
      vi.advanceTimersByTime(1000)
      cache.set('key3', 'value3')
      vi.advanceTimersByTime(1000)
      cache.set('key4', 'value4')
      vi.advanceTimersByTime(1000)
      cache.set('key5', 'value5')
      
      // 访问 key1，更新其最后访问时间
      cache.get('key1')
      vi.advanceTimersByTime(1000)
      
      // 添加新条目，应该驱逐 key2（最旧的未访问条目）
      cache.set('key6', 'value6')
      
      expect(cache.get('key1')).toBe('value1') // 被访问过，不会被驱逐
      expect(cache.get('key2')).toBeNull() // 被驱逐
    })
  })

  describe('cleanup 方法', () => {
    it('应该清理所有过期条目', () => {
      cache.set('key1', 'value1', 5)
      cache.set('key2', 'value2', 10)
      cache.set('key3', 'value3', 15)
      
      vi.advanceTimersByTime(12000) // 12秒后
      
      cache.cleanup()
      
      const stats = cache.getStats()
      expect(stats.size).toBe(1) // 只有 key3 未过期
      expect(stats.keys).toContain('key3')
    })
  })

  describe('getStats 方法', () => {
    it('应该返回正确的统计信息', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      
      const stats = cache.getStats()
      
      expect(stats.size).toBe(2)
      expect(stats.maxSize).toBe(5)
      expect(stats.keys).toContain('key1')
      expect(stats.keys).toContain('key2')
    })
  })

  describe('类型安全', () => {
    it('应该支持不同类型的值', () => {
      const numberCache = new SimpleCache<number>(10, 60)
      numberCache.set('count', 42)
      expect(numberCache.get('count')).toBe(42)

      const objectCache = new SimpleCache<{ name: string }>(10, 60)
      objectCache.set('user', { name: 'Test' })
      expect(objectCache.get('user')?.name).toBe('Test')

      const arrayCache = new SimpleCache<string[]>(10, 60)
      arrayCache.set('items', ['a', 'b', 'c'])
      expect(arrayCache.get('items')).toHaveLength(3)
    })
  })

  describe('边界情况', () => {
    it('maxSize 为 1 时应该正常工作', () => {
      const tinyCache = new SimpleCache<string>(1, 60)
      
      tinyCache.set('key1', 'value1')
      tinyCache.set('key2', 'value2')
      
      expect(tinyCache.get('key1')).toBeNull()
      expect(tinyCache.get('key2')).toBe('value2')
    })

    it('TTL 为 1 秒时应该很快过期', () => {
      cache.set('key1', 'value1', 1)
      
      vi.advanceTimersByTime(1001) // 1秒后
      
      expect(cache.get('key1')).toBeNull()
    })

    it('应该处理空字符串键', () => {
      cache.set('', 'empty key value')
      
      expect(cache.get('')).toBe('empty key value')
    })

    it('应该处理特殊字符键', () => {
      cache.set('key:with:colons', 'value1')
      cache.set('key/with/slashes', 'value2')
      cache.set('key.with.dots', 'value3')
      
      expect(cache.get('key:with:colons')).toBe('value1')
      expect(cache.get('key/with/slashes')).toBe('value2')
      expect(cache.get('key.with.dots')).toBe('value3')
    })

    it('应该能覆盖已存在的键', () => {
      cache.set('key1', 'value1')
      cache.set('key1', 'value2')
      
      expect(cache.get('key1')).toBe('value2')
    })
  })
})

describe('SimpleCache 业务场景', () => {
  describe('FAQ 缓存场景', () => {
    let faqCache: SimpleCache<{ id: string; title: string; content: string }>

    beforeEach(() => {
      faqCache = new SimpleCache(50, 600) // 50条，10分钟
    })

    it('应该缓存 FAQ 文章', () => {
      const article = {
        id: 'faq_1',
        title: 'How to reset password',
        content: 'To reset your password...',
      }

      faqCache.set(`faq:${article.id}`, article)

      const cached = faqCache.get(`faq:${article.id}`)
      expect(cached?.title).toBe('How to reset password')
    })

    it('应该缓存搜索结果', () => {
      const searchResults = [
        { id: 'faq_1', title: 'Password Reset', content: '...' },
        { id: 'faq_2', title: 'Password Policy', content: '...' },
      ]

      const cacheKey = `faq:search:password:en`
      faqCache.set(cacheKey, searchResults as any)

      const cached = faqCache.get(cacheKey)
      expect(cached).toHaveLength(2)
    })
  })

  describe('工单缓存场景', () => {
    let ticketCache: SimpleCache<{ id: number; title: string; state: string }>

    beforeEach(() => {
      ticketCache = new SimpleCache(100, 300) // 100条，5分钟
    })

    it('应该缓存工单详情', () => {
      const ticket = {
        id: 12345,
        title: 'Customer Issue',
        state: 'open',
      }

      ticketCache.set(`ticket:${ticket.id}`, ticket)

      const cached = ticketCache.get(`ticket:${ticket.id}`)
      expect(cached?.id).toBe(12345)
    })

    it('工单更新后应该使缓存失效', () => {
      const ticket = {
        id: 12345,
        title: 'Customer Issue',
        state: 'open',
      }

      ticketCache.set(`ticket:${ticket.id}`, ticket)
      
      // 模拟工单更新
      ticketCache.delete(`ticket:${ticket.id}`)

      expect(ticketCache.get(`ticket:${ticket.id}`)).toBeNull()
    })
  })

  describe('用户缓存场景', () => {
    let userCache: SimpleCache<{ id: number; email: string }>

    beforeEach(() => {
      userCache = new SimpleCache(200, 1800) // 200用户，30分钟
    })

    it('应该缓存 Zammad 用户映射', () => {
      const user = { id: 1, email: 'customer@test.com' }

      userCache.set(`zammad:user:${user.email}`, user)

      const cached = userCache.get(`zammad:user:${user.email}`)
      expect(cached?.id).toBe(1)
    })
  })
})
