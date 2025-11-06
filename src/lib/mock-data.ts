/**
 * Mock Data Storage
 * 
 * TODO: Replace with real database (e.g., PostgreSQL, MongoDB, Prisma)
 * This is a temporary in-memory storage to allow development without Supabase
 */

import { MockUser, defaultMockUser } from './mock-auth'

export interface MockConversation {
  id: string
  customer_id: string
  staff_id: string | null
  business_type_id: string | null
  status: 'waiting' | 'active' | 'closed'
  subject: string | null
  message_count: number
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface MockMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'file'
  metadata?: {
    file_name?: string
    file_size?: number
    file_url?: string
    mime_type?: string
  }
  created_at: string
  sender?: {
    id: string
    full_name: string
    avatar_url?: string
    role: string
  }
}

export interface MockFAQItem {
  id: string
  category_id: string
  title: string
  content: string
  view_count: number
  helpful_count: number
  created_at: string
  updated_at: string
}

export interface MockFAQCategory {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  display_order: number
}

// In-memory storage
export const mockConversations: MockConversation[] = []
export const mockMessages: MockMessage[] = []
export const mockUsers: MockUser[] = [defaultMockUser]
export const mockFAQItems: MockFAQItem[] = []
export const mockFAQCategories: MockFAQCategory[] = []

/**
 * Mock conversation operations
 */
export const conversationOperations = {
  getAll: async (userId: string, status?: string): Promise<MockConversation[]> => {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    let filtered = mockConversations.filter(
      conv => conv.customer_id === userId || conv.staff_id === userId
    )
    
    if (status) {
      filtered = filtered.filter(conv => conv.status === status)
    }
    
    return filtered
  },
  
  getById: async (id: string): Promise<MockConversation | null> => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return mockConversations.find(conv => conv.id === id) || null
  },
  
  create: async (data: Partial<MockConversation>): Promise<MockConversation> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const conversation: MockConversation = {
      id: `conv-${Date.now()}`,
      customer_id: data.customer_id || defaultMockUser.id,
      staff_id: data.staff_id || null,
      business_type_id: data.business_type_id || null,
      status: data.status || 'waiting',
      subject: data.subject || null,
      message_count: 0,
      last_message_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    mockConversations.push(conversation)
    return conversation
  },
  
  update: async (id: string, updates: Partial<MockConversation>): Promise<MockConversation | null> => {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const index = mockConversations.findIndex(conv => conv.id === id)
    if (index === -1) return null
    
    mockConversations[index] = {
      ...mockConversations[index],
      ...updates,
      updated_at: new Date().toISOString(),
    }
    
    return mockConversations[index]
  },
  
  delete: async (id: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const index = mockConversations.findIndex(conv => conv.id === id)
    if (index === -1) return false
    
    mockConversations.splice(index, 1)
    return true
  },
}

/**
 * Mock message operations
 */
export const messageOperations = {
  getByConversation: async (conversationId: string): Promise<MockMessage[]> => {
    await new Promise(resolve => setTimeout(resolve, 200))
    return mockMessages.filter(msg => msg.conversation_id === conversationId)
  },
  
  create: async (data: Partial<MockMessage>): Promise<MockMessage> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const message: MockMessage = {
      id: `msg-${Date.now()}`,
      conversation_id: data.conversation_id!,
      sender_id: data.sender_id || defaultMockUser.id,
      content: data.content || '',
      message_type: data.message_type || 'text',
      metadata: data.metadata,
      created_at: new Date().toISOString(),
      sender: data.sender || {
        id: defaultMockUser.id,
        full_name: defaultMockUser.full_name,
        avatar_url: defaultMockUser.avatar_url,
        role: defaultMockUser.role,
      },
    }
    
    mockMessages.push(message)
    
    // Update conversation message count and last_message_at
    const conversation = mockConversations.find(conv => conv.id === data.conversation_id)
    if (conversation) {
      conversation.message_count++
      conversation.last_message_at = message.created_at
      conversation.updated_at = message.created_at
    }
    
    return message
  },
}

/**
 * Mock FAQ operations
 */
export const faqOperations = {
  search: async (query: string, categoryId?: string): Promise<MockFAQItem[]> => {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    let filtered = mockFAQItems
    
    if (query) {
      const lowerQuery = query.toLowerCase()
      filtered = filtered.filter(
        item => item.title.toLowerCase().includes(lowerQuery) ||
                item.content.toLowerCase().includes(lowerQuery)
      )
    }
    
    if (categoryId) {
      filtered = filtered.filter(item => item.category_id === categoryId)
    }
    
    return filtered
  },
  
  getCategories: async (): Promise<MockFAQCategory[]> => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return mockFAQCategories
  },
  
  getById: async (id: string): Promise<MockFAQItem | null> => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return mockFAQItems.find(item => item.id === id) || null
  },
  
  incrementViewCount: async (id: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const item = mockFAQItems.find(item => item.id === id)
    if (item) {
      item.view_count++
    }
  },
  
  incrementHelpfulCount: async (id: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const item = mockFAQItems.find(item => item.id === id)
    if (item) {
      item.helpful_count++
    }
  },
}

/**
 * Mock user operations
 */
export const userOperations = {
  getAll: async (search?: string, role?: string): Promise<MockUser[]> => {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    let filtered = mockUsers
    
    if (search) {
      const lowerSearch = search.toLowerCase()
      filtered = filtered.filter(
        user => user.full_name.toLowerCase().includes(lowerSearch) ||
                user.email.toLowerCase().includes(lowerSearch)
      )
    }
    
    if (role) {
      filtered = filtered.filter(user => user.role === role)
    }
    
    return filtered
  },
  
  getById: async (id: string): Promise<MockUser | null> => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return mockUsers.find(user => user.id === id) || null
  },
  
  update: async (id: string, updates: Partial<MockUser>): Promise<MockUser | null> => {
    await new Promise(resolve => setTimeout(resolve, 200))

    const index = mockUsers.findIndex(user => user.id === id)
    if (index === -1) return null

    mockUsers[index] = {
      ...mockUsers[index],
      ...updates,
    }

    return mockUsers[index]
  },
}

/**
 * Mock settings
 */
export interface MockSettings {
  ai_auto_reply: {
    enabled: boolean
    model: string
    temperature: number
    system_prompt: string
    fastgpt_url: string
    fastgpt_appid: string
    fastgpt_api_key: string
  }
}

export const mockSettings: MockSettings = {
  ai_auto_reply: {
    enabled: false,
    model: 'GPT-4o-mini',
    temperature: 0.7,
    system_prompt: 'You are a helpful customer service assistant.',
    fastgpt_url: '',
    fastgpt_appid: '',
    fastgpt_api_key: '',
  },
}

