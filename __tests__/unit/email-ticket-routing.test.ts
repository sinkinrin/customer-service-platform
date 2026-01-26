import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleEmailTicketRoutingFromWebhookPayload } from '@/lib/ticket/email-ticket-routing'
import { STAGING_GROUP_ID } from '@/lib/constants/regions'
import { ZAMMAD_ROLES } from '@/lib/constants/zammad'

const {
  mockGetUser,
  mockUpdateTicket,
  mockSearchUsers,
  mockAutoAssignSingleTicket,
  mockHandleAssignmentNotification,
  mockResolveLocalUserIdsForZammadUserId,
  mockNotifySystemAlert,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateTicket: vi.fn(),
  mockSearchUsers: vi.fn(),
  mockAutoAssignSingleTicket: vi.fn(),
  mockHandleAssignmentNotification: vi.fn(),
  mockResolveLocalUserIdsForZammadUserId: vi.fn(),
  mockNotifySystemAlert: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getUser: mockGetUser,
    updateTicket: mockUpdateTicket,
    searchUsers: mockSearchUsers,
  },
}))

vi.mock('@/lib/ticket/auto-assign', () => ({
  autoAssignSingleTicket: mockAutoAssignSingleTicket,
  handleAssignmentNotification: mockHandleAssignmentNotification,
}))

vi.mock('@/lib/notification', () => ({
  notifySystemAlert: mockNotifySystemAlert,
  resolveLocalUserIdsForZammadUserId: mockResolveLocalUserIdsForZammadUserId,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Email ticket routing', () => {
  it('skips when ticket is not in staging group', async () => {
    await handleEmailTicketRoutingFromWebhookPayload({
      ticket: { id: 100, group_id: STAGING_GROUP_ID + 1, customer_id: 1, number: '100', title: 'T' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockUpdateTicket).not.toHaveBeenCalled()
  })

  it('skips when article.type is not email', async () => {
    await handleEmailTicketRoutingFromWebhookPayload({
      ticket: { id: 100, group_id: STAGING_GROUP_ID, customer_id: 1, number: '100', title: 'T' },
      article: { id: 1, type: 'web' },
    } as any)

    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockUpdateTicket).not.toHaveBeenCalled()
  })

  it('routes to regional group and triggers auto-assign', async () => {
    mockGetUser.mockResolvedValue({ id: 1, email: 'customer@example.com', note: 'Region: asia-pacific' })
    mockUpdateTicket.mockResolvedValue({ id: 100 })
    mockAutoAssignSingleTicket.mockResolvedValue({
      success: true,
      assignedTo: { id: 2, name: 'Agent', email: 'agent@example.com' },
    })
    mockHandleAssignmentNotification.mockResolvedValue(undefined)

    await handleEmailTicketRoutingFromWebhookPayload({
      ticket: { id: 100, group_id: STAGING_GROUP_ID, customer_id: 1, number: '100', title: 'Help' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateTicket).toHaveBeenCalledWith(100, { group_id: 4 })
    expect(mockAutoAssignSingleTicket).toHaveBeenCalledWith(100, '100', 'Help', 4, undefined)
    expect(mockHandleAssignmentNotification).not.toHaveBeenCalled()
  })

  it('notifies admins when customer has no region', async () => {
    mockGetUser.mockResolvedValue({ id: 1, email: 'customer@example.com', note: '' })
    mockSearchUsers.mockResolvedValue([{ id: 10, role_ids: [ZAMMAD_ROLES.ADMIN], active: true }])
    mockResolveLocalUserIdsForZammadUserId.mockResolvedValue(['admin-local-1'])
    mockNotifySystemAlert.mockResolvedValue(undefined)

    await handleEmailTicketRoutingFromWebhookPayload({
      ticket: { id: 100, group_id: STAGING_GROUP_ID, customer_id: 1, number: '100', title: 'Help' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateTicket).not.toHaveBeenCalled()
    expect(mockNotifySystemAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'admin-local-1',
        title: '邮件工单未自动路由',
      })
    )
  })

  it('notifies admins when region value is invalid', async () => {
    mockGetUser.mockResolvedValue({ id: 1, email: 'customer@example.com', note: 'Region: unknown-region' })
    mockSearchUsers.mockResolvedValue([{ id: 10, role_ids: [ZAMMAD_ROLES.ADMIN], active: true }])
    mockResolveLocalUserIdsForZammadUserId.mockResolvedValue(['admin-local-1'])
    mockNotifySystemAlert.mockResolvedValue(undefined)

    await handleEmailTicketRoutingFromWebhookPayload({
      ticket: { id: 100, group_id: STAGING_GROUP_ID, customer_id: 1, number: '100', title: 'Help' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateTicket).not.toHaveBeenCalled()
    expect(mockNotifySystemAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'admin-local-1',
        body: expect.stringContaining('unknown-region'),
      })
    )
  })
})
