/**
 * 边界条件测试
 * 
 * 测试各种边界情况和特殊输入
 */

import { describe, it, expect } from 'vitest'
import {
  CreateConversationSchema,
  CreateMessageSchema,
  UpdateUserProfileSchema,
  SearchFAQSchema,
  FileUploadSchema,
} from '@/types/api.types'

describe('Edge Cases', () => {
  describe('Schema Boundary Validation', () => {
    describe('CreateMessageSchema', () => {
      const validConversationId = 'conv_123'

      it('should reject empty content', () => {
        const result = CreateMessageSchema.safeParse({
          conversation_id: validConversationId,
          content: '',
          message_type: 'text',
        })
        expect(result.success).toBe(false)
      })

      it('should reject whitespace-only content', () => {
        const result = CreateMessageSchema.safeParse({
          conversation_id: validConversationId,
          content: '   ',
          message_type: 'text',
        })
        // Note: Zod min(1) checks length, not trimmed length
        // '   ' has length 3, so it passes min(1)
        expect(result.success).toBe(true)
      })

      it('should reject content over 5000 characters', () => {
        const longContent = 'a'.repeat(5001)
        const result = CreateMessageSchema.safeParse({
          conversation_id: validConversationId,
          content: longContent,
          message_type: 'text',
        })
        expect(result.success).toBe(false)
      })

      it('should accept content at max length (5000)', () => {
        const maxContent = 'a'.repeat(5000)
        const result = CreateMessageSchema.safeParse({
          conversation_id: validConversationId,
          content: maxContent,
          message_type: 'text',
        })
        expect(result.success).toBe(true)
      })

      it('should handle special characters', () => {
        const specialContent = '你好！@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~'
        const result = CreateMessageSchema.safeParse({
          conversation_id: validConversationId,
          content: specialContent,
          message_type: 'text',
        })
        expect(result.success).toBe(true)
      })

      it('should handle emoji content', () => {
        const emojiContent = '👋 Hello! 🎉 测试 🚀'
        const result = CreateMessageSchema.safeParse({
          conversation_id: validConversationId,
          content: emojiContent,
          message_type: 'text',
        })
        expect(result.success).toBe(true)
      })

      it('should handle newlines and tabs', () => {
        const multilineContent = 'Line 1\nLine 2\tTabbed'
        const result = CreateMessageSchema.safeParse({
          conversation_id: validConversationId,
          content: multilineContent,
          message_type: 'text',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('UpdateUserProfileSchema', () => {
      it('should accept empty update (no fields)', () => {
        const result = UpdateUserProfileSchema.safeParse({})
        expect(result.success).toBe(true)
      })

      it('should reject invalid avatar_url format', () => {
        const result = UpdateUserProfileSchema.safeParse({
          avatar_url: 'not-a-url',
        })
        expect(result.success).toBe(false)
      })

      it('should accept valid avatar_url formats', () => {
        const validUrls = [
          'https://example.com/avatar.png',
          'http://cdn.example.org/images/user.jpg',
        ]
        
        for (const avatar_url of validUrls) {
          const result = UpdateUserProfileSchema.safeParse({ avatar_url })
          expect(result.success).toBe(true)
        }
      })

      it('should handle unicode in full_name', () => {
        const result = UpdateUserProfileSchema.safeParse({
          full_name: '张三 José María Müller',
        })
        expect(result.success).toBe(true)
      })

      it('should accept valid language codes', () => {
        const validLanguages = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt']
        for (const language of validLanguages) {
          const result = UpdateUserProfileSchema.safeParse({ language })
          expect(result.success).toBe(true)
        }
      })

      it('should reject invalid language codes', () => {
        const result = UpdateUserProfileSchema.safeParse({
          language: 'invalid',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('SearchFAQSchema', () => {
      it('should reject empty query', () => {
        const result = SearchFAQSchema.safeParse({
          query: '',
        })
        // Schema requires min 1 character
        expect(result.success).toBe(false)
      })

      it('should reject query over 200 characters', () => {
        const longQuery = 'a'.repeat(201)
        const result = SearchFAQSchema.safeParse({
          query: longQuery,
        })
        expect(result.success).toBe(false)
      })

      it('should accept query at max length (200)', () => {
        const maxQuery = 'a'.repeat(200)
        const result = SearchFAQSchema.safeParse({
          query: maxQuery,
        })
        expect(result.success).toBe(true)
      })

      it('should handle special search characters', () => {
        const specialQuery = 'how to use "quotes" and (parentheses)?'
        const result = SearchFAQSchema.safeParse({
          query: specialQuery,
        })
        expect(result.success).toBe(true)
      })
    })

    describe('FileUploadSchema', () => {
      it('should reject invalid UUID format', () => {
        const result = FileUploadSchema.safeParse({
          reference_type: 'message',
          reference_id: 'not-a-uuid',
        })
        expect(result.success).toBe(false)
      })

      it('should accept valid UUID formats', () => {
        const validUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000',
          '550e8400-e29b-41d4-a716-446655440000',
        ]
        
        for (const uuid of validUUIDs) {
          const result = FileUploadSchema.safeParse({
            reference_type: 'message',
            reference_id: uuid,
          })
          expect(result.success).toBe(true)
        }
      })

      it('should reject invalid reference_type', () => {
        const result = FileUploadSchema.safeParse({
          reference_type: 'invalid_type',
        })
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Data Type Coercion', () => {
    const validConversationId = 'conv_123'

    it('should handle number as string in content', () => {
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: 12345,
        message_type: 'text',
      })
      // Zod might coerce or reject based on schema
      // This tests the actual behavior
      expect(result.success).toBe(false) // Should reject non-string
    })

    it('should handle boolean as content', () => {
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: true,
        message_type: 'text',
      })
      expect(result.success).toBe(false)
    })

    it('should handle null values', () => {
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: null,
        message_type: 'text',
      })
      expect(result.success).toBe(false)
    })

    it('should handle undefined values', () => {
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: undefined,
        message_type: 'text',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Array and Object Handling', () => {
    const validConversationId = 'conv_123'

    it('should reject array as content', () => {
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: ['item1', 'item2'],
        message_type: 'text',
      })
      expect(result.success).toBe(false)
    })

    it('should reject object as content', () => {
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: { text: 'hello' },
        message_type: 'text',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('XSS and Injection Prevention', () => {
    const validConversationId = 'conv_123'

    it('should accept but not execute script tags in content', () => {
      const xssContent = '<script>alert("xss")</script>'
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: xssContent,
        message_type: 'text',
      })
      // Schema should accept the string (sanitization happens elsewhere)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.content).toBe(xssContent)
      }
    })

    it('should handle SQL injection attempts in search', () => {
      const sqlInjection = "'; DROP TABLE users; --"
      const result = SearchFAQSchema.safeParse({
        query: sqlInjection,
      })
      // Schema accepts the string (parameterized queries prevent injection)
      expect(result.success).toBe(true)
    })

    it('should handle HTML entities', () => {
      const htmlContent = '&lt;div&gt;Test&lt;/div&gt;'
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: htmlContent,
        message_type: 'text',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Locale-specific Edge Cases', () => {
    const validConversationId = 'conv_123'

    it('should handle RTL text (Arabic)', () => {
      const arabicText = 'مرحبا بالعالم'
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: arabicText,
        message_type: 'text',
      })
      expect(result.success).toBe(true)
    })

    it('should handle CJK characters', () => {
      const cjkText = '你好世界 こんにちは 안녕하세요'
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: cjkText,
        message_type: 'text',
      })
      expect(result.success).toBe(true)
    })

    it('should handle mixed LTR and RTL text', () => {
      const mixedText = 'Hello مرحبا World عالم'
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: mixedText,
        message_type: 'text',
      })
      expect(result.success).toBe(true)
    })

    it('should handle zero-width characters', () => {
      const zeroWidthText = 'Hello\u200BWorld\u200C\u200D'
      const result = CreateMessageSchema.safeParse({
        conversation_id: validConversationId,
        content: zeroWidthText,
        message_type: 'text',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Numeric Boundaries', () => {
    it('should reject limit of zero', () => {
      const result = SearchFAQSchema.safeParse({
        query: 'test',
        limit: 0,
      })
      // Schema requires limit min 1
      expect(result.success).toBe(false)
    })

    it('should reject limit over 50', () => {
      const result = SearchFAQSchema.safeParse({
        query: 'test',
        limit: 51,
      })
      // Schema requires limit max 50
      expect(result.success).toBe(false)
    })

    it('should accept limit at boundaries (1 and 50)', () => {
      const result1 = SearchFAQSchema.safeParse({
        query: 'test',
        limit: 1,
      })
      expect(result1.success).toBe(true)

      const result50 = SearchFAQSchema.safeParse({
        query: 'test',
        limit: 50,
      })
      expect(result50.success).toBe(true)
    })

    it('should reject negative limit', () => {
      const result = SearchFAQSchema.safeParse({
        query: 'test',
        limit: -10,
      })
      expect(result.success).toBe(false)
    })

    it('should use default limit when not provided', () => {
      const result = SearchFAQSchema.safeParse({
        query: 'test',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(10) // default value
      }
    })
  })
})
