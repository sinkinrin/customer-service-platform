/**
 * Zod Schema 单元测试
 */

import { describe, it, expect } from 'vitest'
import {
  CreateConversationSchema,
  CreateMessageSchema,
  UpdateUserProfileSchema,
  SearchFAQSchema,
  FileUploadSchema,
} from '@/types/api.types'

describe('CreateConversationSchema', () => {
  it('should accept valid data with business_type_id', () => {
    const data = {
      business_type_id: '123e4567-e89b-12d3-a456-426614174000',
      initial_message: 'Hello, I need help',
    }
    const result = CreateConversationSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('should accept empty object', () => {
    const result = CreateConversationSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('should reject invalid UUID for business_type_id', () => {
    const data = {
      business_type_id: 'invalid-uuid',
    }
    const result = CreateConversationSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should reject initial_message exceeding max length', () => {
    const data = {
      initial_message: 'a'.repeat(5001),
    }
    const result = CreateConversationSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('CreateMessageSchema', () => {
  it('should accept valid message data', () => {
    const data = {
      conversation_id: 'conv_123',
      content: 'Hello, I need help with my account',
      message_type: 'text',
    }
    const result = CreateMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('should default message_type to text', () => {
    const data = {
      conversation_id: 'conv_123',
      content: 'Hello',
    }
    const result = CreateMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.message_type).toBe('text')
    }
  })

  it('should reject empty content', () => {
    const data = {
      conversation_id: 'conv_123',
      content: '',
    }
    const result = CreateMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should reject content exceeding max length', () => {
    const data = {
      conversation_id: 'conv_123',
      content: 'a'.repeat(5001),
    }
    const result = CreateMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should accept valid message types', () => {
    const types = ['text', 'image', 'file', 'system']
    types.forEach((type) => {
      const data = {
        conversation_id: 'conv_123',
        content: 'Hello',
        message_type: type,
      }
      const result = CreateMessageSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  it('should reject invalid message type', () => {
    const data = {
      conversation_id: 'conv_123',
      content: 'Hello',
      message_type: 'invalid',
    }
    const result = CreateMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('UpdateUserProfileSchema', () => {
  it('should accept valid profile update', () => {
    const data = {
      full_name: 'John Doe',
      language: 'en',
      timezone: 'America/New_York',
    }
    const result = UpdateUserProfileSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('should accept partial update', () => {
    const data = {
      full_name: 'John Doe',
    }
    const result = UpdateUserProfileSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('should accept all supported languages', () => {
    const languages = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt']
    languages.forEach((lang) => {
      const data = { language: lang }
      const result = UpdateUserProfileSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  it('should reject unsupported language', () => {
    const data = {
      language: 'de',
    }
    const result = UpdateUserProfileSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should reject empty full_name', () => {
    const data = {
      full_name: '',
    }
    const result = UpdateUserProfileSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should reject invalid avatar_url', () => {
    const data = {
      avatar_url: 'not-a-url',
    }
    const result = UpdateUserProfileSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should accept valid avatar_url', () => {
    const data = {
      avatar_url: 'https://example.com/avatar.png',
    }
    const result = UpdateUserProfileSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('SearchFAQSchema', () => {
  it('should accept valid search query', () => {
    const data = {
      query: 'how to reset password',
      locale: 'en',
      limit: 10,
    }
    const result = SearchFAQSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('should default locale to en', () => {
    const data = {
      query: 'help',
    }
    const result = SearchFAQSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.locale).toBe('en')
    }
  })

  it('should default limit to 10', () => {
    const data = {
      query: 'help',
    }
    const result = SearchFAQSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(10)
    }
  })

  it('should reject empty query', () => {
    const data = {
      query: '',
    }
    const result = SearchFAQSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should reject query exceeding max length', () => {
    const data = {
      query: 'a'.repeat(201),
    }
    const result = SearchFAQSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should reject limit below 1', () => {
    const data = {
      query: 'help',
      limit: 0,
    }
    const result = SearchFAQSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should reject limit above 50', () => {
    const data = {
      query: 'help',
      limit: 51,
    }
    const result = SearchFAQSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('FileUploadSchema', () => {
  it('should accept valid file upload data', () => {
    const data = {
      reference_type: 'message',
      reference_id: '123e4567-e89b-12d3-a456-426614174000',
    }
    const result = FileUploadSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('should accept data without reference_id', () => {
    const data = {
      reference_type: 'message',
    }
    const result = FileUploadSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('should accept all reference types', () => {
    const types = ['message', 'user_profile', 'ticket']
    types.forEach((type) => {
      const data = {
        reference_type: type,
      }
      const result = FileUploadSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  it('should reject invalid reference type', () => {
    const data = {
      reference_type: 'invalid',
    }
    const result = FileUploadSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
