import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/ai-conversation-service', () => ({
  getCustomerConversations: vi.fn(),
  createAIConversation: vi.fn(),
  createAIConversationWithInitialMessage: vi.fn(),
}))

import { requireAuth } from '@/lib/utils/auth'
import { getCustomerConversations, createAIConversationWithInitialMessage } from '@/lib/ai-conversation-service'
import { GET, POST } from '@/app/api/conversations/route'

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('GET /api/conversations list query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'cust_1',
      email: 'customer@test.com',
      role: 'customer',
      full_name: 'Customer',
    } as any)
    vi.mocked(getCustomerConversations).mockResolvedValue([] as any)
  })

  it('passes status and pagination to the database service', async () => {
    const response = await GET(
      createRequest('http://localhost:3000/api/conversations?status=active&limit=5&offset=10')
    )

    expect(response.status).toBe(200)
    expect(getCustomerConversations).toHaveBeenCalledWith('cust_1', {
      status: 'active',
      limit: 5,
      offset: 10,
    })
  })

  it('creates conversation and initial message in one request when initial_message is provided', async () => {
    vi.mocked(createAIConversationWithInitialMessage).mockResolvedValue({
      conversation: {
        id: 'conv_1',
        customerId: 'cust_1',
        status: 'active',
        createdAt: new Date('2026-05-12T00:00:00.000Z'),
        updatedAt: new Date('2026-05-12T00:00:00.000Z'),
        lastMessageAt: new Date('2026-05-12T00:00:01.000Z'),
      },
      message: {
        id: 'msg_1',
        conversationId: 'conv_1',
        senderId: 'cust_1',
        senderRole: 'customer',
        content: 'hello',
        messageType: 'text',
        metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
        createdAt: new Date('2026-05-12T00:00:01.000Z'),
        updatedAt: new Date('2026-05-12T00:00:01.000Z'),
      },
    } as any)

    const response = await POST(
      createRequest('http://localhost:3000/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          initial_message: 'hello',
          initial_metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(createAIConversationWithInitialMessage).toHaveBeenCalledWith(
      'cust_1',
      'customer@test.com',
      'hello',
      { aiMode: true, role: 'customer', aiChatMode: 'flash', sender_name: 'Customer' },
      'customer'
    )
    expect(payload.success).toBe(true)
    expect(payload.data.conversation.id).toBe('conv_1')
    expect(payload.data.message.id).toBe('msg_1')
  })
})
