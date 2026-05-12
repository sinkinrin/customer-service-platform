import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockTransaction,
  mockExecuteRaw,
  mockUpdateMany,
  mockCreate,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockCreate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}))

import { createAIConversation } from '@/lib/ai-conversation-service'

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
})
