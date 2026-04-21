import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@prisma/client', () => ({
  ServiceBaseRegion: {
    AFRICA: 'AFRICA',
    MIDDLE_EAST: 'MIDDLE_EAST',
    ASIA_PACIFIC: 'ASIA_PACIFIC',
    NORTH_AMERICA: 'NORTH_AMERICA',
    LATIN_AMERICA: 'LATIN_AMERICA',
    EUROPE_ZONE_1: 'EUROPE_ZONE_1',
    EUROPE_ZONE_2: 'EUROPE_ZONE_2',
    CIS: 'CIS',
  },
}))

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
  clearCustomerAssignment: vi.fn(),
  ensureCustomerAssignmentTarget: vi.fn(),
  findCustomerServiceGroup: vi.fn(),
  reassignCustomersToServiceGroup: vi.fn(),
}))

vi.mock('@/lib/service-groups/ticket-migration-service', () => ({
  migrateCustomerOpenTicketsToGroup: vi.fn(),
  migrateCustomerOpenTicketsToGroupDetailed: vi.fn(),
  migrateServiceGroupOpenTickets: vi.fn(),
  migrateServiceGroupOpenTicketsDetailed: vi.fn(),
  rollbackTicketMigration: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerGroupAssignment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
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
  clearCustomerAssignment,
  ensureCustomerAssignmentTarget,
  findCustomerServiceGroup,
  reassignCustomersToServiceGroup,
} from '@/lib/service-groups/customer-assignment-service'
import {
  migrateCustomerOpenTicketsToGroup,
  migrateCustomerOpenTicketsToGroupDetailed,
  migrateServiceGroupOpenTickets,
  migrateServiceGroupOpenTicketsDetailed,
} from '@/lib/service-groups/ticket-migration-service'
import { zammadClient } from '@/lib/zammad/client'
import { prisma } from '@/lib/prisma'
import { GET as GET_GROUPS, POST as POST_GROUPS } from '@/app/api/admin/service-groups/route'
import { DELETE as DELETE_GROUP, PUT as PUT_GROUP } from '@/app/api/admin/service-groups/[id]/route'
import { POST as POST_GROUP_CUSTOMERS } from '@/app/api/admin/service-groups/[id]/customers/route'
import { POST as POST_CUSTOMER_ASSIGNMENT } from '@/app/api/admin/customers/[zammadId]/service-group/route'

describe('admin service groups API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ id: 'admin_1', role: 'admin' } as any)
    vi.mocked(prisma.customerGroupAssignment.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.customerGroupAssignment.findUnique).mockResolvedValue(null as any)
    vi.mocked(ensureCustomerAssignmentTarget).mockResolvedValue({ id: 101 } as any)
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

  it('promotes read-only group access to full when creating a service group', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 200,
      active: true,
      role_ids: [2],
      group_ids: { '4': ['read'] },
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
    expect(zammadClient.updateUser).toHaveBeenCalledWith(200, {
      group_ids: { '4': ['full'] },
    })
  })

  it('rolls back promoted group access when creating a service group fails', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 200,
      active: true,
      role_ids: [2],
      group_ids: { '4': ['read'] },
    } as any)
    vi.mocked(zammadClient.updateUser).mockResolvedValue({} as any)
    vi.mocked(createServiceGroup).mockRejectedValue(new Error('write failed'))

    const response = await POST_GROUPS(new NextRequest('http://localhost/api/admin/service-groups', {
      method: 'POST',
      body: JSON.stringify({
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 200,
      }),
    }))

    expect(response.status).toBe(500)
    expect(zammadClient.updateUser).toHaveBeenNthCalledWith(1, 200, {
      group_ids: { '4': ['full'] },
    })
    expect(zammadClient.updateUser).toHaveBeenNthCalledWith(2, 200, {
      group_ids: { '4': ['read'] },
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
    vi.mocked(migrateServiceGroupOpenTicketsDetailed).mockResolvedValue({
      migratedCount: 5,
      snapshots: [],
    } as any)

    const response = await PUT_GROUP(
      new NextRequest('http://localhost/api/admin/service-groups/1', {
        method: 'PUT',
        body: JSON.stringify({ staffZammadId: 201 }),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )

    expect(response.status).toBe(200)
    expect(migrateServiceGroupOpenTicketsDetailed).toHaveBeenCalledWith(1, 4, 201)
  })

  it('does not persist service-group updates when ticket migration fails', async () => {
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
    vi.mocked(migrateServiceGroupOpenTicketsDetailed).mockRejectedValue(new Error('migration failed'))

    const response = await PUT_GROUP(
      new NextRequest('http://localhost/api/admin/service-groups/1', {
        method: 'PUT',
        body: JSON.stringify({ staffZammadId: 201 }),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )

    expect(response.status).toBe(500)
    expect(updateServiceGroup).not.toHaveBeenCalled()
  })

  it('rolls back promoted group access when service-group update flow fails', async () => {
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
      group_ids: { '4': ['read'] },
    } as any)
    vi.mocked(zammadClient.updateUser).mockResolvedValue({} as any)
    vi.mocked(migrateServiceGroupOpenTicketsDetailed).mockRejectedValue(new Error('migration failed'))

    const response = await PUT_GROUP(
      new NextRequest('http://localhost/api/admin/service-groups/1', {
        method: 'PUT',
        body: JSON.stringify({ staffZammadId: 201 }),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )

    expect(response.status).toBe(500)
    expect(zammadClient.updateUser).toHaveBeenNthCalledWith(1, 201, {
      group_ids: { '4': ['full'] },
    })
    expect(zammadClient.updateUser).toHaveBeenNthCalledWith(2, 201, {
      group_ids: { '4': ['read'] },
    })
    expect(updateServiceGroup).not.toHaveBeenCalled()
  })

  it('rejects creating a service group when target user is not an agent', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 300,
      active: true,
      role_ids: [3],
      group_ids: {},
    } as any)

    const response = await POST_GROUPS(new NextRequest('http://localhost/api/admin/service-groups', {
      method: 'POST',
      body: JSON.stringify({
        name: '无效负责人组',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 300,
      }),
    }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(JSON.stringify(data)).toContain('must be an agent')
    expect(createServiceGroup).not.toHaveBeenCalled()
  })

  it('deactivates a service group only after transferring assignments to another active group', async () => {
    vi.mocked(getServiceGroup)
      .mockResolvedValueOnce({
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 200,
        isActive: true,
      } as any)
      .mockResolvedValueOnce({
        id: 2,
        name: '亚太 2',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 201,
        isActive: true,
      } as any)
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 201,
      active: true,
      role_ids: [2],
      group_ids: { '4': ['full'] },
    } as any)
    vi.mocked(prisma.customerGroupAssignment.findMany).mockResolvedValue([{ customerZammadId: 101 }] as any)
    vi.mocked(migrateServiceGroupOpenTicketsDetailed).mockResolvedValue({
      migratedCount: 5,
      snapshots: [],
    } as any)
    vi.mocked(reassignCustomersToServiceGroup).mockResolvedValue(8)
    vi.mocked(updateServiceGroup).mockResolvedValue({
      id: 1,
      isActive: false,
    } as any)

    const response = await DELETE_GROUP(
      new NextRequest('http://localhost/api/admin/service-groups/1', {
        method: 'DELETE',
        body: JSON.stringify({ transferToServiceGroupId: 2 }),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )

    expect(response.status).toBe(200)
    expect(migrateServiceGroupOpenTicketsDetailed).toHaveBeenCalledWith(1, 4, 201)
    expect(reassignCustomersToServiceGroup).toHaveBeenCalledWith(1, 2, 'service-group-deactivate:1->2')
    expect(updateServiceGroup).toHaveBeenCalledWith(1, { isActive: false })
  })

  it('restores original assignedBy when deactivation rollback runs', async () => {
    vi.mocked(getServiceGroup)
      .mockResolvedValueOnce({
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 200,
        isActive: true,
      } as any)
      .mockResolvedValueOnce({
        id: 2,
        name: '亚太 2',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 201,
        isActive: true,
      } as any)
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 201,
      active: true,
      role_ids: [2],
      group_ids: { '4': ['full'] },
    } as any)
    vi.mocked(prisma.customerGroupAssignment.findMany).mockResolvedValue([
      { customerZammadId: 101, assignedBy: 'seed-script' },
    ] as any)
    vi.mocked(migrateServiceGroupOpenTicketsDetailed).mockResolvedValue({
      migratedCount: 1,
      snapshots: [],
    } as any)
    vi.mocked(reassignCustomersToServiceGroup).mockResolvedValue(1)
    vi.mocked(updateServiceGroup).mockRejectedValue(new Error('write failed'))

    const response = await DELETE_GROUP(
      new NextRequest('http://localhost/api/admin/service-groups/1', {
        method: 'DELETE',
        body: JSON.stringify({ transferToServiceGroupId: 2 }),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )

    expect(response.status).toBe(500)
    expect(assignCustomerToServiceGroup).toHaveBeenCalledWith(101, 1, 'seed-script')
  })

  it('rejects deactivation when no transfer target is provided', async () => {
    vi.mocked(getServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
      isActive: true,
    } as any)

    const response = await DELETE_GROUP(
      new NextRequest('http://localhost/api/admin/service-groups/1', {
        method: 'DELETE',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )

    expect(response.status).toBe(400)
    expect(updateServiceGroup).not.toHaveBeenCalled()
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
    vi.mocked(migrateCustomerOpenTicketsToGroupDetailed).mockResolvedValue({
      migratedCount: 3,
      snapshots: [],
    } as any)

    const response = await POST_CUSTOMER_ASSIGNMENT(
      new NextRequest('http://localhost/api/admin/customers/101/service-group', {
        method: 'POST',
        body: JSON.stringify({ serviceGroupId: 1 }),
      }),
      { params: Promise.resolve({ zammadId: '101' }) } as any
    )

    expect(response.status).toBe(200)
    expect(assignCustomerToServiceGroup).toHaveBeenCalledWith(101, 1, expect.any(String))
    expect(migrateCustomerOpenTicketsToGroupDetailed).toHaveBeenCalledWith(101, 4, 200)
  })

  it('does not persist a customer assignment when ticket migration fails', async () => {
    vi.mocked(getServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
    } as any)
    vi.mocked(migrateCustomerOpenTicketsToGroupDetailed).mockRejectedValue(new Error('migration failed'))

    const response = await POST_CUSTOMER_ASSIGNMENT(
      new NextRequest('http://localhost/api/admin/customers/101/service-group', {
        method: 'POST',
        body: JSON.stringify({ serviceGroupId: 1 }),
      }),
      { params: Promise.resolve({ zammadId: '101' }) } as any
    )

    expect(response.status).toBe(500)
    expect(assignCustomerToServiceGroup).not.toHaveBeenCalled()
  })

  it('rejects assigning a customer into an inactive service group', async () => {
    vi.mocked(getServiceGroup).mockResolvedValue(null)

    const response = await POST_CUSTOMER_ASSIGNMENT(
      new NextRequest('http://localhost/api/admin/customers/101/service-group', {
        method: 'POST',
        body: JSON.stringify({ serviceGroupId: 999 }),
      }),
      { params: Promise.resolve({ zammadId: '101' }) } as any
    )

    expect(response.status).toBe(400)
    expect(assignCustomerToServiceGroup).not.toHaveBeenCalled()
  })

  it('rejects assigning a non-customer zammad user to a service group', async () => {
    vi.mocked(getServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
    } as any)
    vi.mocked(ensureCustomerAssignmentTarget).mockRejectedValue(new Error('Customer not found'))

    const response = await POST_CUSTOMER_ASSIGNMENT(
      new NextRequest('http://localhost/api/admin/customers/101/service-group', {
        method: 'POST',
        body: JSON.stringify({ serviceGroupId: 1 }),
      }),
      { params: Promise.resolve({ zammadId: '101' }) } as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(JSON.stringify(data)).toContain('Customer not found')
    expect(migrateCustomerOpenTicketsToGroupDetailed).not.toHaveBeenCalled()
    expect(assignCustomerToServiceGroup).not.toHaveBeenCalled()
  })

  it('maps bulk assignment owner availability failures to validation errors', async () => {
    vi.mocked(getServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
    } as any)
    vi.mocked(assignCustomerToServiceGroup).mockResolvedValue({
      customerZammadId: 101,
      serviceGroupId: 1,
    } as any)
    vi.mocked(migrateCustomerOpenTicketsToGroupDetailed).mockRejectedValue(new Error('Target service group owner is unavailable'))

    const response = await POST_GROUP_CUSTOMERS(
      new NextRequest('http://localhost/api/admin/service-groups/1/customers', {
        method: 'POST',
        body: JSON.stringify({ customerZammadIds: [101, 102] }),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(JSON.stringify(data)).toContain('Target service group owner is unavailable')
  })

  it('does not persist bulk assignments when ticket migration fails for the first customer', async () => {
    vi.mocked(getServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
    } as any)
    vi.mocked(migrateCustomerOpenTicketsToGroupDetailed).mockRejectedValue(new Error('migration failed'))

    const response = await POST_GROUP_CUSTOMERS(
      new NextRequest('http://localhost/api/admin/service-groups/1/customers', {
        method: 'POST',
        body: JSON.stringify({ customerZammadIds: [101, 102] }),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )

    expect(response.status).toBe(500)
    expect(assignCustomerToServiceGroup).not.toHaveBeenCalled()
    expect(clearCustomerAssignment).not.toHaveBeenCalled()
  })

  it('restores original assignedBy during bulk assignment rollback', async () => {
    vi.mocked(getServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
    } as any)
    vi.mocked(prisma.customerGroupAssignment.findUnique).mockResolvedValue({
      serviceGroupId: 9,
      assignedBy: 'seed-script',
    } as any)
    vi.mocked(migrateCustomerOpenTicketsToGroupDetailed)
      .mockResolvedValueOnce({
        migratedCount: 1,
        snapshots: [{ id: 1, previousGroupId: 2, previousOwnerId: 300 }],
      } as any)
      .mockRejectedValueOnce(new Error('migration failed'))
    vi.mocked(assignCustomerToServiceGroup).mockResolvedValue({} as any)

    const response = await POST_GROUP_CUSTOMERS(
      new NextRequest('http://localhost/api/admin/service-groups/1/customers', {
        method: 'POST',
        body: JSON.stringify({ customerZammadIds: [101, 102] }),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )

    expect(response.status).toBe(500)
    expect(assignCustomerToServiceGroup).toHaveBeenLastCalledWith(101, 9, 'seed-script')
  })

  it('rejects bulk assignment when any target zammad user is not a customer', async () => {
    vi.mocked(getServiceGroup).mockResolvedValue({
      id: 1,
      name: '亚太 1',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 200,
    } as any)
    vi.mocked(ensureCustomerAssignmentTarget)
      .mockResolvedValueOnce({ id: 101 } as any)
      .mockRejectedValueOnce(new Error('Customer not found'))

    const response = await POST_GROUP_CUSTOMERS(
      new NextRequest('http://localhost/api/admin/service-groups/1/customers', {
        method: 'POST',
        body: JSON.stringify({ customerZammadIds: [101, 102] }),
      }),
      { params: Promise.resolve({ id: '1' }) } as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(JSON.stringify(data)).toContain('Customer not found')
    expect(migrateCustomerOpenTicketsToGroupDetailed).not.toHaveBeenCalled()
    expect(assignCustomerToServiceGroup).not.toHaveBeenCalled()
  })
})
