import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  assignCustomerToServiceGroup,
  clearCustomerAssignment,
  findCustomerServiceGroup,
  listUnassignedCustomers,
  reassignCustomersToServiceGroup,
} from '@/lib/service-groups/customer-assignment-service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerGroupAssignment: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('customer-assignment-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns assigned service group for customer zammad id', async () => {
    vi.mocked(prisma.customerGroupAssignment.findUnique).mockResolvedValue({
      id: 9,
      customerZammadId: 123,
      serviceGroupId: 4,
      serviceGroup: {
        id: 4,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        isActive: true,
      },
    } as any)

    const result = await findCustomerServiceGroup(123)

    expect(result?.serviceGroup.name).toBe('亚太 1')
    expect(prisma.customerGroupAssignment.findUnique).toHaveBeenCalledWith({
      where: { customerZammadId: 123 },
      include: { serviceGroup: true },
    })
  })

  it('treats assignments pointing at inactive service groups as unavailable', async () => {
    vi.mocked(prisma.customerGroupAssignment.findUnique).mockResolvedValue({
      id: 9,
      customerZammadId: 123,
      serviceGroupId: 4,
      serviceGroup: {
        id: 4,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        isActive: false,
      },
    } as any)

    const result = await findCustomerServiceGroup(123)

    expect(result).toBeNull()
  })

  it('upserts a customer assignment', async () => {
    vi.mocked(prisma.customerGroupAssignment.upsert).mockResolvedValue({
      customerZammadId: 123,
      serviceGroupId: 8,
      assignedBy: 'admin@example.com',
    } as any)

    const result = await assignCustomerToServiceGroup(123, 8, 'admin@example.com')

    expect(result).toEqual({
      customerZammadId: 123,
      serviceGroupId: 8,
      assignedBy: 'admin@example.com',
    })
    expect(prisma.customerGroupAssignment.upsert).toHaveBeenCalledWith({
      where: { customerZammadId: 123 },
      create: {
        customerZammadId: 123,
        serviceGroupId: 8,
        assignedBy: 'admin@example.com',
      },
      update: {
        serviceGroupId: 8,
        assignedBy: 'admin@example.com',
      },
      include: { serviceGroup: true },
    })
  })

  it('clears an assignment by customer zammad id', async () => {
    vi.mocked(prisma.customerGroupAssignment.deleteMany).mockResolvedValue({ count: 1 } as any)

    const result = await clearCustomerAssignment(222)

    expect(result).toBe(1)
    expect(prisma.customerGroupAssignment.deleteMany).toHaveBeenCalledWith({
      where: { customerZammadId: 222 },
    })
  })

  it('bulk reassigns customers from one service group to another', async () => {
    vi.mocked(prisma.customerGroupAssignment.updateMany).mockResolvedValue({ count: 3 } as any)

    const result = await reassignCustomersToServiceGroup(7, 8, 'admin@example.com')

    expect(result).toBe(3)
    expect(prisma.customerGroupAssignment.updateMany).toHaveBeenCalledWith({
      where: { serviceGroupId: 7 },
      data: {
        serviceGroupId: 8,
        assignedBy: 'admin@example.com',
      },
    })
  })

  it('returns only unassigned customers while preserving input shape', async () => {
    vi.mocked(prisma.customerGroupAssignment.findMany).mockResolvedValue([
      { customerZammadId: 1002 },
    ] as any)

    const customers = [
      { id: 1001, email: 'a@example.com', firstname: 'A' },
      { id: 1002, email: 'b@example.com', firstname: 'B' },
    ]

    const result = await listUnassignedCustomers(customers)

    expect(result).toEqual([
      { id: 1001, email: 'a@example.com', firstname: 'A' },
    ])
    expect(prisma.customerGroupAssignment.findMany).toHaveBeenCalledWith({
      select: { customerZammadId: true },
    })
  })
})
