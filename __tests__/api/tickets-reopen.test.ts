/**
 * Ticket reopen API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PUT } from '@/app/api/tickets/[id]/reopen/route'

const {
  mockGetTicket,
  mockUpdateTicket,
  mockCreateArticle,
  mockResolveRecipients,
  mockNotifyTicketReopened,
  mockLoggerWarning,
  mockTransaction,
  mockExecuteRaw,
} = vi.hoisted(() => ({
  mockGetTicket: vi.fn(),
  mockUpdateTicket: vi.fn(),
  mockCreateArticle: vi.fn(),
  mockResolveRecipients: vi.fn(),
  mockNotifyTicketReopened: vi.fn(),
  mockLoggerWarning: vi.fn(),
  mockTransaction: vi.fn(),
  mockExecuteRaw: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => {
  class ZammadClient {
    getTicket = mockGetTicket
    updateTicket = mockUpdateTicket
    createArticle = mockCreateArticle
  }

  return { ZammadClient }
})

vi.mock('@/lib/notification', () => ({
  resolveLocalUserIdsForZammadUserId: mockResolveRecipients,
  notifyTicketReopened: mockNotifyTicketReopened,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}))

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warning: mockLoggerWarning,
    error: vi.fn(),
  },
}))

import { auth } from '@/auth'

function createRequest(url: string, body?: any, headers?: HeadersInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
    headers,
  })
}

describe('Ticket Reopen API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockCreateArticle.mockResolvedValue({ id: 900 })
    mockResolveRecipients.mockResolvedValue([])
    mockNotifyTicketReopened.mockResolvedValue(undefined)
    mockExecuteRaw.mockResolvedValue(0)
    mockTransaction.mockImplementation(async (callback: (tx: any) => unknown) => callback({
      $executeRaw: mockExecuteRaw,
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(401)
  })

  it('returns 409 before locking when the expected user no longer matches', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'staff_001', role: 'staff', email: 'staff@test.com' },
    } as any)

    const request = createRequest(
      'http://localhost:3000/api/tickets/1/reopen',
      undefined,
      { 'X-CSP-Expected-User-Id': 'staff_previous' }
    )
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload.error.code).toBe('IDENTITY_CHANGED')
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockUpdateTicket).not.toHaveBeenCalled()
  })

  it.each([
    'invalid',
    '123junk',
    '0',
    '-1',
    '9007199254740992',
  ])('rejects invalid ticket id %s', async (id) => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'staff_001', role: 'staff', email: 'staff@test.com' },
    } as any)

    const request = createRequest(`http://localhost:3000/api/tickets/${id}/reopen`)
    const response = await PUT(request, { params: Promise.resolve({ id }) })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe('INVALID_ID')
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('rejects reopening when ticket is neither closed nor already open', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin_001', role: 'admin', email: 'admin@test.com' },
    } as any)

    mockGetTicket.mockResolvedValue({
      id: 1,
      state_id: 3,
      customer_id: 10,
    })

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(400)
  })

  it('maps an upstream ticket lookup 404 to a local 404', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin_001', role: 'admin', email: 'admin@test.com' },
    } as any)
    mockGetTicket.mockRejectedValue(Object.assign(new Error('Ticket not found'), { status: 404 }))

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error.code).toBe('NOT_FOUND')
    expect(mockUpdateTicket).not.toHaveBeenCalled()
  })

  it('treats an already-open ticket as an idempotent success without duplicate side effects', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100 },
    } as any)
    mockGetTicket.mockResolvedValue({
      id: 1,
      number: '10001',
      state_id: 2,
      customer_id: 100,
      owner_id: 55,
    })

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.reopenStatus).toBe('already-open')
    expect(payload.data).not.toHaveProperty('auditNote')
    expect(mockUpdateTicket).not.toHaveBeenCalled()
    expect(mockCreateArticle).not.toHaveBeenCalled()
    expect(mockResolveRecipients).not.toHaveBeenCalled()
    expect(mockNotifyTicketReopened).not.toHaveBeenCalled()
  })

  it('serializes concurrent reopen requests so only one creates side effects', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100, full_name: 'Cust' },
    } as any)

    let ticketState = 4
    mockGetTicket.mockImplementation(async () => ({
      id: 1,
      number: '10001',
      state_id: ticketState,
      customer_id: 100,
      owner_id: 55,
    }))
    mockUpdateTicket.mockImplementation(async () => {
      ticketState = 2
      return { id: 1, number: '10001', state_id: 2, customer_id: 100, owner_id: 55 }
    })
    mockResolveRecipients.mockResolvedValue(['staff-local-55'])

    let lockTail = Promise.resolve()
    mockTransaction.mockImplementation(async (callback: (tx: any) => unknown) => {
      const previousHolder = lockTail
      let releaseLock!: () => void
      lockTail = new Promise<void>((resolve) => {
        releaseLock = resolve
      })

      try {
        return await callback({
          $executeRaw: vi.fn(async (...args: unknown[]) => {
            mockExecuteRaw(...args)
            await previousHolder
          }),
        })
      } finally {
        releaseLock()
      }
    })

    const responses = await Promise.all([
      PUT(createRequest('http://localhost:3000/api/tickets/1/reopen'), {
        params: Promise.resolve({ id: '1' }),
      }),
      PUT(createRequest('http://localhost:3000/api/tickets/1/reopen'), {
        params: Promise.resolve({ id: '1' }),
      }),
    ])
    const payloads = await Promise.all(responses.map((response) => response.json()))

    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(payloads.map((payload) => payload.data.reopenStatus).sort()).toEqual([
      'already-open',
      'updated',
    ])
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2)
    expect(mockUpdateTicket).toHaveBeenCalledTimes(1)
    expect(mockCreateArticle).toHaveBeenCalledTimes(1)
    expect(mockResolveRecipients).toHaveBeenCalledTimes(1)
    expect(mockNotifyTicketReopened).toHaveBeenCalledTimes(1)
  })

  it('prevents customers from reopening others tickets', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 99 },
    } as any)

    mockGetTicket.mockResolvedValue({
      id: 1,
      state_id: 4,
      customer_id: 100,
    })

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(403)
  })

  it('reopens closed ticket and adds internal note', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100, full_name: 'Cust' },
    } as any)

    mockGetTicket.mockResolvedValue({
      id: 1,
      state_id: 4,
      customer_id: 100,
    })

    mockUpdateTicket.mockResolvedValue({ id: 1 })

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.reopenStatus).toBe('updated')
    expect(payload.data.auditNote).toBe('created')
    expect(mockUpdateTicket).toHaveBeenCalledWith(1, { state: 'open' })
    expect(mockCreateArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket_id: 1,
        internal: true,
      })
    )
  })

  it('continues after an update error when read-back confirms the ticket is open', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100, full_name: 'Cust' },
    } as any)
    mockGetTicket
      .mockResolvedValueOnce({
        id: 1,
        number: '10001',
        state_id: 4,
        customer_id: 100,
        owner_id: 55,
      })
      .mockResolvedValueOnce({
        id: 1,
        number: '10001',
        state_id: 2,
        customer_id: 100,
        owner_id: 55,
      })
    mockUpdateTicket.mockRejectedValue(new Error('response lost'))
    mockResolveRecipients.mockResolvedValue(['staff-local-55'])

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.reopenStatus).toBe('confirmed-after-error')
    expect(payload.data.auditNote).toBe('created')
    expect(mockGetTicket).toHaveBeenCalledTimes(2)
    expect(mockUpdateTicket).toHaveBeenCalledTimes(1)
    expect(mockCreateArticle).toHaveBeenCalledTimes(1)
    expect(mockResolveRecipients).toHaveBeenCalledWith(55)
    expect(mockNotifyTicketReopened).toHaveBeenCalledTimes(1)
  })

  it('reconciles a 408 reopen response when read-back confirms the ticket is open', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100, full_name: 'Cust' },
    } as any)
    mockGetTicket
      .mockResolvedValueOnce({
        id: 1,
        number: '10001',
        state_id: 4,
        customer_id: 100,
        owner_id: 55,
      })
      .mockResolvedValueOnce({
        id: 1,
        number: '10001',
        state_id: 2,
        customer_id: 100,
        owner_id: 55,
      })
    mockUpdateTicket.mockRejectedValue(
      Object.assign(new Error('Reopen request timed out'), { status: 408 })
    )

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.reopenStatus).toBe('confirmed-after-error')
    expect(payload.data.auditNote).toBe('created')
    expect(mockGetTicket).toHaveBeenCalledTimes(2)
    expect(mockCreateArticle).toHaveBeenCalledTimes(1)
  })

  it('returns an explicit unconfirmed outcome when read-back is not open', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100 },
    } as any)
    mockGetTicket
      .mockResolvedValueOnce({ id: 1, state_id: 4, customer_id: 100, owner_id: 55 })
      .mockResolvedValueOnce({ id: 1, state_id: 4, customer_id: 100, owner_id: 55 })
    mockUpdateTicket.mockRejectedValue(new Error('write rejected'))

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.error.code).toBe('OUTCOME_UNCONFIRMED')
    expect(payload.error.details.observedStateId).toBe(4)
    expect(mockCreateArticle).not.toHaveBeenCalled()
    expect(mockResolveRecipients).not.toHaveBeenCalled()
    expect(mockNotifyTicketReopened).not.toHaveBeenCalled()
  })

  it('returns OUTCOME_UNCONFIRMED without side effects when reconciliation also fails', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100 },
    } as any)
    mockGetTicket
      .mockResolvedValueOnce({ id: 1, state_id: 4, customer_id: 100, owner_id: 55 })
      .mockRejectedValueOnce(new Error('read-back unavailable'))
    mockUpdateTicket.mockRejectedValue(new Error('response lost'))

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.error.code).toBe('OUTCOME_UNCONFIRMED')
    expect(payload.error.details.observedStateId).toBeNull()
    expect(mockCreateArticle).not.toHaveBeenCalled()
    expect(mockResolveRecipients).not.toHaveBeenCalled()
    expect(mockNotifyTicketReopened).not.toHaveBeenCalled()
  })

  it('does not reconcile a definitive 4xx update rejection', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100 },
    } as any)
    mockGetTicket.mockResolvedValue({ id: 1, state_id: 4, customer_id: 100, owner_id: 55 })
    mockUpdateTicket.mockRejectedValue(Object.assign(new Error('validation failed'), { status: 422 }))

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(502)
    expect(payload.error.code).toBe('REOPEN_REJECTED')
    expect(payload.error.details.upstreamStatus).toBe(422)
    expect(mockGetTicket).toHaveBeenCalledTimes(1)
    expect(mockCreateArticle).not.toHaveBeenCalled()
    expect(mockNotifyTicketReopened).not.toHaveBeenCalled()
  })

  it('maps a definitive update 404 to a local 404 without reconciliation', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100 },
    } as any)
    mockGetTicket.mockResolvedValue({ id: 1, state_id: 4, customer_id: 100, owner_id: 55 })
    mockUpdateTicket.mockRejectedValue(Object.assign(new Error('Ticket disappeared'), { status: 404 }))

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error.code).toBe('NOT_FOUND')
    expect(mockGetTicket).toHaveBeenCalledTimes(1)
    expect(mockCreateArticle).not.toHaveBeenCalled()
  })

  it('marks a definite 4xx article rejection without rolling back the reopen', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100, full_name: 'Cust' },
    } as any)
    mockGetTicket.mockResolvedValue({
      id: 1,
      number: '10001',
      state_id: 4,
      customer_id: 100,
      owner_id: 55,
    })
    mockUpdateTicket.mockResolvedValue({ id: 1, state_id: 2, owner_id: 55 })
    mockCreateArticle.mockRejectedValue(Object.assign(
      new Error('article validation failed'),
      { status: 422 }
    ))
    mockResolveRecipients.mockResolvedValue(['staff-local-55'])

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(207)
    expect(payload.data.reopenStatus).toBe('updated')
    expect(payload.data.auditNote).toBe('rejected')
    expect(mockUpdateTicket).toHaveBeenCalledTimes(1)
    expect(mockCreateArticle).toHaveBeenCalledTimes(1)
    expect(mockNotifyTicketReopened).toHaveBeenCalledTimes(1)
  })

  it('marks a 408 audit article response as unconfirmed rather than rejected', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100, full_name: 'Cust' },
    } as any)
    mockGetTicket.mockResolvedValue({
      id: 1,
      number: '10001',
      state_id: 4,
      customer_id: 100,
      owner_id: 55,
    })
    mockUpdateTicket.mockResolvedValue({ id: 1, state_id: 2, owner_id: 55 })
    mockCreateArticle.mockRejectedValue(
      Object.assign(new Error('Article request timed out'), { status: 408 })
    )

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(207)
    expect(payload.data.reopenStatus).toBe('updated')
    expect(payload.data.auditNote).toBe('unconfirmed')
    expect(payload.data.auditNote).not.toBe('rejected')
    expect(payload.data.message).toContain('could not be confirmed')
  })

  it('keeps the ticket open when the audit note outcome cannot be confirmed', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100, full_name: 'Cust' },
    } as any)

    mockGetTicket.mockResolvedValue({
      id: 1,
      number: '10001',
      state_id: 4,
      customer_id: 100,
    })
    mockUpdateTicket.mockResolvedValueOnce({ id: 1, state_id: 2 })
    mockCreateArticle.mockRejectedValue(new Error('note creation failed'))

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    const payload = await response.json()

    expect(response.status).toBe(207)
    expect(payload.data.state).toBe('open')
    expect(payload.data.auditNote).toBe('unconfirmed')
    expect(payload.data.message).toContain('audit note could not be confirmed')
    expect(mockUpdateTicket).toHaveBeenCalledTimes(1)
    expect(mockUpdateTicket).toHaveBeenCalledWith(1, { state: 'open' })
    expect(mockLoggerWarning).toHaveBeenCalledWith(
      'TicketReopen',
      expect.stringContaining('ticket remains open'),
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: 1,
          state: 'open',
          error: 'note creation failed',
        }),
      })
    )
  })

  it('returns OUTCOME_UNCONFIRMED when transaction commit fails after the reopen mutation', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100 },
    } as any)
    mockGetTicket.mockResolvedValue({
      id: 1,
      number: '10001',
      state_id: 4,
      customer_id: 100,
      owner_id: 55,
    })
    mockUpdateTicket.mockResolvedValue({ id: 1, state_id: 2, owner_id: 55 })
    mockTransaction.mockImplementationOnce(async (callback: (tx: any) => unknown) => {
      await callback({ $executeRaw: mockExecuteRaw })
      throw new Error('transaction commit failed')
    })

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.error.code).toBe('OUTCOME_UNCONFIRMED')
    expect(payload.error.details.ticketId).toBe(1)
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
    expect(mockUpdateTicket).toHaveBeenCalledWith(1, { state: 'open' })
  })

  it('keeps a pre-lock transaction failure as an internal error', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100 },
    } as any)
    mockTransaction.mockRejectedValueOnce(new Error('transaction unavailable'))

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error.code).toBe('INTERNAL_ERROR')
    expect(mockExecuteRaw).not.toHaveBeenCalled()
    expect(mockUpdateTicket).not.toHaveBeenCalled()
  })

  it('denies staff reopening unassigned tickets even when group matches', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'staff_001',
        role: 'staff',
        email: 'staff@test.com',
        zammad_id: 55,
        group_ids: [2],
      },
    } as any)

    mockGetTicket.mockResolvedValue({
      id: 1,
      state_id: 4,
      customer_id: 100,
      owner_id: 1,
      group_id: 2,
    })

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(403)
    expect(mockUpdateTicket).not.toHaveBeenCalled()
  })

  it('denies staff reopening tickets when session group_ids are missing and ticket is not assigned to them', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'staff_001',
        role: 'staff',
        email: 'staff@test.com',
        zammad_id: 55,
      },
    } as any)

    mockGetTicket.mockResolvedValue({
      id: 1,
      state_id: 4,
      customer_id: 100,
      owner_id: 99,
      group_id: 2,
    })

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(403)
    expect(mockUpdateTicket).not.toHaveBeenCalled()
  })
})
