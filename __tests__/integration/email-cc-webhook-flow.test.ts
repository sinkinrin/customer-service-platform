import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import { http, HttpResponse } from 'msw'
import { server } from '@tests/mocks/server'
import { POST } from '@/app/api/webhooks/zammad/route'
import { sseEmitter } from '@/lib/sse/emitter'

const db = vi.hoisted(() => ({
  ticketUpdate: { create: vi.fn() },
  customerGroupAssignment: { findUnique: vi.fn() },
  userZammadMapping: { findMany: vi.fn() },
  notification: { findFirst: vi.fn(), create: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/utils/cleanup', () => ({ maybeRunCleanup: vi.fn() }))
vi.mock('@/lib/sse/emitter', () => ({ sseEmitter: { broadcast: vi.fn() } }))
// Welcome emails are outside this test: no SMTP or live Zammad is involved.
vi.mock('@/lib/ticket/email-user-welcome', () => ({ handleEmailUserWelcomeFromWebhookPayload: vi.fn() }))
vi.mock('@/lib/zammad/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/zammad/client')>()
  return { ...actual, zammadClient: new actual.ZammadClient('http://zammad-cc.test', 'isolated-test-token', 1000, 0) }
})

const api = 'http://zammad-cc.test/api/v1'
const secret = 'isolated-webhook-secret'
const createdAt = '2026-09-08T00:00:00Z'
const firstArticle = {
  id: 10, ticket_id: 100, type: 'email', sender: 'Customer', internal: false,
  cc: '"Support, APAC" <ENGINEER@example.com>', created_at: '2026-09-08T00:00:12Z',
}
const fixedOwner = {
  id: 2, email: 'fixed@example.com', firstname: 'Fixed', lastname: 'Owner',
  role_ids: [2], active: true, out_of_office: false, group_ids: { '4': ['full'] },
}
const ccOwner = { ...fixedOwner, id: 3, email: 'engineer@example.com' }
let ticket: {
  id: number; number: string; title: string; customer_id: number; group_id: number;
  owner_id: number; state_id: number; created_at: string; last_owner_update_at: string | null;
}
let writes: Record<string, unknown>[]
let requests: string[]
let changeOwnerDuringSearch: boolean

function webhook(article = firstArticle) {
  // Actual Zammad article is authoritative; deliberately omit CC from webhook.
  return { ticket: { ...ticket }, article: { id: article.id, type: article.type, sender: article.sender, created_at: article.created_at } }
}
async function deliver(payload: ReturnType<typeof webhook>) {
  const body = JSON.stringify(payload)
  const signature = createHmac('sha1', secret).update(body).digest('hex')
  return POST(new NextRequest('http://platform.test/api/webhooks/zammad', {
    method: 'POST', body,
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature': `sha1=${signature}` },
  }))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('EMAIL_CC_AUTO_ASSIGN_ENABLED', 'true')
  vi.stubEnv('SERVICE_GROUP_ASSIGNMENT_CUTOVER', 'false')
  vi.stubEnv('ZAMMAD_WEBHOOK_SECRET', secret)
  writes = []
  requests = []
  changeOwnerDuringSearch = false
  ticket = { id: 100, number: '100', title: 'Mail request', customer_id: 1,
    group_id: 9, owner_id: 1, state_id: 1, created_at: createdAt, last_owner_update_at: null }
  db.ticketUpdate.create.mockResolvedValue({ id: 'update-1', createdAt: new Date() })
  db.customerGroupAssignment.findUnique.mockResolvedValue({
    serviceGroup: { id: 1, isActive: true, baseRegion: 'ASIA_PACIFIC', staffZammadId: 2 },
  })
  db.userZammadMapping.findMany.mockResolvedValue([])
  db.notification.findFirst.mockResolvedValue(null)
  db.notification.create.mockResolvedValue({ id: 'notification-1' })
  server.use(
    http.get(`${api}/tickets/100`, () => HttpResponse.json(ticket)),
    http.get(`${api}/ticket_articles/by_ticket/100`, () => HttpResponse.json([firstArticle])),
    http.get(`${api}/users/search`, ({ request }) => {
      requests.push(request.url)
      if (changeOwnerDuringSearch) ticket.owner_id = 20
      const query = new URL(request.url).searchParams.get('query')
      return HttpResponse.json(query === '*' ? [{ id: 20, active: true, role_ids: [1] }] : query === 'engineer@example.com' ? [ccOwner] : [])
    }),
    http.get(`${api}/users/:id`, ({ params }) => HttpResponse.json(
      params.id === '1' ? { id: 1, email: 'customer@example.com' } : fixedOwner,
    )),
    http.put(`${api}/tickets/100`, async ({ request }) => {
      const body = await request.json() as Record<string, unknown>
      writes.push(body)
      Object.assign(ticket, body)
      return HttpResponse.json(ticket)
    }),
  )
})
afterEach(() => vi.unstubAllEnvs())

describe('Signed webhook → original email → owner update → notification', () => {
  it.each([
    ['true', 3],
    ['false', 2],
  ])('routes the first article with a 12-second timestamp gap (CC enabled=%s)', async (enabled, ownerId) => {
    vi.stubEnv('EMAIL_CC_AUTO_ASSIGN_ENABLED', enabled)
    const response = await deliver(webhook())
    expect(response.status).toBe(200)
    expect(writes).toEqual([{ group_id: 4, owner_id: ownerId, state: 'open' }])
    expect(db.customerGroupAssignment.findUnique).toHaveBeenCalledWith({
      where: { customerZammadId: 1 }, include: { serviceGroup: true },
    })
    expect(db.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: `zammad-${ownerId}`, type: 'ticket_assigned' }),
    }))
    expect(requests.length).toBe(enabled === 'true' ? 1 : 0)
  })

  it('does not reassign or duplicate assignment notifications on replay or a follow-up', async () => {
    const original = webhook()
    await deliver(original)
    await deliver(original)
    await deliver(webhook({ ...firstArticle, id: 11, cc: 'fixed@example.com', created_at: '2026-09-08T01:00:00Z' }))
    expect(writes).toHaveLength(1)
    const assignments = db.notification.create.mock.calls.filter(([input]) => input.data.type === 'ticket_assigned')
    expect(assignments).toHaveLength(1)
    expect(ticket.owner_id).toBe(3)
  })

  it('preserves a manual assignment made while the CC account search is in flight', async () => {
    changeOwnerDuringSearch = true
    const response = await deliver(webhook())
    expect(response.status).toBe(200)
    expect(writes).toEqual([])
    expect(ticket.owner_id).toBe(20)
    expect(db.notification.create.mock.calls.filter(([input]) => input.data.type === 'ticket_assigned')).toHaveLength(0)
  })
})


describe('Retryable routing and complete CC parsing regressions', () => {
  it.each(['true', 'false'])('returns 503 on an article read failure and recovers on original webhook retry (CC=%s)', async (enabled) => {
    vi.stubEnv('EMAIL_CC_AUTO_ASSIGN_ENABLED', enabled)
    const original = webhook()
    server.use(http.get(`${api}/ticket_articles/by_ticket/100`, () => HttpResponse.json({ error: 'temporary failure' }, { status: 503 })))
    const failed = await deliver(original)
    expect(failed.status).toBe(503)
    expect(db.ticketUpdate.create).not.toHaveBeenCalled()
    expect(sseEmitter.broadcast).not.toHaveBeenCalled()
    expect(writes).toEqual([])
    expect(db.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'zammad-20', type: 'system_alert' }),
    }))
    server.use(http.get(`${api}/ticket_articles/by_ticket/100`, () => HttpResponse.json([firstArticle])))
    const retried = await deliver(original)
    expect(retried.status).toBe(200)
    expect(db.ticketUpdate.create).toHaveBeenCalledTimes(1)
    expect(sseEmitter.broadcast).toHaveBeenCalledTimes(1)
    expect(writes).toEqual([{ group_id: 4, owner_id: enabled === 'true' ? 3 : 2, state: 'open' }])
    await deliver(original)
    expect(writes).toHaveLength(1)
  })

  it('rechecks remotely committed state after an ambiguous write failure instead of rolling back or writing twice', async () => {
    const original = webhook()
    server.use(http.put(`${api}/tickets/100`, async ({ request }) => {
      const body = await request.json() as Record<string, unknown>
      writes.push(body)
      Object.assign(ticket, body)
      return HttpResponse.json({ error: 'gateway lost response after commit' }, { status: 502 })
    }))
    expect((await deliver(original)).status).toBe(503)
    expect((await deliver(original)).status).toBe(200)
    expect(writes).toHaveLength(1)
    expect(ticket.owner_id).toBe(3)
  })

  it('falls back for a valid RFC group rather than selecting only its last member', async () => {
    server.use(
      http.get(`${api}/ticket_articles/by_ticket/100`, () => HttpResponse.json([{
        ...firstArticle, cc: 'Support: fixed@example.com, engineer@example.com;',
      }])),
      http.get(`${api}/users/search`, ({ request }) => {
        const query = new URL(request.url).searchParams.get('query')
        requests.push(query || '')
        return HttpResponse.json(query === 'fixed@example.com' ? [fixedOwner] : [ccOwner])
      }),
    )
    expect((await deliver(webhook())).status).toBe(200)
    expect(writes).toEqual([{ group_id: 4, owner_id: 2, state: 'open' }])
    expect(requests).toEqual([])
  })
})
