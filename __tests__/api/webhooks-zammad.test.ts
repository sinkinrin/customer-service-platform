/**
 * Zammad webhook API integration tests
 */

import crypto from 'crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

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

vi.mock('@/lib/utils/cleanup', () => ({
  maybeRunCleanup: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/webhooks/zammad/route'

function createRequest(payload: any, headers?: Record<string, string>) {
  return {
    text: async () => JSON.stringify(payload),
    headers: new Headers(headers),
  } as any
}

function createRawRequest(rawBody: string, headers?: Record<string, string>) {
  return {
    text: async () => rawBody,
    headers: new Headers(headers),
  } as any
}

describe('Zammad webhook API', () => {
  const originalSecret = process.env.ZAMMAD_WEBHOOK_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.ticketUpdate.create).mockResolvedValue({
      id: 'ticket-update-1',
      createdAt: new Date('2026-07-22T00:00:00Z'),
    } as any)
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

  it('verifies the signature before parsing JSON', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = 'secret'

    const response = await POST(
      createRawRequest('not-json', { 'X-Zammad-Signature': 'invalid' })
    )

    expect(response.status).toBe(401)
  })

  it('accepts a valid signature', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = 'secret'
    const rawBody = JSON.stringify({ ticket: { id: 1 } })
    const signature = `sha1=${crypto.createHmac('sha1', 'secret').update(rawBody).digest('hex')}`

    const response = await POST(
      createRawRequest(rawBody, { 'X-Zammad-Signature': signature })
    )

    expect(response.status).toBe(200)
  })

  it('reads a real NextRequest body stream', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = ''
    const request = new NextRequest('http://localhost:3000/api/webhooks/zammad', {
      method: 'POST',
      body: JSON.stringify({ ticket: { id: 2 } }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(prisma.ticketUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ticketId: 2 }),
      })
    )
  })

  it('rejects an oversized real request body stream', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = ''
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024 + 1))
        controller.close()
      },
    })
    const request = new NextRequest('http://localhost:3000/api/webhooks/zammad', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })

    const response = await POST(request)

    expect(response.status).toBe(413)
    expect(prisma.ticketUpdate.create).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON without exposing parser details', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = ''

    const response = await POST(createRawRequest('not-json'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error.message).toBe('Invalid webhook payload')
    expect(JSON.stringify(payload)).not.toContain('Unexpected token')
  })

  it('rejects webhook bodies larger than 1 MiB', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = ''

    const response = await POST(createRawRequest('x'.repeat(1024 * 1024 + 1)))

    expect(response.status).toBe(413)
    expect(prisma.ticketUpdate.create).not.toHaveBeenCalled()
  })

  it('rejects an oversized declared body before reading it', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = ''
    const text = vi.fn().mockResolvedValue('{}')
    const request = {
      text,
      headers: new Headers({ 'content-length': String(1024 * 1024 + 1) }),
    } as any

    const response = await POST(request)

    expect(response.status).toBe(413)
    expect(text).not.toHaveBeenCalled()
  })

  it('does not expose unexpected request errors', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = ''
    const request = {
      text: async () => {
        throw new Error('internal parser failure at 10.0.0.12')
      },
      headers: new Headers(),
    } as any

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error.message).toBe('Failed to process webhook')
    expect(JSON.stringify(payload)).not.toContain('10.0.0.12')
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
