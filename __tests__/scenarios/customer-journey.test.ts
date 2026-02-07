/**
 * Customer journey scenarios
 *
 * These scenarios verify AI conversation service behavior using Prisma mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    aiConversation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    aiMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    aiMessageRating: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('Customer journey: AI conversation', () => {
  const customer = {
    id: 'cust_001',
    email: 'zhang.san@example.com',
    region: 'asia-pacific',
    role: 'customer' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new AI conversation for the customer', async () => {
    const mockConversation = {
      id: 'conv_001',
      customerId: customer.id,
      customerEmail: customer.email,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: new Date(),
    }

    vi.mocked(prisma.aiConversation.updateMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.aiConversation.create).mockResolvedValue(mockConversation as any)

    const { createAIConversation } = await import('@/lib/ai-conversation-service')
    const conversation = await createAIConversation(customer.id, customer.email)

    expect(conversation.status).toBe('active')
    expect(conversation.customerId).toBe(customer.id)
    expect(prisma.aiConversation.updateMany).toHaveBeenCalledWith({
      where: { customerId: customer.id, status: 'active' },
      data: { status: 'closed' },
    })
  })

  it('retrieves conversation messages with ratings', async () => {
    const mockMessages = [
      {
        id: 'msg_1',
        conversationId: 'conv_001',
        senderRole: 'customer',
        senderId: customer.id,
        content: 'Refund request',
        messageType: 'text',
        metadata: null,
        createdAt: new Date(),
        rating: null,
      },
      {
        id: 'msg_2',
        conversationId: 'conv_001',
        senderRole: 'ai',
        senderId: 'ai',
        content: 'Need more info',
        messageType: 'text',
        metadata: null,
        createdAt: new Date(),
        rating: { id: 'r1', rating: 'positive', feedback: null },
      },
    ]

    vi.mocked(prisma.aiMessage.findMany).mockResolvedValue(mockMessages as any)

    const { getConversationMessages } = await import('@/lib/ai-conversation-service')
    const history = await getConversationMessages('conv_001')

    expect(history.length).toBe(2)
    expect(history[1].senderRole).toBe('ai')
    expect(history[1].rating?.rating).toBe('positive')
  })

  it('rates an AI message with upsert', async () => {
    const mockRating = {
      id: 'rating_1',
      messageId: 'msg_2',
      userId: customer.id,
      rating: 'negative',
      feedback: 'Not accurate',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(prisma.aiMessageRating.upsert).mockResolvedValue(mockRating as any)

    const { rateMessage } = await import('@/lib/ai-conversation-service')
    const result = await rateMessage('msg_2', customer.id, 'negative', 'Not accurate')

    expect(result?.rating).toBe('negative')
    expect(result?.feedback).toBe('Not accurate')
  })
})
