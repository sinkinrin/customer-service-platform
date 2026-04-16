import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  env: {},
}))

vi.mock('@/lib/mock-auth', () => ({
  mockUsers: {},
  mockPasswords: {},
}))

const { mockAuthenticateUser } = vi.hoisted(() => ({
  mockAuthenticateUser: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    authenticateUser: mockAuthenticateUser,
  },
}))

const { mockFindCustomerServiceGroup } = vi.hoisted(() => ({
  mockFindCustomerServiceGroup: vi.fn(),
}))

vi.mock('@/lib/service-groups/customer-assignment-service', () => ({
  findCustomerServiceGroup: mockFindCustomerServiceGroup,
}))

import { authenticateWithZammad } from '@/auth'

describe('session region assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('derives customer region from service group assignment instead of note', async () => {
    mockAuthenticateUser.mockResolvedValue({
      id: 101,
      email: 'customer@example.com',
      login: 'customer@example.com',
      firstname: 'Cus',
      lastname: 'Tomer',
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

    const user = await authenticateWithZammad('customer@example.com', 'pw')

    expect(user?.role).toBe('customer')
    expect(user?.region).toBe('asia-pacific')
  })

  it('leaves customer region undefined when no assignment exists', async () => {
    mockAuthenticateUser.mockResolvedValue({
      id: 101,
      email: 'customer@example.com',
      login: 'customer@example.com',
      firstname: 'Cus',
      lastname: 'Tomer',
      role_ids: [],
      note: 'Region: asia-pacific',
      group_ids: {},
      created_at: '2026-04-16T00:00:00Z',
    })
    mockFindCustomerServiceGroup.mockResolvedValue(null)

    const user = await authenticateWithZammad('customer@example.com', 'pw')

    expect(user?.role).toBe('customer')
    expect(user?.region).toBeUndefined()
  })

  it('still derives staff region from group ids', async () => {
    mockAuthenticateUser.mockResolvedValue({
      id: 201,
      email: 'staff@example.com',
      login: 'staff@example.com',
      firstname: 'Sta',
      lastname: 'Ff',
      role_ids: [2],
      note: 'Region: north-america',
      group_ids: { '4': ['full'] },
      created_at: '2026-04-16T00:00:00Z',
    })

    const user = await authenticateWithZammad('staff@example.com', 'pw')

    expect(user?.role).toBe('staff')
    expect(user?.region).toBe('asia-pacific')
  })
})
