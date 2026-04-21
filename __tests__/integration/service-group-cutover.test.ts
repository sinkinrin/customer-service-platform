import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({
  default: () => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn(() => ({})),
}))

vi.mock('@/lib/env', () => ({
  ensureEnvValidation: vi.fn(),
  isMockAuthEnabled: vi.fn(() => false),
  env: {
    EMAIL_USER_AUTO_PASSWORD_ENABLED: true,
    EMAIL_USER_WELCOME_EMAIL_ENABLED: true,
    WEB_PLATFORM_URL: 'https://support.example.com',
  },
}))

vi.mock('@/lib/mock-auth', () => ({
  mockUsers: {},
  mockPasswords: {},
}))

vi.mock('@/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth')>()
  return {
    ...actual,
    auth: vi.fn(),
  }
})

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
    ticketRating: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    customerGroupAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
    },
  },
}))

const {
  mockAuthenticateUser,
  mockCreateTicket,
  mockGetAgents,
  mockUpdateTicket,
  mockSearchUsersPaginated,
  mockSearchUsersTotalCount,
  mockCreateUser,
} = vi.hoisted(() => ({
  mockAuthenticateUser: vi.fn(),
  mockCreateTicket: vi.fn(),
  mockGetAgents: vi.fn(),
  mockUpdateTicket: vi.fn(),
  mockSearchUsersPaginated: vi.fn(),
  mockSearchUsersTotalCount: vi.fn(),
  mockCreateUser: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    authenticateUser: mockAuthenticateUser,
    createTicket: mockCreateTicket,
    getAgents: mockGetAgents,
    updateTicket: mockUpdateTicket,
    searchUsersPaginated: mockSearchUsersPaginated,
    searchUsersTotalCount: mockSearchUsersTotalCount,
    createUser: mockCreateUser,
  },
}))

const {
  mockFindCustomerServiceGroup,
  mockGetCustomerAssignmentRegion,
  mockListCustomerAssignmentRegions,
  mockAssignCustomerToServiceGroup,
} = vi.hoisted(() => ({
  mockFindCustomerServiceGroup: vi.fn(),
  mockGetCustomerAssignmentRegion: vi.fn(),
  mockListCustomerAssignmentRegions: vi.fn(),
  mockAssignCustomerToServiceGroup: vi.fn(),
}))

vi.mock('@/lib/service-groups/customer-assignment-service', () => ({
  assignCustomerToServiceGroup: mockAssignCustomerToServiceGroup,
  findCustomerServiceGroup: mockFindCustomerServiceGroup,
  getCustomerAssignmentRegion: mockGetCustomerAssignmentRegion,
  listCustomerAssignmentRegions: mockListCustomerAssignmentRegions,
}))

const { mockGetServiceGroup } = vi.hoisted(() => ({
  mockGetServiceGroup: vi.fn(),
}))

vi.mock('@/lib/service-groups/service-group-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/service-groups/service-group-service')>()
  return {
    ...actual,
    getServiceGroup: mockGetServiceGroup,
  }
})

vi.mock('@/lib/zammad/health-check', () => ({
  checkZammadHealth: vi.fn().mockResolvedValue({ isHealthy: true }),
  getZammadUnavailableMessage: vi.fn().mockReturnValue('Zammad is unavailable'),
  isZammadUnavailableError: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/ticket/auto-assign', () => ({
  autoAssignSingleTicket: vi.fn(),
  handleAssignmentNotification: vi.fn().mockResolvedValue(undefined),
  EXCLUDED_EMAILS: ['support@howentech.com', 'howensupport@howentech.com'],
}))

const { mockHandleEmailTicketRouting, mockHandleEmailUserWelcome } = vi.hoisted(() => ({
  mockHandleEmailTicketRouting: vi.fn(),
  mockHandleEmailUserWelcome: vi.fn(),
}))

vi.mock('@/lib/ticket/email-ticket-routing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ticket/email-ticket-routing')>()
  return {
    ...actual,
    handleEmailTicketRoutingFromWebhookPayload: mockHandleEmailTicketRouting,
  }
})

vi.mock('@/lib/ticket/email-user-welcome', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ticket/email-user-welcome')>()
  return {
    ...actual,
    handleEmailUserWelcomeFromWebhookPayload: mockHandleEmailUserWelcome,
  }
})

vi.mock('@/lib/zammad/ensure-user', () => ({
  ensureZammadUser: vi.fn().mockResolvedValue({ id: 100 }),
}))

vi.mock('@/lib/notification', () => ({
  notifyTicketCreated: vi.fn(),
  notifyTicketAssigned: vi.fn(),
  notifyTicketReply: vi.fn(),
  notifyTicketStatusChange: vi.fn(),
  resolveLocalUserIdsForZammadUserId: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/sse/emitter', () => ({
  sseEmitter: {
    broadcast: vi.fn(),
  },
}))

vi.mock('@/lib/utils/cleanup', () => ({
  maybeRunCleanup: vi.fn(),
}))

import { auth } from '@/auth'
import { authenticateWithZammad } from '@/auth'
import { POST as POST_TICKET } from '@/app/api/tickets/route'
import { POST as POST_WEBHOOK } from '@/app/api/webhooks/zammad/route'
import { POST as POST_ADMIN_USER } from '@/app/api/admin/users/route'

describe('service-group cutover smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'cust_001',
        email: 'customer@test.com',
        role: 'customer',
        full_name: 'Customer User',
      },
      expires: new Date(Date.now() + 3600000).toISOString(),
    } as any)
    mockAssignCustomerToServiceGroup.mockResolvedValue({})
    mockGetServiceGroup.mockResolvedValue({
      id: 7,
      name: 'APAC Premium',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 2,
      isActive: true,
    })
    mockGetCustomerAssignmentRegion.mockResolvedValue(undefined)
    mockListCustomerAssignmentRegions.mockResolvedValue(new Map())
    process.env.ZAMMAD_WEBHOOK_SECRET = ''
  })

  it('customer login derives region from assignment rather than note', async () => {
    mockAuthenticateUser.mockResolvedValue({
      id: 101,
      email: 'customer@test.com',
      login: 'customer@test.com',
      firstname: 'Customer',
      lastname: 'User',
      role_ids: [],
      note: 'Region: north-america',
      group_ids: {},
      created_at: '2026-04-16T00:00:00Z',
    })
    mockFindCustomerServiceGroup.mockResolvedValue({
      customerZammadId: 101,
      serviceGroup: {
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
      },
    })

    const user = await authenticateWithZammad('customer@test.com', 'pw')

    expect(user?.region).toBe('asia-pacific')
  })

  it('customer web ticket creation falls into staging when unassigned', async () => {
    mockFindCustomerServiceGroup.mockResolvedValue(null)
    mockCreateTicket.mockResolvedValue({
      id: 1,
      number: '10001',
      title: 'Need help',
    })

    const response = await POST_TICKET(new NextRequest('http://localhost/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Need help',
        article: { subject: 'S', body: 'B' },
      }),
    }))

    expect(response.status).toBe(201)
    expect(mockCreateTicket).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 9 }),
      'customer@test.com'
    )
    expect(mockUpdateTicket).not.toHaveBeenCalled()
  })

  it('webhook entry fans out to email routing and welcome flow', async () => {
    process.env.ZAMMAD_WEBHOOK_SECRET = ''
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

    const response = await POST_WEBHOOK({
      text: async () => JSON.stringify(payload),
      headers: new Headers(),
    } as any)

    expect(response.status).toBe(200)
    expect(mockHandleEmailTicketRouting).toHaveBeenCalledWith(payload, undefined)
    expect(mockHandleEmailUserWelcome).toHaveBeenCalledWith(payload, undefined)
  })

  it('admin create user no longer mints note.Region for customers', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'admin_001',
        email: 'admin@test.com',
        role: 'admin',
        full_name: 'Admin User',
      },
      expires: new Date(Date.now() + 3600000).toISOString(),
    } as any)
    mockCreateUser.mockResolvedValue({ id: 201, email: 'newcustomer@test.com' })

    const response = await POST_ADMIN_USER(new NextRequest('http://localhost/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: 'newcustomer@test.com',
        password: 'password123',
        full_name: 'New Customer',
        role: 'customer',
        serviceGroupId: 7,
      }),
    }))

    expect(response.status).toBe(201)
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.not.objectContaining({
        note: expect.stringContaining('Region:'),
      })
    )
    expect(mockAssignCustomerToServiceGroup).toHaveBeenCalledWith(201, 7, 'admin-create-user:newcustomer@test.com')
  })
})
