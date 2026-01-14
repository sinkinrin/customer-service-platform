/**
 * Zammad webhook API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticketUpdate: {
      create: vi.fn(),
    },
    userZammadMapping: {
      findMany: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/webhooks/zammad/route'

function createRequest(payload: any, headers?: Record<string, string>) {
  return {
    text: async () => JSON.stringify(payload),
    headers: new Headers(headers),
  } as any
}

describe('Zammad webhook API', () => {
  const originalSecret = process.env.ZAMMAD_WEBHOOK_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.userZammadMapping.findMany).mockResolvedValue([] as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
    process.env.ZAMMAD_WEBHOOK_SECRET = originalSecret
  })

  it('rejects invalid signatures when secret is set', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = 'secret'

    const payload = { ticket: { id: 1 } }
    const response = await POST(
      createRequest(payload, { 'X-Zammad-Signature': 'invalid' })
    )

    expect(response.status).toBe(401)
  })

  it('stores created events when ticket and article are created together', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = ''

    const payload = {
      ticket: {
        id: 10,
        title: 'New ticket',
        state_id: 1,
        created_at: '2024-01-10T00:00:00Z',
      },
      article: {
        id: 100,
        subject: 'Help',
        created_at: '2024-01-10T00:00:02Z',
      },
    }

    const response = await POST(createRequest(payload))
    expect(response.status).toBe(200)

    expect(prisma.ticketUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: 10,
          event: 'created',
        }),
      })
    )
  })

  it('stores status change events when no article is present', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = ''

    const payload = {
      ticket: {
        id: 11,
        title: 'Status update',
        number: 'T-11',
        state_id: 4,
        owner_id: 22,
        customer_id: 33,
      },
    }

    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null as any)

    const response = await POST(createRequest(payload))
    expect(response.status).toBe(200)

    expect(prisma.ticketUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: 11,
          event: 'status_changed',
        }),
      })
    )

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'zammad-33',
          type: 'ticket_status',
        }),
      })
    )
  })

  it('creates in-app notification for customer reply to owner', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = ''

    const payload = {
      ticket: {
        id: 12,
        number: 'T-12',
        title: 'Reply test',
        owner_id: 22,
        customer_id: 33,
        state_id: 2,
        created_at: '2024-01-10T00:00:00Z',
        updated_at: '2024-01-10T00:10:00Z',
      },
      article: {
        id: 120,
        sender: 'Customer',
        from: 'customer@example.com',
        subject: 'Re: Reply test',
        created_at: '2024-01-10T00:09:59Z',
      },
    }

    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null as any)

    const response = await POST(createRequest(payload))
    expect(response.status).toBe(200)

    expect(prisma.ticketUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: 12,
          event: 'article_created',
        }),
      })
    )

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'zammad-22',
          type: 'ticket_reply',
        }),
      })
    )
  })
})
