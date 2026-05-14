import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockTransaction,
  mockExecuteRaw,
  mockUpdateMany,
  mockCreate,
  mockConversationGroupBy,
  mockMessageGroupBy,
  mockRatingGroupBy,
  mockRatingFindMany,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockCreate: vi.fn(),
  mockConversationGroupBy: vi.fn(),
  mockMessageGroupBy: vi.fn(),
  mockRatingGroupBy: vi.fn(),
  mockRatingFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    aiConversation: {
      groupBy: mockConversationGroupBy,
    },
    aiMessage: {
      groupBy: mockMessageGroupBy,
    },
    aiMessageRating: {
      groupBy: mockRatingGroupBy,
      findMany: mockRatingFindMany,
    },
  },
}))

import { createAIConversation, getAiConversationDashboardStats } from '@/lib/ai-conversation-service'

describe('ai-conversation-service createAIConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation(async (fn: any) => fn({
      $executeRaw: mockExecuteRaw,
      aiConversation: {
        updateMany: mockUpdateMany,
        create: mockCreate,
      },
    }))
    mockCreate.mockResolvedValue({ id: 'conv-1', customerId: 'user-1', status: 'active' })
  })

  it('closes active conversations by authenticated user id before creating', async () => {
    await createAIConversation('user-1', 'u1@test.com')
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { customerId: 'user-1', status: 'active' },
      data: { status: 'closed' },
    })
  })

  it('uses advisory lock to serialize concurrent creates for same user', async () => {
    await createAIConversation('user-1', 'u1@test.com')
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('keeps exactly one active conversation after concurrent create requests', async () => {
    const db: Array<{ id: string; customerId: string; status: 'active' | 'closed'; customerEmail: string }> = [
      { id: 'old-1', customerId: 'user-1', status: 'active', customerEmail: 'u1@test.com' },
    ]
    let locked = false
    const queue: Array<() => void> = []
    let idCounter = 1

    mockTransaction.mockImplementation(async (fn: any) => fn({
      $executeRaw: vi.fn(async () => {
        if (!locked) {
          locked = true
          return
        }
        await new Promise<void>((resolve) => queue.push(resolve))
        locked = true
      }),
      aiConversation: {
        updateMany: vi.fn(async ({ where, data }: any) => {
          db.forEach((row) => {
            if (row.customerId === where.customerId && row.status === where.status) {
              row.status = data.status
            }
          })
        }),
        create: vi.fn(async ({ data }: any) => {
          const created = { id: `conv-${idCounter += 1}`, ...data }
          db.push(created)
          locked = false
          const next = queue.shift()
          next?.()
          return created
        }),
      },
    }))

    await Promise.all([
      createAIConversation('user-1', 'u1@test.com'),
      createAIConversation('user-1', 'u1@test.com'),
    ])

    const active = db.filter((row) => row.customerId === 'user-1' && row.status === 'active')
    expect(active).toHaveLength(1)
    expect(db.filter((row) => row.customerId === 'user-1')).toHaveLength(3)
  })

  it('excludes staff-only assistant conversations from dashboard stats', async () => {
    mockConversationGroupBy.mockResolvedValue([{ status: 'active', _count: 2 }])
    mockMessageGroupBy.mockResolvedValue([{ senderRole: 'customer', _count: 3 }, { senderRole: 'ai', _count: 3 }])
    mockRatingGroupBy.mockResolvedValue([{ rating: 'positive', _count: 1 }])
    mockRatingFindMany.mockResolvedValue([])

    await getAiConversationDashboardStats()

    const customerConversationWhere = { messages: { some: { senderRole: 'customer' } } }
    expect(mockConversationGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: customerConversationWhere,
    }))
    expect(mockMessageGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { conversation: customerConversationWhere },
    }))
    expect(mockRatingGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { message: { conversation: customerConversationWhere } },
    }))
    expect(mockRatingFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        rating: 'negative',
        message: { conversation: customerConversationWhere },
      },
    }))
  })
})
