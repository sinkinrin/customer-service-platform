import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/mock-auth', () => ({
  mockUsers: {},
  mockPasswords: {},
}))

vi.mock('@/lib/service-groups/customer-assignment-service', () => ({
  findCustomerServiceGroup: vi.fn(),
  getCustomerAssignmentRegion: vi.fn(),
  listCustomerAssignmentRegions: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    createUser: vi.fn(),
    getUser: vi.fn(),
    searchUsersPaginated: vi.fn(),
    searchUsersTotalCount: vi.fn(),
    updateUser: vi.fn(),
  },
}))

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'
import { mockUsers } from '@/lib/mock-auth'
import {
  getCustomerAssignmentRegion,
  listCustomerAssignmentRegions,
} from '@/lib/service-groups/customer-assignment-service'
import { GET as GET_USERS, POST as POST_USERS } from '@/app/api/admin/users/route'
import { GET as GET_USER, PUT as PUT_USER } from '@/app/api/admin/users/[id]/route'
import { POST as POST_IMPORT } from '@/app/api/admin/users/import/route'
import { GET as GET_EXPORT } from '@/app/api/admin/users/export/route'

const mockAdmin = {
  id: 'admin_001',
  email: 'admin@test.com',
  role: 'admin' as const,
  full_name: 'Test Admin',
  region: 'asia-pacific',
}

function createJsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function createImportRequest(csv: string) {
  const formData = new FormData()
  formData.append('file', new File([csv], 'users.csv', { type: 'text/csv' }))
  formData.append('preview', 'false')
  return new NextRequest('http://localhost/api/admin/users/import', {
    method: 'POST',
    body: formData,
  })
}

describe('admin users region deprecation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: mockAdmin,
      expires: new Date(Date.now() + 3600000).toISOString(),
    } as any)
    vi.mocked(zammadClient.searchUsersPaginated).mockResolvedValue([] as any)
    vi.mocked(zammadClient.searchUsersTotalCount).mockResolvedValue(0)
    vi.mocked(getCustomerAssignmentRegion).mockResolvedValue(undefined)
    vi.mocked(listCustomerAssignmentRegions).mockResolvedValue(new Map())
    Object.keys(mockUsers).forEach((key) => delete (mockUsers as Record<string, unknown>)[key])
  })

  it('lists customer region from service-group assignment instead of note', async () => {
    vi.mocked(zammadClient.searchUsersPaginated).mockResolvedValue([
      {
        id: 101,
        email: 'customer@test.com',
        firstname: 'Cus',
        lastname: 'Tomer',
        login: 'customer@test.com',
        active: true,
        verified: true,
        role_ids: [],
        note: 'Region: north-america',
        group_ids: {},
        created_at: '2026-04-16T00:00:00Z',
      },
    ] as any)
    vi.mocked(zammadClient.searchUsersTotalCount).mockResolvedValue(1)
    vi.mocked(listCustomerAssignmentRegions).mockResolvedValue(
      new Map([[101, 'asia-pacific']])
    )

    const response = await GET_USERS(new NextRequest('http://localhost/api/admin/users'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.users[0].region).toBe('asia-pacific')
  })

  it('returns customer detail region from service-group assignment instead of note', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 101,
      email: 'customer@test.com',
      firstname: 'Cus',
      lastname: 'Tomer',
      login: 'customer@test.com',
      active: true,
      verified: true,
      role_ids: [],
      note: 'Region: north-america',
      group_ids: {},
      created_at: '2026-04-16T00:00:00Z',
      updated_at: '2026-04-16T00:00:00Z',
    } as any)
    vi.mocked(getCustomerAssignmentRegion).mockResolvedValue('asia-pacific')

    const response = await GET_USER(new NextRequest('http://localhost/api/admin/users/101'), {
      params: Promise.resolve({ id: '101' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.user.region).toBe('asia-pacific')
  })

  it('does not write customer region into note on standard create flow', async () => {
    vi.mocked(zammadClient.createUser).mockResolvedValue({ id: 101, email: 'customer@test.com' } as any)

    const response = await POST_USERS(createJsonRequest('http://localhost/api/admin/users', 'POST', {
      email: 'customer@test.com',
      password: 'password123',
      full_name: 'Customer User',
      role: 'customer',
      region: 'asia-pacific',
    }))

    expect(response.status).toBe(201)
    expect(zammadClient.createUser).toHaveBeenCalledWith(
      expect.not.objectContaining({
        note: expect.stringContaining('Region:'),
      })
    )
  })

  it('does not write customer region into note on update flow', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 101,
      email: 'customer@test.com',
      firstname: 'Cus',
      lastname: 'Tomer',
      login: 'customer@test.com',
      active: true,
      verified: true,
      role_ids: [],
      note: 'Region: north-america',
      group_ids: {},
      created_at: '2026-04-16T00:00:00Z',
      updated_at: '2026-04-16T00:00:00Z',
    } as any)
    vi.mocked(zammadClient.updateUser).mockResolvedValue({
      id: 101,
      email: 'customer@test.com',
      firstname: 'Cus',
      lastname: 'Tomer',
      active: true,
      note: 'Region: north-america',
      group_ids: {},
      updated_at: '2026-04-16T00:00:00Z',
    } as any)
    vi.mocked(getCustomerAssignmentRegion).mockResolvedValue(undefined)

    const response = await PUT_USER(createJsonRequest('http://localhost/api/admin/users/101', 'PUT', {
      region: 'asia-pacific',
    }), {
      params: Promise.resolve({ id: '101' }),
    })

    expect(response.status).toBe(200)
    expect(zammadClient.updateUser).toHaveBeenCalledWith(
      101,
      expect.not.objectContaining({
        note: expect.stringContaining('Region:'),
      })
    )
  })

  it('does not write customer region into note during import flow', async () => {
    vi.mocked(zammadClient.createUser).mockResolvedValue({ id: 101, email: 'customer@test.com' } as any)

    const response = await POST_IMPORT(createImportRequest(
      'email,full_name,role,region\ncustomer@test.com,Customer User,customer,asia-pacific'
    ))

    expect(response.status).toBe(200)
    expect(zammadClient.createUser).toHaveBeenCalledWith(
      expect.not.objectContaining({
        note: expect.stringContaining('Region:'),
      })
    )
  })

  it('exports customer region from service-group assignment instead of note', async () => {
    vi.mocked(zammadClient.searchUsersPaginated).mockResolvedValue([
      {
        id: 101,
        email: 'customer@test.com',
        firstname: 'Cus',
        lastname: 'Tomer',
        active: true,
        verified: true,
        role_ids: [],
        note: 'Region: north-america',
        group_ids: {},
        created_at: '2026-04-16T00:00:00Z',
        last_login: '',
      },
    ] as any)
    vi.mocked(getCustomerAssignmentRegion).mockResolvedValue('asia-pacific')

    const response = await GET_EXPORT(new NextRequest('http://localhost/api/admin/users/export'))
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(csv).toContain('asia-pacific')
    expect(csv).not.toContain('north-america')
  })
})
