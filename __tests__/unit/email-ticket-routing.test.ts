import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleEmailTicketRoutingFromWebhookPayload as route } from '@/lib/ticket/email-ticket-routing'
import type { ZammadArticle, ZammadTicket, ZammadUser, ZammadWebhookPayload } from '@/lib/zammad/types'

const mocks = vi.hoisted(() => ({
  getTicket: vi.fn(), getArticlesByTicket: vi.fn(), getUser: vi.fn(),
  updateTicket: vi.fn(), searchUsers: vi.fn(), searchUsersPaginated: vi.fn(),
  notify: vi.fn(), notifyAdmin: vi.fn(), resolveIds: vi.fn(), assignment: vi.fn(),
}))
vi.mock('@/lib/zammad/client', () => ({ zammadClient: mocks }))
vi.mock('@/lib/ticket/auto-assign', () => ({
  handleAssignmentNotification: mocks.notify,
  EXCLUDED_EMAILS: ['support@howentech.com', 'howensupport@howentech.com'],
}))
vi.mock('@/lib/notification', () => ({
  notifySystemAlert: mocks.notifyAdmin,
  resolveLocalUserIdsForZammadUserId: mocks.resolveIds,
}))
vi.mock('@/lib/service-groups/customer-assignment-service', () => ({ findCustomerServiceGroup: mocks.assignment }))

let ticket: ZammadTicket
let article: ZammadArticle
let fixedOwner: ZammadUser
let ccOwner: ZammadUser
const payload = (): ZammadWebhookPayload => ({
  ticket: { ...ticket }, article: { id: 10, type: 'email' },
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SERVICE_GROUP_ASSIGNMENT_CUTOVER', 'false')
  vi.stubEnv('EMAIL_CC_AUTO_ASSIGN_ENABLED', 'true')
  ticket = { id: 100, group_id: 9, customer_id: 1, owner_id: 1, state_id: 1,
    number: '100', title: 'Help', last_owner_update_at: null } as ZammadTicket
  article = { id: 10, ticket_id: 100, type: 'email', sender: 'Customer', internal: false, cc: null } as ZammadArticle
  fixedOwner = { id: 2, email: 'fixed@example.com', firstname: 'Fixed', lastname: 'Owner',
    active: true, role_ids: [2], group_ids: { '4': ['full'] }, out_of_office: false } as ZammadUser
  ccOwner = { ...fixedOwner, id: 3, email: 'engineer@example.com', firstname: 'Cc' }
  mocks.getTicket.mockImplementation(async () => ({ ...ticket }))
  mocks.getArticlesByTicket.mockImplementation(async () => [article])
  mocks.getUser.mockImplementation(async (id: number) => id === 1 ? { id: 1, email: 'customer@example.com' } : fixedOwner)
  mocks.assignment.mockResolvedValue({ serviceGroup: { baseRegion: 'ASIA_PACIFIC', staffZammadId: 2 } })
  mocks.searchUsersPaginated.mockImplementation(async (email: string) => email === ccOwner.email.toLowerCase() ? [ccOwner] : [])
  mocks.searchUsers.mockResolvedValue([{ id: 20, role_ids: [1], active: true }])
  mocks.resolveIds.mockResolvedValue(['admin-local'])
  mocks.updateTicket.mockImplementation(async (_id: number, data: Partial<ZammadTicket>) => {
    ticket = { ...ticket, ...data }
    return ticket
  })
})
afterEach(() => vi.unstubAllEnvs())

describe('Email CC and service-group routing', () => {
  it('keeps the existing service-group owner when CC is absent, with one atomic update', async () => {
    await route(payload())
    expect(mocks.updateTicket).toHaveBeenCalledExactlyOnceWith(100, { group_id: 4, owner_id: 2, state: 'open' })
    expect(mocks.searchUsersPaginated).not.toHaveBeenCalled()
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, assignedTo: expect.objectContaining({ id: 2 }) }),
      100, '100', 'Help', 'asia-pacific', undefined)
  })

  it.each(['false', ''])('uses the service-group owner when CC auto-assignment is %j', async (value) => {
    vi.stubEnv('EMAIL_CC_AUTO_ASSIGN_ENABLED', value)
    article.cc = ccOwner.email
    await route(payload())
    expect(mocks.searchUsersPaginated).not.toHaveBeenCalled()
    expect(mocks.updateTicket).toHaveBeenCalledExactlyOnceWith(100, { group_id: 4, owner_id: 2, state: 'open' })
  })

  it('falls back to the service-group owner if the CC switch is disabled during lookup', async () => {
    article.cc = ccOwner.email
    mocks.searchUsersPaginated.mockImplementation(async () => {
      vi.stubEnv('EMAIL_CC_AUTO_ASSIGN_ENABLED', 'false')
      return [ccOwner]
    })
    await route(payload())
    expect(mocks.updateTicket).toHaveBeenCalledExactlyOnceWith(100, { group_id: 4, owner_id: 2, state: 'open' })
  })

  it('abandons a CC write if the switch is disabled during the final ticket read', async () => {
    article.cc = ccOwner.email
    mocks.getTicket.mockImplementationOnce(async () => ({ ...ticket })).mockImplementationOnce(async () => {
      vi.stubEnv('EMAIL_CC_AUTO_ASSIGN_ENABLED', 'false')
      return { ...ticket }
    })
    await route(payload())
    expect(mocks.updateTicket).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('uses actual article CC ahead of the fixed owner even when webhook CC is missing or wrong', async () => {
    article.cc = '"Engineer, Support" <ENGINEER@example.com>, external@example.com'
    await route({ ...payload(), article: { id: 10, type: 'email', cc: 'fixed@example.com' } })
    expect(mocks.updateTicket).toHaveBeenCalledExactlyOnceWith(100, { group_id: 4, owner_id: 3, state: 'open' })
    expect(mocks.getUser).not.toHaveBeenCalledWith(2)
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ assignedTo: expect.objectContaining({ id: 3 }) }),
      100, '100', 'Help', 'asia-pacific', undefined)
  })

  it('deduplicates repeated addresses and compares account email case-insensitively', async () => {
    ccOwner.email = 'Engineer@Example.com'
    article.cc = 'Engineer <ENGINEER@example.com>; engineer@example.com'
    await route(payload())
    expect(mocks.searchUsersPaginated).toHaveBeenCalledTimes(1)
    expect(mocks.updateTicket).toHaveBeenCalledWith(100, expect.objectContaining({ owner_id: 3 }))
  })

  it('checks subsequent search pages instead of missing an exact account match', async () => {
    article.cc = 'engineer@example.com'
    mocks.searchUsersPaginated.mockResolvedValueOnce(Array.from({ length: 100 }, (_, id) => ({ ...ccOwner, id, email: `other${id}@example.com` })))
      .mockResolvedValueOnce([ccOwner])
    await route(payload())
    expect(mocks.searchUsersPaginated).toHaveBeenNthCalledWith(2, 'engineer@example.com', 100, 2)
    expect(mocks.updateTicket).toHaveBeenCalledWith(100, expect.objectContaining({ owner_id: 3 }))
  })

  it('falls back when multiple eligible agents are copied', async () => {
    article.cc = 'engineer@example.com, fixed@example.com'
    mocks.searchUsersPaginated.mockImplementation(async (email: string) => email === fixedOwner.email ? [fixedOwner] : [ccOwner])
    await route(payload())
    expect(mocks.updateTicket).toHaveBeenCalledWith(100, expect.objectContaining({ owner_id: 2 }))
  })

  it.each([
    ['inactive', { active: false }],
    ['customer role', { role_ids: [3] }],
    ['administrator', { role_ids: [1, 2] }],
    ['another region', { group_ids: { '5': ['full'] } }],
    ['read-only group', { group_ids: { '4': ['read'] } }],
    ['vacation', { out_of_office: true, out_of_office_start_at: '2000-01-01' }],
    ['system account', { email: 'support@howentech.com' }],
  ])('falls back for a copied %s account', async (_label, overrides) => {
    Object.assign(ccOwner, overrides)
    article.cc = ccOwner.email
    await route(payload())
    expect(mocks.updateTicket).toHaveBeenCalledWith(100, expect.objectContaining({ owner_id: 2 }))
  })

  it('does not assign by display name or an inexact search result', async () => {
    article.cc = '"engineer@example.com" <external@example.com>'
    mocks.searchUsersPaginated.mockResolvedValue([ccOwner])
    await route(payload())
    expect(mocks.updateTicket).toHaveBeenCalledWith(100, expect.objectContaining({ owner_id: 2 }))
  })

  it('preserves fallback if the CC search fails', async () => {
    article.cc = ccOwner.email
    mocks.searchUsersPaginated.mockRejectedValue(new Error('Search unavailable'))
    await route(payload())
    expect(mocks.updateTicket).toHaveBeenCalledWith(100, expect.objectContaining({ owner_id: 2 }))
  })

  it('can assign CC even when the fixed owner is unavailable', async () => {
    article.cc = ccOwner.email
    fixedOwner.active = false
    await route(payload())
    expect(mocks.updateTicket).toHaveBeenCalledWith(100, expect.objectContaining({ owner_id: 3 }))
  })

  it('keeps staging and alerts admin when no service group exists, even with a valid CC', async () => {
    article.cc = ccOwner.email
    mocks.assignment.mockResolvedValue(null)
    await route(payload())
    expect(mocks.updateTicket).not.toHaveBeenCalled()
    expect(mocks.notifyAdmin).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('客户未分配服务分组') }))
  })

  it('keeps staging and alerts admin if neither CC nor the fixed owner is available', async () => {
    fixedOwner.active = false
    await route(payload())
    expect(mocks.updateTicket).not.toHaveBeenCalled()
    expect(mocks.notifyAdmin).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('负责人不可用') }))
  })

  it.each([
    ['assigned', { owner_id: 8 }],
    ['already routed', { group_id: 4 }],
    ['closed', { state_id: 4 }],
    ['pending', { state_id: 3 }],
  ])('ignores a stale webhook when the actual ticket is %s', async (_label, overrides) => {
    const event = payload()
    Object.assign(ticket, overrides)
    await route(event)
    expect(mocks.updateTicket).not.toHaveBeenCalled()
  })

  it.each([
    ['manual assignment', { owner_id: 8 }],
    ['service-group migration', { group_id: 5, owner_id: 9 }],
    ['changed customer', { customer_id: 9 }],
    ['assign then unassign', { last_owner_update_at: '2026-09-08T00:00:00Z' }],
  ])('respects %s performed during recipient lookup', async (_label, overrides) => {
    mocks.getTicket.mockResolvedValueOnce({ ...ticket }).mockResolvedValueOnce({ ...ticket, ...overrides })
    await route(payload())
    expect(mocks.updateTicket).not.toHaveBeenCalled()
  })

  it('ignores follow-up CC even when a fast reply looks like ticket creation', async () => {
    mocks.getArticlesByTicket.mockResolvedValue([{ ...article, id: 11, cc: ccOwner.email }, article])
    await route({ ...payload(), article: { id: 11, type: 'email' } })
    expect(mocks.updateTicket).not.toHaveBeenCalled()
  })

  it.each(['System', 'Agent'])('ignores first articles sent by %s', async (sender) => {
    article.sender = sender
    await route(payload())
    expect(mocks.updateTicket).not.toHaveBeenCalled()
  })

  it('ignores a web-origin ticket and internal articles', async () => {
    article.type = 'web'
    await route(payload())
    article.type = 'email'
    article.internal = true
    await route(payload())
    expect(mocks.updateTicket).not.toHaveBeenCalled()
  })

  it.each(['initial ticket', 'original article', 'customer', 'service group', 'fixed owner', 'final ticket'])
    ('returns a retryable result and alerts admins on a failed %s read', async (stage) => {
      const error = new Error('Unavailable')
      if (stage === 'initial ticket') mocks.getTicket.mockRejectedValueOnce(error)
      if (stage === 'original article') mocks.getArticlesByTicket.mockRejectedValueOnce(error)
      if (stage === 'customer') mocks.getUser.mockRejectedValueOnce(error)
      if (stage === 'service group') mocks.assignment.mockRejectedValueOnce(error)
      if (stage === 'fixed owner') mocks.getUser.mockResolvedValueOnce({ id: 1, email: 'customer@example.com' }).mockRejectedValueOnce(error)
      if (stage === 'final ticket') mocks.getTicket.mockResolvedValueOnce({ ...ticket }).mockRejectedValueOnce(error)
      expect(await route(payload())).toEqual({ retryable: true })
      expect(mocks.updateTicket).not.toHaveBeenCalled()
      expect(mocks.notifyAdmin).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('等待 Webhook 重试'),
      }))
    })

  it('retries an empty original-article response instead of acknowledging lost work', async () => {
    mocks.getArticlesByTicket.mockResolvedValue([])
    expect(await route(payload())).toEqual({ retryable: true })
    expect(mocks.updateTicket).not.toHaveBeenCalled()
  })

  it('keeps retryable status even when the admin alert lookup fails too', async () => {
    mocks.getArticlesByTicket.mockRejectedValue(new Error('Unavailable'))
    mocks.searchUsers.mockRejectedValue(new Error('Unavailable'))
    expect(await route(payload())).toEqual({ retryable: true })
  })

  it('honors cutover before and during lookup', async () => {
    vi.stubEnv('SERVICE_GROUP_ASSIGNMENT_CUTOVER', 'true')
    await route(payload())
    expect(mocks.getTicket).not.toHaveBeenCalled()
    vi.stubEnv('SERVICE_GROUP_ASSIGNMENT_CUTOVER', 'false')
    mocks.assignment.mockImplementation(async () => {
      vi.stubEnv('SERVICE_GROUP_ASSIGNMENT_CUTOVER', 'true')
      return { serviceGroup: { baseRegion: 'ASIA_PACIFIC', staffZammadId: 2 } }
    })
    await route(payload())
    expect(mocks.updateTicket).not.toHaveBeenCalled()
  })

  it('does not reassign or notify twice on concurrent/replayed callbacks', async () => {
    const event = payload()
    await Promise.all([route(event), route(event)])
    await route(event)
    expect(mocks.updateTicket).toHaveBeenCalledTimes(1)
    expect(mocks.notify).toHaveBeenCalledTimes(1)
  })

  it('does not lose the first article callback when a system reply callback arrives first', async () => {
    await Promise.all([route({ ...payload(), article: { id: 11, type: 'email' } }), route(payload())])
    expect(mocks.updateTicket).toHaveBeenCalledTimes(1)
  })

  it('alerts on write failure without issuing a destructive rollback', async () => {
    mocks.updateTicket.mockRejectedValue(new Error('Request timeout'))
    expect(await route(payload())).toEqual({ retryable: true })
    expect(mocks.updateTicket).toHaveBeenCalledTimes(1)
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(mocks.notifyAdmin).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('负责人分配失败') }))
  })
})
