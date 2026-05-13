import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockNextAuth } = vi.hoisted(() => ({
  mockNextAuth: vi.fn((config?: unknown) => {
    ;(globalThis as any).__TEST_AUTH_CONFIG__ = config
    return {
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    }
  }),
}))

vi.mock('next-auth', () => ({
  default: mockNextAuth,
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

  it('falls back to staff group ids when no primary region note exists', async () => {
    mockAuthenticateUser.mockResolvedValue({
      id: 201,
      email: 'staff@example.com',
      login: 'staff@example.com',
      firstname: 'Sta',
      lastname: 'Ff',
      role_ids: [2],
      note: '',
      group_ids: { '4': ['full'] },
      created_at: '2026-04-16T00:00:00Z',
    })

    const user = await authenticateWithZammad('staff@example.com', 'pw')

    expect(user?.role).toBe('staff')
    expect(user?.region).toBe('asia-pacific')
  })

  it('only persists full-access staff groups into session permissions', async () => {
    mockAuthenticateUser.mockResolvedValue({
      id: 201,
      email: 'staff@example.com',
      login: 'staff@example.com',
      firstname: 'Sta',
      lastname: 'Ff',
      role_ids: [2],
      note: '',
      group_ids: {
        '4': ['full'],
        '2': ['read'],
        '3': ['overview'],
      },
      created_at: '2026-04-16T00:00:00Z',
    })

    const user = await authenticateWithZammad('staff@example.com', 'pw')

    expect(user?.role).toBe('staff')
    expect(user?.group_ids).toEqual([4])
  })

  it('prefers staff primary region from note over full group iteration order', async () => {
    mockAuthenticateUser.mockResolvedValue({
      id: 201,
      email: 'staff@example.com',
      login: 'staff@example.com',
      firstname: 'Sta',
      lastname: 'Ff',
      role_ids: [2],
      note: 'Region: asia-pacific',
      group_ids: {
        '2': ['full'],
        '4': ['full'],
      },
      created_at: '2026-04-16T00:00:00Z',
    })

    const user = await authenticateWithZammad('staff@example.com', 'pw')

    expect(user?.role).toBe('staff')
    expect(user?.region).toBe('asia-pacific')
  })

  it('persists customer identity and region into JWT on sign-in', async () => {
    const authConfig = (globalThis as any).__TEST_AUTH_CONFIG__
    const token = await authConfig.callbacks.jwt({
      token: {},
      user: {
        id: 'zammad-101',
        email: 'customer@example.com',
        role: 'customer',
        full_name: 'Customer',
        region: 'asia-pacific',
        zammad_id: 101,
        group_ids: [],
      },
    })

    expect(token.id).toBe('zammad-101')
    expect(token.email).toBe('customer@example.com')
    expect(token.zammad_id).toBe(101)
    expect(token.region).toBe('asia-pacific')
  })

  it('does not query service-group assignment during token-only JWT callback', async () => {
    const authConfig = (globalThis as any).__TEST_AUTH_CONFIG__
    const token = await authConfig.callbacks.jwt({
      token: {
        role: 'customer',
        zammad_id: 101,
        region: 'north-america',
      },
    })

    expect(mockFindCustomerServiceGroup).not.toHaveBeenCalled()
    expect(token.region).toBe('north-america')
  })
})
