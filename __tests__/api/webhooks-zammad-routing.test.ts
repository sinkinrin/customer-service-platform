import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticketUpdate: {
      create: vi.fn().mockResolvedValue({
        id: 'tu_1',
        createdAt: new Date('2026-04-16T00:00:00Z'),
      }),
    },
    userZammadMapping: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notification: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

const { mockHandleEmailTicketRouting, mockHandleEmailUserWelcome } = vi.hoisted(() => ({
  mockHandleEmailTicketRouting: vi.fn(),
  mockHandleEmailUserWelcome: vi.fn(),
}))

vi.mock('@/lib/ticket/email-ticket-routing', () => ({
  handleEmailTicketRoutingFromWebhookPayload: mockHandleEmailTicketRouting,
}))

vi.mock('@/lib/ticket/email-user-welcome', () => ({
  handleEmailUserWelcomeFromWebhookPayload: mockHandleEmailUserWelcome,
}))

import { POST } from '@/app/api/webhooks/zammad/route'

function createRequest(payload: any) {
  return {
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as any
}

describe('Zammad webhook routing orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('triggers email routing and welcome flow for created email tickets', async () => {
    const payload = {
      ticket: {
        id: 10,
        title: 'New ticket',
        number: 'T-10',
        customer_id: 33,
        group_id: 9,
        state_id: 1,
        created_at: '2024-01-10T00:00:00Z',
      },
      article: {
        id: 100,
        type: 'email',
        subject: 'Help',
        created_at: '2024-01-10T00:00:02Z',
      },
    }

    const response = await POST(createRequest(payload))

    expect(response.status).toBe(200)
    expect(mockHandleEmailTicketRouting).toHaveBeenCalledWith(payload, undefined)
    expect(mockHandleEmailUserWelcome).toHaveBeenCalledWith(payload, undefined)
  })

  it('waits for routing and welcome side effects before acknowledging created email tickets', async () => {
    const payload = {
      ticket: {
        id: 10,
        title: 'New ticket',
        number: 'T-10',
        customer_id: 33,
        group_id: 9,
        state_id: 1,
        created_at: '2024-01-10T00:00:00Z',
      },
      article: {
        id: 100,
        type: 'email',
        subject: 'Help',
        created_at: '2024-01-10T00:00:02Z',
      },
    }

    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    mockHandleEmailTicketRouting.mockImplementation(async () => {
      await gate
    })
    mockHandleEmailUserWelcome.mockImplementation(async () => {
      await gate
    })

    let settled = false
    const responsePromise = POST(createRequest(payload)).then((response) => {
      settled = true
      return response
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(settled).toBe(false)

    release()

    const response = await responsePromise
    expect(response.status).toBe(200)
  })
})
