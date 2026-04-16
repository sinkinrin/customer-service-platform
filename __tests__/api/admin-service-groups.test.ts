import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/service-groups/service-group-service', () => ({
  createServiceGroup: vi.fn(),
  getServiceGroup: vi.fn(),
  listServiceGroups: vi.fn(),
  mapServiceBaseRegionToRegionValue: vi.fn(() => 'asia-pacific'),
  updateServiceGroup: vi.fn(),
}))

vi.mock('@/lib/service-groups/customer-assignment-service', () => ({
  assignCustomerToServiceGroup: vi.fn(),
  findCustomerServiceGroup: vi.fn(),
}))

vi.mock('@/lib/service-groups/ticket-migration-service', () => ({
  migrateCustomerOpenTicketsToGroup: vi.fn(),
  migrateServiceGroupOpenTickets: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
  },
}))

import { requireRole } from '@/lib/utils/auth'
import {
  createServiceGroup,
  getServiceGroup,
  listServiceGroups,
  updateServiceGroup,
} from '@/lib/service-groups/service-group-service'
import {
  assignCustomerToServiceGroup,
  findCustomerServiceGroup,
} from '@/lib/service-groups/customer-assignment-service'
import {
  migrateCustomerOpenTicketsToGroup,
  migrateServiceGroupOpenTickets,
} from '@/lib/service-groups/ticket-migration-service'
import { zammadClient } from '@/lib/zammad/client'
import { GET as GET_GROUPS, POST as POST_GROUPS } from '@/app/api/admin/service-groups/route'
import { PUT as PUT_GROUP } from '@/app/api/admin/service-groups/[id]/route'
import { POST as POST_CUSTOMER_ASSIGNMENT } from '@/app/api/admin/customers/[zammadId]/service-group/route'

describe('admin service groups API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ id: 'admin_1', role: 'admin' } as any)
  })

  it('lists service groups', async () => {
    vi.mocked(listServiceGroups).mockResolvedValue([
      { id: 1, name: '亚太 1', baseRegion: 'ASIA_PACIFIC', staffZammadId: 200 },
    ] as any)

    const response = await GET_GROUPS(new NextRequest('http://localhost/api/admin/service-groups'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.serviceGroups).toHaveLength(1)
  })

  it('creates a service group after validating target staff', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 200,
      active: true,
      role_ids: [2],
      group_ids: { '4': ['full'] },
    } as any)
    vi.mocked(createServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
    } as any)

    const response = await POST_GROUPS(new NextRequest('http://localhost/api/admin/service-groups', {
      method: 'POST',
      body: JSON.stringify({
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 200,
      }),
    }))

    expect(response.status).toBe(201)
    expect(createServiceGroup).toHaveBeenCalledWith({
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
    })
  })

  it('updates service-group owner and triggers bulk migration', async () => {
    vi.mocked(getServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
    } as any)
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 201,
      active: true,
      role_ids: [2],
      group_ids: {},
    } as any)
    vi.mocked(zammadClient.updateUser).mockResolvedValue({} as any)
    vi.mocked(updateServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 201,
    } as any)
    vi.mocked(migrateServiceGroupOpenTickets).mockResolvedValue(5)

    const response = await PUT_GROUP(
      new NextRequest('http://localhost/api/admin/service-groups/1', {
        method: 'PUT',
        body: JSON.stringify({ staffZammadId: 201 }),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )

    expect(response.status).toBe(200)
    expect(migrateServiceGroupOpenTickets).toHaveBeenCalledWith(1, 4, 201)
  })

  it('assigns customer to a service group and migrates open tickets', async () => {
    vi.mocked(getServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
    } as any)
    vi.mocked(findCustomerServiceGroup).mockResolvedValue(null)
    vi.mocked(assignCustomerToServiceGroup).mockResolvedValue({
      customerZammadId: 101,
      serviceGroupId: 1,
    } as any)
    vi.mocked(migrateCustomerOpenTicketsToGroup).mockResolvedValue(3)

    const response = await POST_CUSTOMER_ASSIGNMENT(
      new NextRequest('http://localhost/api/admin/customers/101/service-group', {
        method: 'POST',
        body: JSON.stringify({ serviceGroupId: 1 }),
      }),
      { params: Promise.resolve({ zammadId: '101' }) } as any
    )

    expect(response.status).toBe(200)
    expect(assignCustomerToServiceGroup).toHaveBeenCalledWith(101, 1, expect.any(String))
    expect(migrateCustomerOpenTicketsToGroup).toHaveBeenCalledWith(101, 4, 200)
  })
})
