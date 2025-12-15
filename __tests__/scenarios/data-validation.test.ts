/**
 * 数据验证场景测试
 * 
 * 测试各种业务数据的验证逻辑
 */

import { describe, it, expect } from 'vitest'
import {
  CreateConversationSchema,
  CreateMessageSchema,
  UpdateUserProfileSchema,
  SearchFAQSchema,
  FileUploadSchema,
} from '@/types/api.types'

describe('Data Validation: 对话数据', () => {
  describe('创建对话', () => {
    it('应该接受空对象（所有字段可选）', () => {
      const result = CreateConversationSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('应该接受有效的 business_type_id', () => {
      const validData = {
        business_type_id: '550e8400-e29b-41d4-a716-446655440000',
      }

      const result = CreateConversationSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('应该拒绝无效的 business_type_id', () => {
      const invalidData = {
        business_type_id: 'not-a-uuid',
      }

      const result = CreateConversationSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('应该接受有效的 initial_message', () => {
      const validData = {
        initial_message: 'Hello, I need help with my order',
      }

      const result = CreateConversationSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('应该拒绝空的 initial_message', () => {
      const invalidData = {
        initial_message: '',
      }

      const result = CreateConversationSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('应该拒绝过长的 initial_message', () => {
      const invalidData = {
        initial_message: 'a'.repeat(5001),
      }

      const result = CreateConversationSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('创建消息', () => {
    it('应该接受有效的消息数据', () => {
      const validData = {
        conversation_id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Hello, I need help',
      }

      const result = CreateMessageSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('应该拒绝空内容', () => {
      const invalidData = {
        conversation_id: '550e8400-e29b-41d4-a716-446655440000',
        content: '',
      }

      const result = CreateMessageSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('conversation_id 可以是任意字符串（支持 UUID 或工单 ID）', () => {
      // UUID 格式
      const uuidData = {
        conversation_id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Hello',
      }
      expect(CreateMessageSchema.safeParse(uuidData).success).toBe(true)

      // 数字工单 ID
      const ticketIdData = {
        conversation_id: '12345',
        content: 'Hello',
      }
      expect(CreateMessageSchema.safeParse(ticketIdData).success).toBe(true)
    })

    it('应该接受所有有效的 message_type', () => {
      const types = ['text', 'image', 'file', 'system']

      types.forEach(message_type => {
        const result = CreateMessageSchema.safeParse({
          conversation_id: '550e8400-e29b-41d4-a716-446655440000',
          content: 'Test message',
          message_type,
        })
        expect(result.success).toBe(true)
      })
    })

    it('message_type 默认为 text', () => {
      const data = {
        conversation_id: '123',
        content: 'Hello',
      }

      const result = CreateMessageSchema.safeParse(data)
      if (result.success) {
        expect(result.data.message_type).toBe('text')
      }
    })

    it('应该拒绝过长的内容', () => {
      const invalidData = {
        conversation_id: '123',
        content: 'a'.repeat(5001),
      }

      const result = CreateMessageSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })
})

describe('Data Validation: 用户数据', () => {
  describe('更新用户资料', () => {
    it('应该接受有效的更新数据', () => {
      const validData = {
        name: 'John Doe',
        language: 'zh-CN',
      }

      const result = UpdateUserProfileSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('应该接受空对象（部分更新）', () => {
      const result = UpdateUserProfileSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('应该接受有效的头像 URL', () => {
      const validData = {
        avatar_url: 'https://example.com/avatar.jpg',
      }

      const result = UpdateUserProfileSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('应该拒绝无效的头像 URL', () => {
      const invalidData = {
        avatar_url: 'not-a-url',
      }

      const result = UpdateUserProfileSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('应该接受有效的语言代码', () => {
      const languages = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt']

      languages.forEach(language => {
        const result = UpdateUserProfileSchema.safeParse({ language })
        expect(result.success).toBe(true)
      })
    })
  })
})

describe('Data Validation: FAQ 搜索', () => {
  describe('搜索参数', () => {
    it('应该接受有效的搜索参数', () => {
      const validData = {
        query: '退款',
        locale: 'zh-CN',
      }

      const result = SearchFAQSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('应该拒绝空查询', () => {
      const invalidData = {
        query: '',
        locale: 'zh-CN',
      }

      const result = SearchFAQSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('应该拒绝过长的查询', () => {
      const invalidData = {
        query: 'a'.repeat(201), // 超过 200 字符
        locale: 'zh-CN',
      }

      const result = SearchFAQSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('应该使用默认的 limit', () => {
      const validData = {
        query: 'test',
        locale: 'en',
      }

      const result = SearchFAQSchema.safeParse(validData)
      if (result.success) {
        expect(result.data.limit).toBe(10)
      }
    })

    it('应该接受自定义 limit', () => {
      const validData = {
        query: 'test',
        locale: 'en',
        limit: 20,
      }

      const result = SearchFAQSchema.safeParse(validData)
      if (result.success) {
        expect(result.data.limit).toBe(20)
      }
    })

    it('应该拒绝超出范围的 limit', () => {
      const tooSmall = SearchFAQSchema.safeParse({
        query: 'test',
        locale: 'en',
        limit: 0,
      })
      expect(tooSmall.success).toBe(false)

      const tooLarge = SearchFAQSchema.safeParse({
        query: 'test',
        locale: 'en',
        limit: 100,
      })
      expect(tooLarge.success).toBe(false)
    })
  })
})

describe('Data Validation: 文件上传', () => {
  describe('上传参数', () => {
    it('应该接受有效的上传参数', () => {
      const validData = {
        reference_type: 'message',
        reference_id: '550e8400-e29b-41d4-a716-446655440000',
      }

      const result = FileUploadSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('应该接受所有有效的 reference_type', () => {
      const types = ['message', 'user_profile', 'ticket']

      types.forEach(reference_type => {
        const result = FileUploadSchema.safeParse({
          reference_type,
          reference_id: '550e8400-e29b-41d4-a716-446655440000',
        })
        expect(result.success).toBe(true)
      })
    })

    it('应该拒绝无效的 reference_id', () => {
      const invalidData = {
        reference_type: 'message',
        reference_id: 'not-a-uuid',
      }

      const result = FileUploadSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('reference_id 应该是可选的', () => {
      const validData = {
        reference_type: 'message',
      }

      const result = FileUploadSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })
})

describe('Data Validation: 边界情况', () => {
  describe('特殊字符处理', () => {
    it('消息内容应该接受特殊字符', () => {
      const specialChars = [
        '你好！',
        'Hello <script>alert(1)</script>',
        "O'Brien",
        'Line1\nLine2',
        '🎉 Emoji test',
      ]

      specialChars.forEach(content => {
        const result = CreateMessageSchema.safeParse({
          conversation_id: '550e8400-e29b-41d4-a716-446655440000',
          content,
        })
        expect(result.success).toBe(true)
      })
    })

    it('搜索查询应该接受中文', () => {
      const result = SearchFAQSchema.safeParse({
        query: '如何退款',
        locale: 'zh-CN',
      })
      expect(result.success).toBe(true)
    })

    it('用户名应该接受各种字符', () => {
      const names = [
        'John Doe',
        '张三',
        'José García',
        "O'Connor",
      ]

      names.forEach(name => {
        const result = UpdateUserProfileSchema.safeParse({ name })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('空白处理', () => {
    it('应该处理前后空白', () => {
      const result = CreateMessageSchema.safeParse({
        conversation_id: '550e8400-e29b-41d4-a716-446655440000',
        content: '  Hello  ',
      })
      expect(result.success).toBe(true)
    })

    it('只有空白的内容仍然有效（schema 不自动 trim）', () => {
      const result = CreateMessageSchema.safeParse({
        conversation_id: '550e8400-e29b-41d4-a716-446655440000',
        content: '   ',
      })
      // schema 不自动 trim，所以空白字符串是有效的
      expect(result.success).toBe(true)
    })
  })

  describe('类型强制转换', () => {
    it('应该拒绝数字作为字符串字段', () => {
      const result = CreateMessageSchema.safeParse({
        conversation_id: '550e8400-e29b-41d4-a716-446655440000',
        content: 12345, // 应该是字符串
      })
      expect(result.success).toBe(false)
    })

    it('应该拒绝字符串作为数字字段', () => {
      const result = SearchFAQSchema.safeParse({
        query: 'test',
        locale: 'en',
        limit: 'ten', // 应该是数字
      })
      expect(result.success).toBe(false)
    })
  })
})
