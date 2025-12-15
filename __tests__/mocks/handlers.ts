/**
 * MSW API Mock Handlers
 * 定义所有 API 端点的 Mock 响应
 */

import { http, HttpResponse } from 'msw'

// 基础 URL
const API_BASE = 'http://localhost:3010/api'

// ============================================
// Auth Handlers
// ============================================
const authHandlers = [
  // 获取当前会话
  http.get(`${API_BASE}/auth/session`, () => {
    return HttpResponse.json({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'customer',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }),
]

// ============================================
// Conversations Handlers
// ============================================
const conversationHandlers = [
  // 获取对话列表
  http.get(`${API_BASE}/conversations`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 'conv_1',
          customer_id: 'test-user-id',
          customer_email: 'test@example.com',
          mode: 'ai',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        },
      ],
    })
  }),

  // 创建对话
  http.post(`${API_BASE}/conversations`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: {
        id: `conv_${Date.now()}`,
        customer_id: 'test-user-id',
        customer_email: 'test@example.com',
        mode: 'ai',
        status: 'active',
        business_type_id: body.business_type_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      },
    }, { status: 201 })
  }),

  // 获取对话消息
  http.get(`${API_BASE}/conversations/:id/messages`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 'msg_1',
          conversation_id: params.id,
          sender_role: 'customer',
          sender_id: 'test-user-id',
          content: 'Hello, I need help',
          message_type: 'text',
          created_at: new Date().toISOString(),
        },
        {
          id: 'msg_2',
          conversation_id: params.id,
          sender_role: 'ai',
          sender_id: 'ai-assistant',
          content: 'Hello! How can I help you today?',
          message_type: 'text',
          created_at: new Date().toISOString(),
        },
      ],
    })
  }),

  // 发送消息
  http.post(`${API_BASE}/conversations/:id/messages`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: {
        id: `msg_${Date.now()}`,
        conversation_id: params.id,
        sender_role: 'customer',
        sender_id: 'test-user-id',
        content: body.content,
        message_type: body.message_type || 'text',
        created_at: new Date().toISOString(),
      },
    }, { status: 201 })
  }),
]

// ============================================
// Tickets Handlers
// ============================================
const ticketHandlers = [
  // 获取工单列表
  http.get(`${API_BASE}/tickets`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          number: '10001',
          title: 'Test Ticket',
          state: 'open',
          priority: 'normal',
          customer_id: 'test-user-id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    })
  }),

  // 创建工单
  http.post(`${API_BASE}/tickets`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: {
        id: Date.now(),
        number: `1000${Date.now() % 100}`,
        title: body.title,
        state: 'new',
        priority: body.priority || 'normal',
        customer_id: 'test-user-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }, { status: 201 })
  }),

  // 获取单个工单
  http.get(`${API_BASE}/tickets/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        id: Number(params.id),
        number: '10001',
        title: 'Test Ticket',
        state: 'open',
        priority: 'normal',
        customer_id: 'test-user-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })
  }),
]

// ============================================
// FAQ Handlers
// ============================================
const faqHandlers = [
  // 获取 FAQ 列表
  http.get(`${API_BASE}/faq`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          title: 'How to contact support?',
          content: 'You can contact us via live chat or submit a ticket.',
          category: 'General',
          state: 'published',
          views: 100,
          likes: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    })
  }),

  // 搜索 FAQ
  http.get(`${API_BASE}/faq/search`, ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('query') || ''
    
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          title: `Search result for: ${query}`,
          content: 'This is a search result.',
          category: 'General',
          state: 'published',
        },
      ],
    })
  }),
]

// ============================================
// AI Chat Handlers
// ============================================
const aiChatHandlers = [
  // AI 聊天
  http.post(`${API_BASE}/ai/chat`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: {
        message: `AI response to: ${body.message}`,
        conversation_id: body.conversation_id,
      },
    })
  }),
]

// ============================================
// Admin Handlers
// ============================================
const adminHandlers = [
  // 获取用户列表
  http.get(`${API_BASE}/admin/users`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 'user-1',
          email: 'customer@test.com',
          name: 'Test Customer',
          role: 'customer',
          created_at: new Date().toISOString(),
        },
        {
          id: 'user-2',
          email: 'staff@test.com',
          name: 'Test Staff',
          role: 'staff',
          created_at: new Date().toISOString(),
        },
        {
          id: 'user-3',
          email: 'admin@test.com',
          name: 'Test Admin',
          role: 'admin',
          created_at: new Date().toISOString(),
        },
      ],
    })
  }),

  // AI 设置
  http.get(`${API_BASE}/admin/settings/ai`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        enabled: true,
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        systemPrompt: 'You are a helpful assistant.',
        fastgptUrl: 'http://localhost:3000',
        fastgptAppId: 'test-app-id',
      },
    })
  }),

  http.put(`${API_BASE}/admin/settings/ai`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      success: true,
      data: body,
    })
  }),
]

// ============================================
// Health Check Handler
// ============================================
const healthHandlers = [
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        status: 'healthy',
        services: {
          api: 'operational',
          database: 'healthy',
          zammad: 'connected',
          fastgpt: 'not_configured',
        },
      },
    })
  }),
]

// ============================================
// Export all handlers
// ============================================
export const handlers = [
  ...authHandlers,
  ...conversationHandlers,
  ...ticketHandlers,
  ...faqHandlers,
  ...aiChatHandlers,
  ...adminHandlers,
  ...healthHandlers,
]
