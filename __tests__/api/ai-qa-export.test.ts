/**
 * AI Q&A export API tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aiMessage: {
      findMany: vi.fn(),
    },
  },
}))

import { requireRole } from '@/lib/utils/auth'
import { prisma } from '@/lib/prisma'
import { GET as GET_ADMIN_EXPORT } from '@/app/api/admin/ai-export/route'
import { GET as GET_STAFF_EXPORT } from '@/app/api/staff/ai-qa/export/route'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

function mockAiQaMessages() {
  const customerCreatedAt = new Date('2026-05-01T09:59:00.000Z')
  const aiCreatedAt = new Date('2026-05-01T10:00:00.000Z')

  vi.mocked(prisma.aiMessage.findMany)
    .mockResolvedValueOnce([
      {
        id: 'ai_1',
        conversationId: 'conv_1',
        senderRole: 'ai',
        senderId: 'customer_1',
        content: 'Pro answer',
        messageType: 'text',
        metadata: JSON.stringify({ aiMode: true, role: 'ai', aiChatMode: 'pro' }),
        createdAt: aiCreatedAt,
        conversation: { customerEmail: 'customer@example.com' },
        rating: { rating: 'positive', feedback: null },
        review: { status: 'correct', reviewNote: 'ok', retestAnswer: null },
      },
    ] as any)
    .mockResolvedValueOnce([
      {
        id: 'customer_1',
        conversationId: 'conv_1',
        senderRole: 'customer',
        content: 'Question',
        createdAt: customerCreatedAt,
      },
      {
        id: 'ai_1',
        conversationId: 'conv_1',
        senderRole: 'ai',
        content: 'Pro answer',
        createdAt: aiCreatedAt,
      },
    ] as any)
}

describe('AI Q&A export APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue(undefined as any)
  })

  it('exports AI mode in the staff QA CSV', async () => {
    mockAiQaMessages()

    const response = await GET_STAFF_EXPORT(
      createRequest('http://localhost:3000/api/staff/ai-qa/export?from=2026-05-01&to=2026-05-02')
    )
    const text = await response.text()
    const csv = text.startsWith('\uFEFF') ? text.slice(1) : text
    const lines = csv.split('\n')

    expect(response.status).toBe(200)
    expect(prisma.aiMessage.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        conversation: { messages: { some: { senderRole: 'customer' } } },
      }),
    }))
    expect(lines[0]).toContain('AI Mode')
    expect(lines[1]).toContain(',pro,')
  })

  it('exports AI mode in the admin QA CSV', async () => {
    mockAiQaMessages()

    const response = await GET_ADMIN_EXPORT(
      createRequest('http://localhost:3000/api/admin/ai-export?from=2026-05-01&to=2026-05-02')
    )
    const text = await response.text()
    const csv = text.startsWith('\uFEFF') ? text.slice(1) : text
    const lines = csv.split('\n')

    expect(response.status).toBe(200)
    expect(prisma.aiMessage.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        conversation: { messages: { some: { senderRole: 'customer' } } },
      }),
    }))
    expect(lines[0]).toContain('AI Mode')
    expect(lines[1]).toContain(',pro,')
  })
})
