/**
 * Zustand Store 单元测试
 * 
 * 测试真实的 Zustand store 行为
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useConversationStore } from '@/lib/stores/conversation-store'
import { useTicketStore } from '@/lib/stores/ticket-store'

describe('Auth Store 真实测试', () => {
  beforeEach(() => {
    // 每个测试前重置 store
    useAuthStore.getState().reset()
  })

  it('初始状态应该是未登录', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
    expect(state.userRole).toBeNull()
    expect(state.isLoading).toBe(true)
    expect(state.isInitialized).toBe(false)
  })

  it('setUser 应该正确设置用户', () => {
    const { setUser } = useAuthStore.getState()
    const mockUser = {
      id: 'user_1',
      email: 'test@test.com',
      full_name: 'Test User',
      role: 'customer' as const,
      created_at: new Date().toISOString(),
    }
    
    setUser(mockUser)
    
    expect(useAuthStore.getState().user).toEqual(mockUser)
  })

  it('setSession 应该正确设置会话', () => {
    const { setSession } = useAuthStore.getState()
    const mockSession = {
      user: {
        id: 'user_1',
        email: 'test@test.com',
        full_name: 'Test',
        role: 'customer' as const,
        created_at: new Date().toISOString(),
      },
      expires_at: Date.now() + 24 * 60 * 60 * 1000,
    }
    
    setSession(mockSession)
    
    expect(useAuthStore.getState().session).toEqual(mockSession)
  })

  it('setUserRole 应该正确设置角色', () => {
    const { setUserRole } = useAuthStore.getState()
    
    setUserRole('admin')
    expect(useAuthStore.getState().userRole).toBe('admin')
    
    setUserRole('staff')
    expect(useAuthStore.getState().userRole).toBe('staff')
    
    setUserRole('customer')
    expect(useAuthStore.getState().userRole).toBe('customer')
  })

  it('setLoading 应该正确设置加载状态', () => {
    const { setLoading } = useAuthStore.getState()
    
    setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
    
    setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)
  })

  it('setInitialized 应该正确设置初始化状态', () => {
    const { setInitialized } = useAuthStore.getState()
    
    setInitialized(true)
    expect(useAuthStore.getState().isInitialized).toBe(true)
  })

  it('reset 应该重置为初始状态', () => {
    const { setUser, setUserRole, setInitialized, reset } = useAuthStore.getState()
    
    // 先设置一些值
    setUser({ id: '1', email: 'test@test.com', full_name: 'Test', role: 'admin' as const, created_at: new Date().toISOString() })
    setUserRole('admin')
    setInitialized(true)
    
    // 验证值已设置
    expect(useAuthStore.getState().user).not.toBeNull()
    
    // 重置
    reset()
    
    // 验证已重置
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.userRole).toBeNull()
    expect(state.isInitialized).toBe(false)
  })
})

describe('Conversation Store 真实测试', () => {
  beforeEach(() => {
    useConversationStore.getState().reset()
  })

  it('初始状态应该正确', () => {
    const state = useConversationStore.getState()
    expect(state.conversations).toEqual([])
    expect(state.activeConversation).toBeNull()
    expect(state.messages).toEqual([])
    expect(state.isLoadingConversations).toBe(false)
    expect(state.isLoadingMessages).toBe(false)
    expect(state.isSendingMessage).toBe(false)
  })

  it('setConversations 应该设置对话列表', () => {
    const { setConversations } = useConversationStore.getState()
    const mockConversations = [
      {
        id: 'conv_1',
        customer_id: 'cust_1',
        status: 'active' as const,
        mode: 'ai' as const,
        message_count: 5,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]
    
    setConversations(mockConversations)
    
    expect(useConversationStore.getState().conversations).toHaveLength(1)
    expect(useConversationStore.getState().conversations[0].id).toBe('conv_1')
  })

  it('addConversation 应该添加新对话到列表开头', () => {
    const { setConversations, addConversation } = useConversationStore.getState()
    
    // 先设置一个对话
    setConversations([{
      id: 'conv_old',
      customer_id: 'cust_1',
      status: 'active' as const,
      mode: 'ai' as const,
      message_count: 0,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    
    // 添加新对话
    addConversation({
      id: 'conv_new',
      customer_id: 'cust_2',
      status: 'active' as const,
      mode: 'ai' as const,
      message_count: 0,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    
    const conversations = useConversationStore.getState().conversations
    expect(conversations).toHaveLength(2)
    expect(conversations[0].id).toBe('conv_new') // 新对话在前
    expect(conversations[1].id).toBe('conv_old')
  })

  it('updateConversation 应该更新指定对话', () => {
    const { setConversations, updateConversation } = useConversationStore.getState()
    
    setConversations([{
      id: 'conv_1',
      customer_id: 'cust_1',
      status: 'active' as const,
      mode: 'ai' as const,
      message_count: 0,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    
    updateConversation('conv_1', { status: 'closed', message_count: 10 })
    
    const conv = useConversationStore.getState().conversations[0]
    expect(conv.status).toBe('closed')
    expect(conv.message_count).toBe(10)
  })

  it('setActiveConversation 应该设置当前活跃对话', () => {
    const { setActiveConversation } = useConversationStore.getState()
    const mockConv = {
      id: 'conv_1',
      customer_id: 'cust_1',
      status: 'active' as const,
      mode: 'ai' as const,
      message_count: 0,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    setActiveConversation(mockConv)
    
    expect(useConversationStore.getState().activeConversation).toEqual(mockConv)
  })

  it('addMessage 应该添加消息', () => {
    const { addMessage } = useConversationStore.getState()
    const mockMessage = {
      id: 'msg_1',
      conversation_id: 'conv_1',
      sender_id: 'user_1',
      content: 'Hello, world!',
      message_type: 'text' as const,
      created_at: new Date().toISOString(),
    }
    
    addMessage(mockMessage)
    
    expect(useConversationStore.getState().messages).toHaveLength(1)
    expect(useConversationStore.getState().messages[0].content).toBe('Hello, world!')
  })

  it('addMessage 不应该添加重复消息', () => {
    const { addMessage } = useConversationStore.getState()
    const mockMessage = {
      id: 'msg_1',
      conversation_id: 'conv_1',
      sender_id: 'user_1',
      content: 'Hello',
      message_type: 'text' as const,
      created_at: new Date().toISOString(),
    }
    
    addMessage(mockMessage)
    addMessage(mockMessage) // 重复添加
    
    expect(useConversationStore.getState().messages).toHaveLength(1)
  })

  it('加载状态函数应该正确工作', () => {
    const { setLoadingConversations, setLoadingMessages, setSendingMessage } = 
      useConversationStore.getState()
    
    setLoadingConversations(true)
    expect(useConversationStore.getState().isLoadingConversations).toBe(true)
    
    setLoadingMessages(true)
    expect(useConversationStore.getState().isLoadingMessages).toBe(true)
    
    setSendingMessage(true)
    expect(useConversationStore.getState().isSendingMessage).toBe(true)
  })
})

describe('Ticket Store 真实测试', () => {
  beforeEach(() => {
    // 重置 store
    useTicketStore.setState({
      tickets: [],
      selectedTicket: null,
      filters: {},
    })
  })

  it('初始状态应该正确', () => {
    const state = useTicketStore.getState()
    expect(state.tickets).toEqual([])
    expect(state.selectedTicket).toBeNull()
    expect(state.filters).toEqual({})
  })

  it('setTickets 应该设置工单列表', () => {
    const { setTickets } = useTicketStore.getState()
    const mockTickets = [
      {
        id: 1,
        number: 'TKT-001',
        title: 'Test Issue',
        state_id: 1,
        state: 'new',
        priority_id: 2,
        priority: 'normal',
        group: 'Support',
        customer: 'Customer 1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]
    
    setTickets(mockTickets)
    
    expect(useTicketStore.getState().tickets).toHaveLength(1)
    expect(useTicketStore.getState().tickets[0].number).toBe('TKT-001')
  })

  it('setSelectedTicket 应该设置选中的工单', () => {
    const { setSelectedTicket } = useTicketStore.getState()
    const mockTicket = {
      id: 1,
      number: 'TKT-001',
      title: 'Test Issue',
      state_id: 1,
      state: 'new',
      priority_id: 2,
      priority: 'normal',
      group: 'Support',
      customer: 'Customer 1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    setSelectedTicket(mockTicket)
    
    expect(useTicketStore.getState().selectedTicket).toEqual(mockTicket)
  })

  it('setFilters 应该合并过滤器', () => {
    const { setFilters } = useTicketStore.getState()
    
    setFilters({ status: 'open' })
    expect(useTicketStore.getState().filters.status).toBe('open')
    
    setFilters({ priority: 'high' })
    const filters = useTicketStore.getState().filters
    expect(filters.status).toBe('open') // 保留之前的
    expect(filters.priority).toBe('high') // 新增的
  })

  it('clearFilters 应该清除所有过滤器', () => {
    const { setFilters, clearFilters } = useTicketStore.getState()
    
    setFilters({ status: 'open', priority: 'high' })
    expect(useTicketStore.getState().filters).toHaveProperty('status')
    
    clearFilters()
    
    expect(useTicketStore.getState().filters).toEqual({})
  })
})

describe('Store 状态订阅测试', () => {
  it('Auth Store 订阅应该能接收状态变化', () => {
    useAuthStore.getState().reset()
    
    let callCount = 0
    const unsubscribe = useAuthStore.subscribe(() => {
      callCount++
    })
    
    useAuthStore.getState().setUserRole('admin')
    useAuthStore.getState().setLoading(false)
    
    expect(callCount).toBeGreaterThan(0)
    
    unsubscribe()
  })

  it('Conversation Store 订阅应该能接收状态变化', () => {
    useConversationStore.getState().reset()
    
    let lastState: any = null
    const unsubscribe = useConversationStore.subscribe((state) => {
      lastState = state
    })
    
    useConversationStore.getState().setLoadingConversations(true)
    
    expect(lastState?.isLoadingConversations).toBe(true)
    
    unsubscribe()
  })
})
