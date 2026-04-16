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
  mockFindCustomerServiceGroup,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateTicket: vi.fn(),
  mockSearchUsers: vi.fn(),
  mockAutoAssignSingleTicket: vi.fn(),
  mockHandleAssignmentNotification: vi.fn(),
  mockResolveLocalUserIdsForZammadUserId: vi.fn(),
  mockNotifySystemAlert: vi.fn(),
  mockFindCustomerServiceGroup: vi.fn(),
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
  EXCLUDED_EMAILS: ['support@howentech.com', 'howensupport@howentech.com'],
}))

vi.mock('@/lib/notification', () => ({
  notifySystemAlert: mockNotifySystemAlert,
  resolveLocalUserIdsForZammadUserId: mockResolveLocalUserIdsForZammadUserId,
}))

vi.mock('@/lib/service-groups/customer-assignment-service', () => ({
  findCustomerServiceGroup: mockFindCustomerServiceGroup,
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

  it('routes by customer assignment and assigns the fixed owner directly', async () => {
    mockFindCustomerServiceGroup.mockResolvedValue({
      customerZammadId: 1,
      serviceGroup: {
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 2,
      },
    })
    mockGetUser.mockResolvedValueOnce({ id: 1, email: 'customer@example.com', note: 'Region: invalid-region' })
    mockGetUser.mockResolvedValueOnce({
        id: 2,
        email: 'agent@example.com',
        firstname: 'Fixed',
        lastname: 'Owner',
        active: true,
        role_ids: [2],
        group_ids: { '4': ['full'] },
        out_of_office: false,
      })
    mockUpdateTicket.mockResolvedValue({ id: 100 })
    mockHandleAssignmentNotification.mockResolvedValue(undefined)

    await handleEmailTicketRoutingFromWebhookPayload({
      ticket: { id: 100, group_id: STAGING_GROUP_ID, customer_id: 1, number: '100', title: 'Help' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateTicket).toHaveBeenNthCalledWith(1, 100, { group_id: 4 })
    expect(mockUpdateTicket).toHaveBeenNthCalledWith(2, 100, { owner_id: 2, state: 'open' })
    expect(mockAutoAssignSingleTicket).not.toHaveBeenCalled()
    expect(mockHandleAssignmentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        assignedTo: expect.objectContaining({ id: 2, name: 'Fixed Owner' }),
      }),
      100,
      '100',
      'Help',
      'asia-pacific',
      undefined
    )
  })

  it('keeps ticket in staging and notifies admins when customer has no assignment', async () => {
    mockFindCustomerServiceGroup.mockResolvedValue(null)
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

  it('keeps ticket in staging and notifies admins when assigned owner is unavailable', async () => {
    mockFindCustomerServiceGroup.mockResolvedValue({
      customerZammadId: 1,
      serviceGroup: {
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 2,
      },
    })
    mockGetUser.mockResolvedValueOnce({ id: 1, email: 'customer@example.com', note: 'Region: asia-pacific' })
    mockGetUser.mockResolvedValueOnce({
        id: 2,
        email: 'agent@example.com',
        firstname: 'Fixed',
        lastname: 'Owner',
        active: false,
        role_ids: [2],
        group_ids: { '4': ['full'] },
        out_of_office: false,
      })
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
        body: expect.stringContaining('负责人不可用'),
      })
    )
  })
})
