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
  assignCustomerToServiceGroup: vi.fn(),
  findCustomerServiceGroup: vi.fn(),
  getCustomerAssignmentRegion: vi.fn(),
  listCustomerAssignmentRegions: vi.fn(),
}))

vi.mock('@/lib/service-groups/service-group-service', () => ({
  getServiceGroup: vi.fn(),
  getServiceGroupByName: vi.fn(),
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
  assignCustomerToServiceGroup,
  findCustomerServiceGroup,
  getCustomerAssignmentRegion,
  listCustomerAssignmentRegions,
} from '@/lib/service-groups/customer-assignment-service'
import { getServiceGroup, getServiceGroupByName } from '@/lib/service-groups/service-group-service'
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
    vi.mocked(findCustomerServiceGroup).mockResolvedValue(null)
    vi.mocked(assignCustomerToServiceGroup).mockResolvedValue({} as any)
    vi.mocked(getServiceGroup).mockResolvedValue({
      id: 7,
      name: 'APAC Premium',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 2,
      isActive: true,
    } as any)
    vi.mocked(getServiceGroupByName).mockResolvedValue({
      id: 7,
      name: 'APAC Premium',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 2,
      isActive: true,
    } as any)
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

  it('returns customer detail service-group owner name from Zammad', async () => {
    vi.mocked(zammadClient.getUser)
      .mockResolvedValueOnce({
        id: 101,
        email: 'customer@test.com',
        firstname: 'Cus',
        lastname: 'Tomer',
        login: 'customer@test.com',
        active: true,
        verified: true,
        role_ids: [],
        note: '',
        group_ids: {},
        created_at: '2026-04-16T00:00:00Z',
        updated_at: '2026-04-16T00:00:00Z',
      } as any)
      .mockResolvedValueOnce({
        id: 222,
        email: 'owner@test.com',
        firstname: 'Agent',
        lastname: 'One',
        login: 'owner@test.com',
        active: true,
      } as any)
    vi.mocked(getCustomerAssignmentRegion).mockResolvedValue('asia-pacific')
    vi.mocked(findCustomerServiceGroup).mockResolvedValue({
      customerZammadId: 101,
      serviceGroup: {
        id: 1,
        name: '亚太 1',
        staffZammadId: 222,
      },
    } as any)

    const response = await GET_USER(new NextRequest('http://localhost/api/admin/users/101'), {
      params: Promise.resolve({ id: '101' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.user.service_group).toEqual({
      id: 1,
      name: '亚太 1',
      owner_name: 'Agent One',
    })
  })

  it('lists staff primary region from note instead of full group iteration order', async () => {
    vi.mocked(zammadClient.searchUsersPaginated).mockResolvedValue([
      {
        id: 201,
        email: 'staff@test.com',
        firstname: 'Sta',
        lastname: 'Ff',
        login: 'staff@test.com',
        active: true,
        verified: true,
        role_ids: [2],
        note: 'Region: asia-pacific',
        group_ids: {
          '2': ['full'],
          '4': ['full'],
        },
        created_at: '2026-04-16T00:00:00Z',
      },
    ] as any)
    vi.mocked(zammadClient.searchUsersTotalCount).mockResolvedValue(1)

    const response = await GET_USERS(new NextRequest('http://localhost/api/admin/users'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.users[0].region).toBe('asia-pacific')
  })

  it('returns staff detail region from note instead of full group iteration order', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 201,
      email: 'staff@test.com',
      firstname: 'Sta',
      lastname: 'Ff',
      login: 'staff@test.com',
      active: true,
      verified: true,
      role_ids: [2],
      note: 'Region: asia-pacific',
      group_ids: {
        '2': ['full'],
        '4': ['full'],
      },
      created_at: '2026-04-16T00:00:00Z',
      updated_at: '2026-04-16T00:00:00Z',
    } as any)

    const response = await GET_USER(new NextRequest('http://localhost/api/admin/users/201'), {
      params: Promise.resolve({ id: '201' }),
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
      serviceGroupId: 7,
    }))

    expect(response.status).toBe(201)
    expect(zammadClient.createUser).toHaveBeenCalledWith(
      expect.not.objectContaining({
        note: expect.stringContaining('Region:'),
      })
    )
    expect(assignCustomerToServiceGroup).toHaveBeenCalledWith(101, 7, 'admin-create-user:customer@test.com')
  })

  it('accepts customer create flow without region when service group is provided', async () => {
    vi.mocked(zammadClient.createUser).mockResolvedValue({ id: 101, email: 'customer@test.com' } as any)

    const response = await POST_USERS(createJsonRequest('http://localhost/api/admin/users', 'POST', {
      email: 'customer@test.com',
      password: 'password123',
      full_name: 'Customer User',
      role: 'customer',
      serviceGroupId: 7,
    }))

    expect(response.status).toBe(201)
    expect(zammadClient.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@test.com',
        roles: ['Customer'],
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

  it('does not overwrite existing full group access when staff region is unchanged', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 201,
      email: 'staff@test.com',
      firstname: 'Sta',
      lastname: 'Ff',
      login: 'staff@test.com',
      active: true,
      verified: true,
      role_ids: [2],
      note: 'Region: asia-pacific',
      group_ids: {
        '4': ['full'],
        '2': ['full'],
      },
      created_at: '2026-04-16T00:00:00Z',
      updated_at: '2026-04-16T00:00:00Z',
    } as any)
    vi.mocked(zammadClient.updateUser).mockResolvedValue({
      id: 201,
      email: 'staff@test.com',
      firstname: 'Sta Updated',
      lastname: 'Ff',
      active: true,
      note: 'Region: asia-pacific',
      group_ids: {
        '4': ['full'],
        '2': ['full'],
      },
      updated_at: '2026-04-16T00:00:00Z',
    } as any)

    const response = await PUT_USER(createJsonRequest('http://localhost/api/admin/users/201', 'PUT', {
      firstname: 'Sta Updated',
      region: 'asia-pacific',
    }), {
      params: Promise.resolve({ id: '201' }),
    })

    expect(response.status).toBe(200)
    expect(zammadClient.updateUser).toHaveBeenCalledWith(
      201,
      expect.objectContaining({
        firstname: 'Sta Updated',
      })
    )
    expect(zammadClient.updateUser).toHaveBeenCalledWith(
      201,
      expect.not.objectContaining({
        group_ids: expect.anything(),
      })
    )
  })

  it('preserves existing extra group access when staff primary region changes', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 201,
      email: 'staff@test.com',
      firstname: 'Sta',
      lastname: 'Ff',
      login: 'staff@test.com',
      active: true,
      verified: true,
      role_ids: [2],
      note: 'Region: asia-pacific',
      group_ids: {
        '4': ['full'],
        '2': ['full'],
      },
      created_at: '2026-04-16T00:00:00Z',
      updated_at: '2026-04-16T00:00:00Z',
    } as any)
    vi.mocked(zammadClient.updateUser).mockResolvedValue({
      id: 201,
      email: 'staff@test.com',
      firstname: 'Sta',
      lastname: 'Ff',
      active: true,
      note: 'Region: north-america',
      group_ids: {
        '4': ['full'],
        '2': ['full'],
        '6': ['full'],
      },
      updated_at: '2026-04-16T00:00:00Z',
    } as any)

    const response = await PUT_USER(createJsonRequest('http://localhost/api/admin/users/201', 'PUT', {
      region: 'north-america',
    }), {
      params: Promise.resolve({ id: '201' }),
    })

    expect(response.status).toBe(200)
    expect(zammadClient.updateUser).toHaveBeenCalledWith(
      201,
      expect.objectContaining({
        note: 'Region: north-america',
        group_ids: {
          '4': ['full'],
          '2': ['full'],
          '6': ['full'],
        },
      })
    )
  })

  it('clears legacy group access and region note when converting staff to customer', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 201,
      email: 'staff@test.com',
      firstname: 'Sta',
      lastname: 'Ff',
      login: 'staff@test.com',
      active: true,
      verified: true,
      role_ids: [2],
      note: 'Region: asia-pacific',
      group_ids: {
        '4': ['full'],
        '2': ['full'],
      },
      created_at: '2026-04-16T00:00:00Z',
      updated_at: '2026-04-16T00:00:00Z',
    } as any)
    vi.mocked(zammadClient.updateUser).mockResolvedValue({
      id: 201,
      email: 'staff@test.com',
      firstname: 'Sta',
      lastname: 'Ff',
      active: true,
      note: '',
      group_ids: {},
      updated_at: '2026-04-16T00:00:00Z',
    } as any)
    vi.mocked(getCustomerAssignmentRegion).mockResolvedValue(undefined)

    const response = await PUT_USER(createJsonRequest('http://localhost/api/admin/users/201', 'PUT', {
      role: 'customer',
    }), {
      params: Promise.resolve({ id: '201' }),
    })

    expect(response.status).toBe(200)
    expect(zammadClient.updateUser).toHaveBeenCalledWith(
      201,
      expect.objectContaining({
        role_ids: [3],
        group_ids: {},
        note: '',
      })
    )
  })

  it('rejects converting a customer to staff without an explicit region', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 101,
      email: 'customer@test.com',
      firstname: 'Cus',
      lastname: 'Tomer',
      login: 'customer@test.com',
      active: true,
      verified: true,
      role_ids: [],
      note: '',
      group_ids: {},
      created_at: '2026-04-16T00:00:00Z',
      updated_at: '2026-04-16T00:00:00Z',
    } as any)

    const response = await PUT_USER(createJsonRequest('http://localhost/api/admin/users/101', 'PUT', {
      role: 'staff',
    }), {
      params: Promise.resolve({ id: '101' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(JSON.stringify(data)).toContain('Invalid region')
    expect(zammadClient.updateUser).not.toHaveBeenCalled()
  })

  it('returns 403 when reading a user without admin/staff permission', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer_1', role: 'customer', email: 'customer@test.com' },
      expires: new Date(Date.now() + 3600000).toISOString(),
    } as any)

    const response = await GET_USER(new NextRequest('http://localhost/api/admin/users/101'), {
      params: Promise.resolve({ id: '101' }),
    })

    expect(response.status).toBe(403)
  })

  it('returns 403 when updating a user without admin permission', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'staff_1', role: 'staff', email: 'staff@test.com' },
      expires: new Date(Date.now() + 3600000).toISOString(),
    } as any)

    const response = await PUT_USER(createJsonRequest('http://localhost/api/admin/users/101', 'PUT', {
      firstname: 'Nope',
    }), {
      params: Promise.resolve({ id: '101' }),
    })

    expect(response.status).toBe(403)
  })

  it('does not write customer region into note during import flow', async () => {
    vi.mocked(zammadClient.createUser).mockResolvedValue({ id: 101, email: 'customer@test.com' } as any)

    const response = await POST_IMPORT(createImportRequest(
      'email,full_name,role,service_group,region\ncustomer@test.com,Customer User,customer,APAC Premium,'
    ))

    expect(response.status).toBe(200)
    expect(zammadClient.createUser).toHaveBeenCalledWith(
      expect.not.objectContaining({
        note: expect.stringContaining('Region:'),
      })
    )
    expect(assignCustomerToServiceGroup).toHaveBeenCalledWith(101, 7, 'import:customer@test.com')
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

  it('exports staff primary region from note instead of full group iteration order', async () => {
    vi.mocked(zammadClient.searchUsersPaginated).mockResolvedValue([
      {
        id: 201,
        email: 'staff@test.com',
        firstname: 'Sta',
        lastname: 'Ff',
        active: true,
        verified: true,
        role_ids: [2],
        note: 'Region: asia-pacific',
        group_ids: {
          '2': ['full'],
          '4': ['full'],
        },
        created_at: '2026-04-16T00:00:00Z',
        last_login: '',
      },
    ] as any)

    const response = await GET_EXPORT(new NextRequest('http://localhost/api/admin/users/export'))
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(csv).toContain('asia-pacific')
    expect(csv).not.toContain('europe-zone-1')
  })
})
