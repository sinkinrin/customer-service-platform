import { prisma } from '@/lib/prisma'
import { mapServiceBaseRegionToRegionValue } from '@/lib/service-groups/service-group-service'
import { zammadClient } from '@/lib/zammad/client'

export async function ensureCustomerAssignmentTarget(customerZammadId: number) {
  let user

  try {
    user = await zammadClient.getUser(customerZammadId)
  } catch {
    throw new Error('Customer not found')
  }

  const isAgent = user.role_ids?.includes(2) || user.roles?.includes('Agent')
  const isAdmin = user.role_ids?.includes(1) || user.roles?.includes('Admin')

  if (isAgent || isAdmin) {
    throw new Error('Customer not found')
  }

  return user
}

export async function findCustomerServiceGroup(customerZammadId: number) {
  const assignment = await prisma.customerGroupAssignment.findUnique({
    where: { customerZammadId },
    include: { serviceGroup: true },
  })

  if (!assignment?.serviceGroup?.isActive) {
    return null
  }

  return assignment
}

export async function getCustomerAssignmentRegion(customerZammadId: number) {
  const assignment = await findCustomerServiceGroup(customerZammadId)
  return assignment ? mapServiceBaseRegionToRegionValue(assignment.serviceGroup.baseRegion) : undefined
}

export async function listCustomerAssignmentRegions(customerZammadIds: number[]) {
  if (customerZammadIds.length === 0) {
    return new Map<number, string>()
  }

  const assignments = await prisma.customerGroupAssignment.findMany({
    where: {
      customerZammadId: {
        in: customerZammadIds,
      },
    },
    include: { serviceGroup: true },
  })

  return new Map(
    assignments
      .filter((assignment) => assignment.serviceGroup.isActive)
      .map((assignment) => [
        assignment.customerZammadId,
        mapServiceBaseRegionToRegionValue(assignment.serviceGroup.baseRegion),
      ])
  )
}

export async function assignCustomerToServiceGroup(
  customerZammadId: number,
  serviceGroupId: number,
  assignedBy?: string
) {
  return prisma.customerGroupAssignment.upsert({
    where: { customerZammadId },
    create: {
      customerZammadId,
      serviceGroupId,
      assignedBy,
    },
    update: {
      serviceGroupId,
      assignedBy,
    },
    include: { serviceGroup: true },
  })
}

export async function clearCustomerAssignment(customerZammadId: number) {
  const result = await prisma.customerGroupAssignment.deleteMany({
    where: { customerZammadId },
  })

  return result.count
}

export async function reassignCustomersToServiceGroup(
  fromServiceGroupId: number,
  toServiceGroupId: number,
  assignedBy?: string
) {
  const result = await prisma.customerGroupAssignment.updateMany({
    where: { serviceGroupId: fromServiceGroupId },
    data: {
      serviceGroupId: toServiceGroupId,
      assignedBy,
    },
  })

  return result.count
}

export async function listUnassignedCustomers<T extends { id: number }>(customers: T[]): Promise<T[]> {
  if (customers.length === 0) {
    return []
  }

  const assignments = await prisma.customerGroupAssignment.findMany({
    select: { customerZammadId: true },
  })
  const assignedCustomerIds = new Set(assignments.map((assignment) => assignment.customerZammadId))

  return customers.filter((customer) => !assignedCustomerIds.has(customer.id))
}
