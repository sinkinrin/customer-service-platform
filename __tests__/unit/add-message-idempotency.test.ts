import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockTransaction, mockMessageCreate, mockMessageFindFirst, mockConversationUpdate } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockMessageFindFirst: vi.fn(),
  mockConversationUpdate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    aiMessage: {
      create: mockMessageCreate,
      findFirst: mockMessageFindFirst,
    },
    aiConversation: {
      update: mockConversationUpdate,
    },
  },
}))

import { addMessage } from '@/lib/ai-conversation-service'

describe('addMessage idempotency guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMessageFindFirst.mockResolvedValue(null)
    // Array-form $transaction: resolve the given promises
    mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    mockMessageCreate.mockResolvedValue({
      id: 'new-msg',
      conversationId: 'conv-1',
      senderRole: 'ai',
      content: 'hello',
      metadata: null,
      createdAt: new Date(),
    })
    mockConversationUpdate.mockResolvedValue({})
  })

  it('skips insert and returns the existing AI message for the same request id', async () => {
    const existing = {
      id: 'dup-msg',
      conversationId: 'conv-1',
      senderRole: 'ai',
      content: 'hello',
      metadata: null,
      createdAt: new Date(),
    }
    mockMessageFindFirst.mockResolvedValue(existing)

    const result = await addMessage('conv-1', 'ai', 'user-1', 'hello', {
      aiRequestId: 'request-1',
    })

    expect(result.id).toBe('dup-msg')
    expect(mockMessageFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        conversationId: 'conv-1',
        senderRole: 'ai',
        metadata: { contains: '"aiRequestId":"request-1"' },
      }),
    }))
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockMessageCreate).not.toHaveBeenCalled()
  })

  it('inserts when no message exists for the request id', async () => {
    const result = await addMessage('conv-1', 'ai', 'user-1', 'hello', {
      aiRequestId: 'request-2',
    })

    expect(result.id).toBe('new-msg')
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('allows identical AI content when no request id is supplied', async () => {
    const result = await addMessage('conv-1', 'ai', 'user-1', 'hello')

    expect(result.id).toBe('new-msg')
    expect(mockMessageFindFirst).not.toHaveBeenCalled()
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('does not run duplicate check for non-ai messages', async () => {
    mockMessageCreate.mockResolvedValue({
      id: 'cust-msg',
      conversationId: 'conv-1',
      senderRole: 'customer',
      content: 'hi',
      metadata: null,
      createdAt: new Date(),
    })

    await addMessage('conv-1', 'customer', 'user-1', 'hi')

    expect(mockMessageFindFirst).not.toHaveBeenCalled()
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })
})
