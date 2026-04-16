import { prisma } from '@/lib/prisma'
import { mapServiceBaseRegionToRegionValue } from '@/lib/service-groups/service-group-service'

export async function findCustomerServiceGroup(customerZammadId: number) {
  return prisma.customerGroupAssignment.findUnique({
    where: { customerZammadId },
    include: { serviceGroup: true },
  })
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
    assignments.map((assignment) => [
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
