/**
 * 测试对话数据 Fixtures
 */

import { testUsers } from './users'

export const testConversations = {
  aiConversation: {
    id: 'conv_test_1',
    customer_id: testUsers.customer.id,
    customer_email: testUsers.customer.email,
    mode: 'ai' as const,
    status: 'active' as const,
    region: 'asia-pacific' as const,
    created_at: '2025-01-01T10:00:00.000Z',
    updated_at: '2025-01-01T10:30:00.000Z',
    last_message_at: '2025-01-01T10:30:00.000Z',
  },
  
  humanConversation: {
    id: 'conv_test_2',
    customer_id: testUsers.customer.id,
    customer_email: testUsers.customer.email,
    mode: 'human' as const,
    status: 'active' as const,
    region: 'asia-pacific' as const,
    assigned_staff_id: testUsers.staff.id,
    created_at: '2025-01-01T11:00:00.000Z',
    updated_at: '2025-01-01T11:30:00.000Z',
    last_message_at: '2025-01-01T11:30:00.000Z',
  },
  
  closedConversation: {
    id: 'conv_test_3',
    customer_id: testUsers.customer.id,
    customer_email: testUsers.customer.email,
    mode: 'human' as const,
    status: 'closed' as const,
    region: 'asia-pacific' as const,
    assigned_staff_id: testUsers.staff.id,
    created_at: '2025-01-01T09:00:00.000Z',
    updated_at: '2025-01-01T09:45:00.000Z',
    last_message_at: '2025-01-01T09:45:00.000Z',
  },
}

export const testMessages = {
  customerMessage: {
    id: 'msg_test_1',
    conversation_id: testConversations.aiConversation.id,
    sender_role: 'customer' as const,
    sender_id: testUsers.customer.id,
    content: 'Hello, I need help with my account',
    message_type: 'text' as const,
    created_at: '2025-01-01T10:00:00.000Z',
  },
  
  aiMessage: {
    id: 'msg_test_2',
    conversation_id: testConversations.aiConversation.id,
    sender_role: 'ai' as const,
    sender_id: 'ai-assistant',
    content: 'Hello! I\'d be happy to help you with your account. What specific issue are you experiencing?',
    message_type: 'text' as const,
    created_at: '2025-01-01T10:00:05.000Z',
  },
  
  staffMessage: {
    id: 'msg_test_3',
    conversation_id: testConversations.humanConversation.id,
    sender_role: 'staff' as const,
    sender_id: testUsers.staff.id,
    content: 'Hi, I\'m taking over this conversation. How can I assist you?',
    message_type: 'text' as const,
    created_at: '2025-01-01T11:00:00.000Z',
  },
  
  systemMessage: {
    id: 'msg_test_4',
    conversation_id: testConversations.humanConversation.id,
    sender_role: 'ai' as const,
    sender_id: 'system',
    content: 'Conversation transferred to human agent',
    message_type: 'system' as const,
    created_at: '2025-01-01T10:59:00.000Z',
  },
}

export type TestConversation = typeof testConversations.aiConversation
export type TestMessage = typeof testMessages.customerMessage
