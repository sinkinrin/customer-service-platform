import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const { mockTransaction, mockMessageCreate, mockMessageFindUnique, mockConversationUpdate } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockMessageFindUnique: vi.fn(),
  mockConversationUpdate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    aiMessage: {
      create: mockMessageCreate,
      findUnique: mockMessageFindUnique,
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
    mockMessageFindUnique.mockResolvedValue(null)
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

  it('returns the winning AI message when a concurrent insert hits the unique constraint', async () => {
    const existing = {
      id: 'dup-msg',
      conversationId: 'conv-1',
      senderRole: 'ai',
      content: 'hello',
      metadata: null,
      createdAt: new Date(),
    }
    mockTransaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate AI request', {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
      })
    )
    mockMessageFindUnique.mockResolvedValue(existing)

    const result = await addMessage('conv-1', 'ai', 'user-1', 'hello', {
      aiRequestId: 'request-1',
    })

    expect(result.id).toBe('dup-msg')
    expect(mockMessageFindUnique).toHaveBeenCalledWith({
      where: {
        conversationId_aiRequestId: {
          conversationId: 'conv-1',
          aiRequestId: 'request-1',
        },
      },
    })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('inserts when no message exists for the request id', async () => {
    const result = await addMessage('conv-1', 'ai', 'user-1', 'hello', {
      aiRequestId: 'request-2',
    })

    expect(result.id).toBe('new-msg')
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockMessageCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ aiRequestId: 'request-2' }),
    }))
  })

  it('allows identical AI content when no request id is supplied', async () => {
    const result = await addMessage('conv-1', 'ai', 'user-1', 'hello')

    expect(result.id).toBe('new-msg')
    expect(mockMessageFindUnique).not.toHaveBeenCalled()
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

    expect(mockMessageFindUnique).not.toHaveBeenCalled()
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })
})
