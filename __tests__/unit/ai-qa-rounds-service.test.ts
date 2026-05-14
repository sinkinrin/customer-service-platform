import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockQueryRaw,
  mockAiMessageFindMany,
  mockAiMessageCount,
  mockRatingFindMany,
  mockReviewFindMany,
  mockConversationFindMany,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockAiMessageFindMany: vi.fn(),
  mockAiMessageCount: vi.fn(),
  mockRatingFindMany: vi.fn(),
  mockReviewFindMany: vi.fn(),
  mockConversationFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    aiMessage: {
      findMany: mockAiMessageFindMany,
      count: mockAiMessageCount,
    },
    aiMessageRating: {
      findMany: mockRatingFindMany,
    },
    aiQaReview: {
      findMany: mockReviewFindMany,
    },
    aiConversation: {
      findMany: mockConversationFindMany,
    },
  },
}))

import { queryRounds } from '@/lib/ai-qa/rounds-service'

describe('queryRounds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryRaw.mockResolvedValue([])
    mockAiMessageCount.mockResolvedValue(0)
    mockAiMessageFindMany.mockResolvedValue([])
    mockRatingFindMany.mockResolvedValue([])
    mockReviewFindMany.mockResolvedValue([])
    mockConversationFindMany.mockResolvedValue([])
  })

  it('fetches only the requested page of AI messages', async () => {
    await queryRounds({
      status: 'all',
      from: new Date('2026-05-01T00:00:00Z'),
      to: new Date('2026-05-14T23:59:59Z'),
      page: 3,
      pageSize: 20,
    })

    const sql = mockQueryRaw.mock.calls[0][0]
    expect(sql.values).toEqual(expect.arrayContaining([40, 20]))
    expect(sql.strings.join(' ')).toContain('ORDER BY')
    expect(sql.strings.join(' ')).toContain("rating.\"rating\" = 'negative'")
    expect(sql.strings.join(' ')).toContain('customer_message."senderRole" = \'customer\'')
    expect(sql.strings.join(' ')).toContain('OFFSET')
    expect(sql.strings.join(' ')).toContain('LIMIT')
  })

  it('returns real totals and the preceding customer question for the page', async () => {
    const aiCreatedAt = new Date('2026-05-14T10:01:00Z')
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: 'ai-1',
        conversationId: 'conv-1',
        content: 'answer',
        createdAt: aiCreatedAt,
      },
    ])
    mockAiMessageFindMany
      .mockResolvedValueOnce([
        {
          id: 'cust-1',
          conversationId: 'conv-1',
          senderRole: 'customer',
          content: 'question',
          createdAt: new Date('2026-05-14T10:00:00Z'),
        },
        {
          id: 'ai-1',
          conversationId: 'conv-1',
          senderRole: 'ai',
          content: 'answer',
          createdAt: aiCreatedAt,
        },
      ])
    mockAiMessageCount
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
    mockRatingFindMany.mockResolvedValue([{ messageId: 'ai-1', rating: 'negative', feedback: 'bad' }])
    mockReviewFindMany.mockResolvedValue([{ messageId: 'ai-1', status: 'incorrect', reviewNote: 'wrong', retestAnswer: null, retestAt: null }])
    mockConversationFindMany.mockResolvedValue([{ id: 'conv-1', customerEmail: 'customer@example.com' }])

    const result = await queryRounds({
      status: 'all',
      from: new Date('2026-05-01T00:00:00Z'),
      to: new Date('2026-05-14T23:59:59Z'),
      page: 1,
      pageSize: 20,
    })

    expect(result.total).toBe(10)
    expect(result.stats).toEqual({ total: 10, unreviewed: 4, correct: 5, incorrect: 1 })
    expect(result.rounds[0]).toMatchObject({
      question: 'question',
      answer: 'answer',
      customerEmail: 'customer@example.com',
      customerRating: 'negative',
      reviewStatus: 'incorrect',
    })
    expect(mockAiMessageCount).toHaveBeenCalledWith({
      where: expect.objectContaining({
        conversation: { messages: { some: { senderRole: 'customer' } } },
      }),
    })
  })
})
