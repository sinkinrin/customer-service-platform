import { prisma } from '@/lib/prisma'

export async function findCustomerServiceGroup(customerZammadId: number) {
  return prisma.customerGroupAssignment.findUnique({
    where: { customerZammadId },
    include: { serviceGroup: true },
  })
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
