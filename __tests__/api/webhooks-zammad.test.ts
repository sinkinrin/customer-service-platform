/**
 * Zammad webhook API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticketUpdate: {
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
        state_id: 4,
        owner_id: 22,
      },
    }

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
  })
})
