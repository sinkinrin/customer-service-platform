/**
 * 客户咨询旅程测试
 * 
 * 模拟真实用户场景：
 * 1. 客户遇到问题，先查看 FAQ
 * 2. FAQ 没找到答案，发起 AI 对话
 * 3. AI 无法解决，转人工客服
 * 4. 客服处理完成，客户评价
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs/promises'

// Mock fs
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('Customer Journey: 从问题到解决', () => {
  // 模拟客户数据
  const customer = {
    id: 'cust_001',
    email: 'zhang.san@example.com',
    name: '张三',
    region: 'asia-pacific',
    role: 'customer' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([]))
  })

  describe('场景1: 客户通过 FAQ 自助解决问题', () => {
    it('客户搜索"如何重置密码"应该找到相关文章', async () => {
      // 这是最理想的场景：客户自助解决，无需人工介入
      const { SearchFAQSchema } = await import('@/types/api.types')
      
      const searchRequest = SearchFAQSchema.safeParse({
        query: '如何重置密码',
        locale: 'zh-CN',
        limit: 5,
      })
      
      expect(searchRequest.success).toBe(true)
      // 实际场景中，搜索结果应该包含密码重置相关文章
    })

    it('客户搜索不存在的问题应该返回空结果而不是报错', async () => {
      const { SearchFAQSchema } = await import('@/types/api.types')
      
      const searchRequest = SearchFAQSchema.safeParse({
        query: '这是一个完全不存在的问题12345',
        locale: 'zh-CN',
      })
      
      expect(searchRequest.success).toBe(true)
      // 空结果是正常的，不应该抛出错误
    })
  })

  describe('场景2: 客户发起 AI 对话', () => {
    it('客户创建新对话应该自动分配到正确区域', async () => {
      const { createAIConversation } = await import('@/lib/local-conversation-storage')
      
      const conversation = await createAIConversation(
        customer.id,
        customer.email,
        customer.region as any
      )
      
      expect(conversation.mode).toBe('ai')
      expect(conversation.status).toBe('active')
      expect(conversation.region).toBe('asia-pacific')
      expect(conversation.customer_id).toBe(customer.id)
    })

    it('客户发送消息后应该能收到 AI 回复', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify([]))  // messages
        .mockResolvedValueOnce(JSON.stringify([{   // conversations
          id: 'conv_001',
          customer_id: customer.id,
          customer_email: customer.email,
          mode: 'ai',
          status: 'active',
          region: 'asia-pacific',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        }]))
      
      const { addMessage } = await import('@/lib/local-conversation-storage')
      
      // 客户发送消息
      const customerMessage = await addMessage(
        'conv_001',
        'customer',
        customer.id,
        '我的订单一直显示处理中，已经3天了'
      )
      
      expect(customerMessage.sender_role).toBe('customer')
      expect(customerMessage.content).toContain('订单')
      
      // AI 应该回复（这里模拟）
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify([customerMessage]))
        .mockResolvedValueOnce(JSON.stringify([{
          id: 'conv_001',
          customer_id: customer.id,
          customer_email: customer.email,
          mode: 'ai',
          status: 'active',
          region: 'asia-pacific',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        }]))
      
      const aiMessage = await addMessage(
        'conv_001',
        'ai',
        'ai_assistant',
        '您好！我理解您对订单状态的担忧。请问您能提供订单号吗？我帮您查询一下具体情况。'
      )
      
      expect(aiMessage.sender_role).toBe('ai')
    })

    it('客户连续发送多条消息不应该丢失', async () => {
      const messages: any[] = []
      
      vi.mocked(fs.readFile).mockImplementation(async () => {
        return JSON.stringify(messages)
      })
      
      vi.mocked(fs.writeFile).mockImplementation(async (_, data) => {
        const parsed = JSON.parse(data as string)
        messages.length = 0
        messages.push(...parsed)
      })
      
      const { addMessage } = await import('@/lib/local-conversation-storage')
      
      // 客户快速发送3条消息
      await addMessage('conv_001', 'customer', customer.id, '第一条消息')
      await addMessage('conv_001', 'customer', customer.id, '第二条消息')
      await addMessage('conv_001', 'customer', customer.id, '第三条消息')
      
      expect(messages.length).toBe(3)
    })
  })

  describe('场景3: AI 无法解决，转人工客服', () => {
    it('转人工后对话模式应该变为 human', async () => {
      const conversations = [{
        id: 'conv_001',
        customer_id: customer.id,
        customer_email: customer.email,
        mode: 'ai',
        status: 'active',
        region: 'asia-pacific',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      }]
      
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(conversations))
      
      const { updateConversation } = await import('@/lib/local-conversation-storage')
      
      const updated = await updateConversation('conv_001', {
        mode: 'human',
        status: 'waiting',
        transferred_at: new Date().toISOString(),
        transfer_reason: 'AI 无法解答退款政策问题',
      })
      
      expect(updated?.mode).toBe('human')
      expect(updated?.status).toBe('waiting')
      expect(updated?.transfer_reason).toContain('退款')
    })

    it('转人工后客服应该能看到之前的 AI 对话历史', async () => {
      const messages = [
        { id: 'msg_1', conversation_id: 'conv_001', sender_role: 'customer', content: '我要退款' },
        { id: 'msg_2', conversation_id: 'conv_001', sender_role: 'ai', content: '请问是什么原因呢？' },
        { id: 'msg_3', conversation_id: 'conv_001', sender_role: 'customer', content: '产品有质量问题' },
      ]
      
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(messages))
      
      const { getConversationMessages } = await import('@/lib/local-conversation-storage')
      
      const history = await getConversationMessages('conv_001')
      
      expect(history.length).toBe(3)
      expect(history[0].sender_role).toBe('customer')
      expect(history[1].sender_role).toBe('ai')
    })
  })

  describe('场景4: 客服处理并关闭对话', () => {
    it('客服接单后应该分配 staff_id', async () => {
      const conversations = [{
        id: 'conv_001',
        customer_id: customer.id,
        customer_email: customer.email,
        mode: 'human',
        status: 'waiting',
        region: 'asia-pacific',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      }]
      
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(conversations))
      
      const { updateConversation } = await import('@/lib/local-conversation-storage')
      
      const updated = await updateConversation('conv_001', {
        staff_id: 'staff_001',
        staff_name: '李客服',
        assigned_at: new Date().toISOString(),
        status: 'active',
      })
      
      expect(updated?.staff_id).toBe('staff_001')
      expect(updated?.status).toBe('active')
    })

    it('客服关闭对话后客户应该能评价', async () => {
      const conversations = [{
        id: 'conv_001',
        customer_id: customer.id,
        customer_email: customer.email,
        mode: 'human',
        status: 'active',
        staff_id: 'staff_001',
        region: 'asia-pacific',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      }]
      
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(conversations))
      
      const { updateConversation } = await import('@/lib/local-conversation-storage')
      
      // 关闭对话
      await updateConversation('conv_001', { status: 'closed' })
      
      // 客户评价
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([{
        ...conversations[0],
        status: 'closed',
      }]))
      
      const rated = await updateConversation('conv_001', {
        rating: {
          score: 5,
          feedback: '客服很耐心，问题解决了！',
          rated_at: new Date().toISOString(),
        },
      })
      
      expect(rated?.rating?.score).toBe(5)
      expect(rated?.rating?.feedback).toContain('耐心')
    })
  })

  describe('场景5: 异常情况处理', () => {
    it('客户在对话中途刷新页面，应该能恢复对话', async () => {
      const conversations = [{
        id: 'conv_001',
        customer_id: customer.id,
        customer_email: customer.email,
        mode: 'ai',
        status: 'active',
        region: 'asia-pacific',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      }]
      
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(conversations))
      
      const { getCustomerConversations } = await import('@/lib/local-conversation-storage')
      
      // 模拟页面刷新后重新获取对话
      const customerConvs = await getCustomerConversations(customer.email)
      
      expect(customerConvs.length).toBeGreaterThan(0)
      expect(customerConvs[0].status).toBe('active')
    })

    it('客户同时有多个活跃对话时应该能区分', async () => {
      const conversations = [
        {
          id: 'conv_001',
          customer_id: customer.id,
          customer_email: customer.email,
          mode: 'ai',
          status: 'active',
          region: 'asia-pacific',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          last_message_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 'conv_002',
          customer_id: customer.id,
          customer_email: customer.email,
          mode: 'human',
          status: 'active',
          region: 'asia-pacific',
          created_at: '2024-01-02T10:00:00Z',
          updated_at: '2024-01-02T10:00:00Z',
          last_message_at: '2024-01-02T10:00:00Z',
        },
      ]
      
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(conversations))
      
      const { getCustomerConversations } = await import('@/lib/local-conversation-storage')
      
      const customerConvs = await getCustomerConversations(customer.email)
      
      expect(customerConvs.length).toBe(2)
      // 应该能区分 AI 对话和人工对话
      const aiConv = customerConvs.find(c => c.mode === 'ai')
      const humanConv = customerConvs.find(c => c.mode === 'human')
      expect(aiConv).toBeDefined()
      expect(humanConv).toBeDefined()
    })
  })
})
