/**
 * FAQ 系统场景测试
 * 
 * 业务场景：
 * 1. 客户搜索和浏览 FAQ
 * 2. 管理员管理 FAQ 分类和文章
 * 3. FAQ 评分和反馈
 * 
 * 代码层面：
 * 1. Schema 验证
 * 2. 搜索参数处理
 * 3. 多语言支持
 */

import { describe, it, expect } from 'vitest'
import { SearchFAQSchema } from '@/types/api.types'

describe('FAQ System: 客户自助服务', () => {
  describe('业务场景: 客户搜索常见问题', () => {
    it('客户搜索"退款"应该能找到相关文章', () => {
      const searchRequest = SearchFAQSchema.safeParse({
        query: '退款',
        locale: 'zh-CN',
        limit: 10,
      })

      expect(searchRequest.success).toBe(true)
      if (searchRequest.success) {
        expect(searchRequest.data.query).toBe('退款')
        expect(searchRequest.data.locale).toBe('zh-CN')
      }
    })

    it('英文用户搜索"refund"应该使用英文语言', () => {
      const searchRequest = SearchFAQSchema.safeParse({
        query: 'refund policy',
        locale: 'en',
        limit: 10,
      })

      expect(searchRequest.success).toBe(true)
      if (searchRequest.success) {
        expect(searchRequest.data.locale).toBe('en')
      }
    })

    it('客户可以按分类筛选 FAQ', () => {
      const searchRequest = SearchFAQSchema.safeParse({
        query: '订单',
        locale: 'zh-CN',
        category_id: '550e8400-e29b-41d4-a716-446655440000',
        limit: 10,
      })

      expect(searchRequest.success).toBe(true)
      if (searchRequest.success) {
        expect(searchRequest.data.category_id).toBeDefined()
      }
    })

    it('搜索词过长应该被拒绝（防止滥用）', () => {
      const longQuery = '这是一个非常长的搜索词'.repeat(20) // 超过200字符

      const searchRequest = SearchFAQSchema.safeParse({
        query: longQuery,
        locale: 'zh-CN',
      })

      expect(searchRequest.success).toBe(false)
    })

    it('空搜索词应该被拒绝', () => {
      const searchRequest = SearchFAQSchema.safeParse({
        query: '',
        locale: 'zh-CN',
      })

      expect(searchRequest.success).toBe(false)
    })
  })

  describe('业务场景: 搜索结果分页', () => {
    it('默认返回10条结果', () => {
      const searchRequest = SearchFAQSchema.safeParse({
        query: '帮助',
        locale: 'zh-CN',
      })

      expect(searchRequest.success).toBe(true)
      if (searchRequest.success) {
        expect(searchRequest.data.limit).toBe(10)
      }
    })

    it('可以自定义返回数量（1-50）', () => {
      const requests = [
        { query: 'test', locale: 'en' as const, limit: 1 },
        { query: 'test', locale: 'en' as const, limit: 25 },
        { query: 'test', locale: 'en' as const, limit: 50 },
      ]

      requests.forEach(req => {
        const result = SearchFAQSchema.safeParse(req)
        expect(result.success).toBe(true)
      })
    })

    it('超过50条应该被拒绝', () => {
      const searchRequest = SearchFAQSchema.safeParse({
        query: 'test',
        locale: 'en',
        limit: 100,
      })

      expect(searchRequest.success).toBe(false)
    })
  })

  describe('业务场景: 多语言 FAQ', () => {
    const supportedLocales = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt'] as const

    it('支持所有6种语言', () => {
      supportedLocales.forEach(locale => {
        const searchRequest = SearchFAQSchema.safeParse({
          query: 'help',
          locale,
        })

        expect(searchRequest.success).toBe(true)
        if (searchRequest.success) {
          expect(searchRequest.data.locale).toBe(locale)
        }
      })
    })

    it('不支持的语言应该被拒绝', () => {
      const searchRequest = SearchFAQSchema.safeParse({
        query: 'help',
        locale: 'ja', // 日语不在支持列表
      })

      expect(searchRequest.success).toBe(false)
    })

    it('默认使用英语', () => {
      const searchRequest = SearchFAQSchema.safeParse({
        query: 'help',
      })

      expect(searchRequest.success).toBe(true)
      if (searchRequest.success) {
        expect(searchRequest.data.locale).toBe('en')
      }
    })
  })

  describe('代码层面: 搜索词处理', () => {
    it('应该保留搜索词中的特殊字符', () => {
      const specialQueries = [
        'C++编程',
        '价格 $100',
        '50% 折扣',
        'Q&A 问答',
      ]

      specialQueries.forEach(query => {
        const result = SearchFAQSchema.safeParse({
          query,
          locale: 'zh-CN',
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.query).toBe(query)
        }
      })
    })

    it('应该保留搜索词中的空格', () => {
      const result = SearchFAQSchema.safeParse({
        query: '如何 退款 申请',
        locale: 'zh-CN',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.query).toBe('如何 退款 申请')
      }
    })

    it('UUID 格式的 category_id 验证', () => {
      // 有效 UUID
      const validResult = SearchFAQSchema.safeParse({
        query: 'test',
        locale: 'en',
        category_id: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(validResult.success).toBe(true)

      // 无效 UUID
      const invalidResult = SearchFAQSchema.safeParse({
        query: 'test',
        locale: 'en',
        category_id: 'not-a-uuid',
      })
      expect(invalidResult.success).toBe(false)
    })
  })
})


