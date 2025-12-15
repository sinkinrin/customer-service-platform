/**
 * Local Conversation Storage 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}))

// 测试数据
const mockConversations = [
  {
    id: 'conv_test_1',
    customer_id: 'user_1',
    customer_email: 'customer@test.com',
    region: 'asia-pacific',
    mode: 'ai',
    status: 'active',
    customer_unread_count: 2,
    staff_unread_count: 0,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    last_message_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'conv_test_2',
    customer_id: 'user_1',
    customer_email: 'customer@test.com',
    region: 'europe',
    mode: 'human',
    status: 'active',
    staff_id: 'staff_1',
    customer_unread_count: 0,
    staff_unread_count: 3,
    created_at: '2024-01-02T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
    last_message_at: '2024-01-02T00:00:00.000Z',
  },
]

const mockMessages = [
  {
    id: 'msg_1',
    conversation_id: 'conv_test_1',
    sender_role: 'customer',
    sender_id: 'user_1',
    content: 'Hello',
    message_type: 'text',
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'msg_2',
    conversation_id: 'conv_test_1',
    sender_role: 'ai',
    sender_id: 'ai',
    content: 'Hi, how can I help?',
    message_type: 'text',
    created_at: '2024-01-01T00:01:00.000Z',
  },
]

describe('Local Conversation Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认返回空数组
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([]))
  })

  describe('createAIConversation', () => {
    it('should create a new AI conversation', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([]))
      
      const { createAIConversation } = await import('@/lib/local-conversation-storage')
      const conversation = await createAIConversation('user_1', 'test@test.com', 'asia-pacific')
      
      expect(conversation).toBeDefined()
      expect(conversation.id).toMatch(/^conv_/)
      expect(conversation.customer_id).toBe('user_1')
      expect(conversation.customer_email).toBe('test@test.com')
      expect(conversation.mode).toBe('ai')
      expect(conversation.status).toBe('active')
      expect(conversation.region).toBe('asia-pacific')
    })

    it('should use default region if not provided', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([]))
      
      const { createAIConversation } = await import('@/lib/local-conversation-storage')
      const conversation = await createAIConversation('user_1', 'test@test.com')
      
      expect(conversation.region).toBe('asia-pacific')
    })

    it('should write conversation to file', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([]))
      
      const { createAIConversation } = await import('@/lib/local-conversation-storage')
      await createAIConversation('user_1', 'test@test.com')
      
      expect(fs.writeFile).toHaveBeenCalled()
    })
  })

  describe('getConversation', () => {
    it('should return conversation by ID', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
      
      const { getConversation } = await import('@/lib/local-conversation-storage')
      const conversation = await getConversation('conv_test_1')
      
      expect(conversation).toBeDefined()
      expect(conversation?.id).toBe('conv_test_1')
    })

    it('should return null for non-existent conversation', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
      
      const { getConversation } = await import('@/lib/local-conversation-storage')
      const conversation = await getConversation('non_existent')
      
      expect(conversation).toBeNull()
    })
  })

  describe('getCustomerConversations', () => {
    it('should return all conversations for a customer', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
      
      const { getCustomerConversations } = await import('@/lib/local-conversation-storage')
      const conversations = await getCustomerConversations('customer@test.com')
      
      expect(conversations).toHaveLength(2)
      expect(conversations.every(c => c.customer_email === 'customer@test.com')).toBe(true)
    })

    it('should return empty array for customer with no conversations', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
      
      const { getCustomerConversations } = await import('@/lib/local-conversation-storage')
      const conversations = await getCustomerConversations('other@test.com')
      
      expect(conversations).toHaveLength(0)
    })
  })

  describe('getAllConversations', () => {
    it('should return all conversations', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
      
      const { getAllConversations } = await import('@/lib/local-conversation-storage')
      const conversations = await getAllConversations()
      
      expect(conversations).toHaveLength(2)
    })
  })

  describe('updateConversation', () => {
    it('should update conversation fields', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
      
      const { updateConversation } = await import('@/lib/local-conversation-storage')
      const updated = await updateConversation('conv_test_1', { status: 'closed' })
      
      expect(updated).toBeDefined()
      expect(updated?.status).toBe('closed')
      expect(fs.writeFile).toHaveBeenCalled()
    })

    it('should return null for non-existent conversation', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
      
      const { updateConversation } = await import('@/lib/local-conversation-storage')
      const updated = await updateConversation('non_existent', { status: 'closed' })
      
      expect(updated).toBeNull()
    })

    it('should update updated_at timestamp', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
      
      const { updateConversation } = await import('@/lib/local-conversation-storage')
      const updated = await updateConversation('conv_test_1', { status: 'closed' })
      
      expect(updated?.updated_at).not.toBe(mockConversations[0].updated_at)
    })
  })

  describe('addMessage', () => {
    it('should add message to conversation', async () => {
      // 第一次读取返回 conversations，第二次返回 messages
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockMessages))
        .mockResolvedValueOnce(JSON.stringify(mockConversations))
      
      const { addMessage } = await import('@/lib/local-conversation-storage')
      const message = await addMessage('conv_test_1', 'customer', 'user_1', 'New message')
      
      expect(message).toBeDefined()
      expect(message.id).toMatch(/^msg_/)
      expect(message.content).toBe('New message')
      expect(message.sender_role).toBe('customer')
    })

    it('should support message_type parameter', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockMessages))
        .mockResolvedValueOnce(JSON.stringify(mockConversations))
      
      const { addMessage } = await import('@/lib/local-conversation-storage')
      const message = await addMessage('conv_test_1', 'customer', 'user_1', 'Image', undefined, 'image')
      
      expect(message.message_type).toBe('image')
    })

    it('should default message_type to text', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockMessages))
        .mockResolvedValueOnce(JSON.stringify(mockConversations))
      
      const { addMessage } = await import('@/lib/local-conversation-storage')
      const message = await addMessage('conv_test_1', 'customer', 'user_1', 'Hello')
      
      expect(message.message_type).toBe('text')
    })
  })

  describe('getConversationMessages', () => {
    it('should return messages for conversation', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessages))
      
      const { getConversationMessages } = await import('@/lib/local-conversation-storage')
      const messages = await getConversationMessages('conv_test_1')
      
      expect(messages).toHaveLength(2)
      expect(messages.every(m => m.conversation_id === 'conv_test_1')).toBe(true)
    })

    it('should return empty array for conversation with no messages', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessages))
      
      const { getConversationMessages } = await import('@/lib/local-conversation-storage')
      const messages = await getConversationMessages('conv_test_2')
      
      expect(messages).toHaveLength(0)
    })
  })

  describe('deleteConversation', () => {
    it('should delete conversation and its messages', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockConversations))
        .mockResolvedValueOnce(JSON.stringify(mockMessages))
      
      const { deleteConversation } = await import('@/lib/local-conversation-storage')
      const result = await deleteConversation('conv_test_1')
      
      expect(result).toBe(true)
      expect(fs.writeFile).toHaveBeenCalledTimes(2) // conversations and messages
    })
  })

  describe('getConversationStats', () => {
    it('should return correct statistics', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
      
      const { getConversationStats } = await import('@/lib/local-conversation-storage')
      const stats = await getConversationStats('customer@test.com')
      
      expect(stats.total).toBe(2)
      expect(stats.active).toBe(2)
      expect(stats.closed).toBe(0)
      expect(stats.ai_mode).toBe(1)
      expect(stats.human_mode).toBe(1)
    })
  })

  describe('Unread Count Functions', () => {
    describe('incrementUnreadCount', () => {
      it('should increment customer unread count', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
        
        const { incrementUnreadCount } = await import('@/lib/local-conversation-storage')
        const updated = await incrementUnreadCount('conv_test_1', 'customer')
        
        expect(updated?.customer_unread_count).toBe(3) // was 2, now 3
      })

      it('should increment staff unread count', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
        
        const { incrementUnreadCount } = await import('@/lib/local-conversation-storage')
        const updated = await incrementUnreadCount('conv_test_2', 'staff')
        
        expect(updated?.staff_unread_count).toBe(4) // was 3, now 4
      })

      it('should return null for non-existent conversation', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
        
        const { incrementUnreadCount } = await import('@/lib/local-conversation-storage')
        const updated = await incrementUnreadCount('non_existent', 'customer')
        
        expect(updated).toBeNull()
      })
    })

    describe('markConversationAsRead', () => {
      it('should reset customer unread count to 0', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
        
        const { markConversationAsRead } = await import('@/lib/local-conversation-storage')
        const updated = await markConversationAsRead('conv_test_1', 'customer')
        
        expect(updated?.customer_unread_count).toBe(0)
        expect(updated?.customer_last_read_at).toBeDefined()
      })

      it('should reset staff unread count to 0', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
        
        const { markConversationAsRead } = await import('@/lib/local-conversation-storage')
        const updated = await markConversationAsRead('conv_test_2', 'staff')
        
        expect(updated?.staff_unread_count).toBe(0)
        expect(updated?.staff_last_read_at).toBeDefined()
      })
    })

    describe('getTotalUnreadCount', () => {
      it('should return total unread count for customer', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
        
        const { getTotalUnreadCount } = await import('@/lib/local-conversation-storage')
        const count = await getTotalUnreadCount('customer@test.com')
        
        expect(count).toBe(2) // conv_test_1 has 2 unread
      })
    })

    describe('getStaffUnreadCount', () => {
      it('should return total unread count for all staff', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
        
        const { getStaffUnreadCount } = await import('@/lib/local-conversation-storage')
        const count = await getStaffUnreadCount()
        
        expect(count).toBe(3) // conv_test_2 (human mode) has 3 unread
      })

      it('should filter by staff_id when provided', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
        
        const { getStaffUnreadCount } = await import('@/lib/local-conversation-storage')
        const count = await getStaffUnreadCount('staff_1')
        
        expect(count).toBe(3) // staff_1 is assigned to conv_test_2
      })

      it('should return 0 for staff with no assigned conversations', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConversations))
        
        const { getStaffUnreadCount } = await import('@/lib/local-conversation-storage')
        const count = await getStaffUnreadCount('staff_other')
        
        expect(count).toBe(0)
      })
    })
  })

  describe('createMessage', () => {
    it('should create message with all fields', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockMessages))
        .mockResolvedValueOnce(JSON.stringify(mockConversations))
      
      const { createMessage } = await import('@/lib/local-conversation-storage')
      const message = await createMessage({
        conversation_id: 'conv_test_1',
        sender_role: 'system',
        sender_id: 'system',
        content: 'System message',
        message_type: 'system',
        metadata: { type: 'notification' },
      })
      
      expect(message.sender_role).toBe('system')
      expect(message.message_type).toBe('system')
      expect(message.metadata).toEqual({ type: 'notification' })
    })
  })
})
