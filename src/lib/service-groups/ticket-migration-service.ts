import { prisma } from '@/lib/prisma'
import { zammadClient } from '@/lib/zammad/client'
import { getActiveStateIds } from '@/lib/constants/zammad-states'

export async function migrateCustomerOpenTicketsToGroup(
  customerZammadId: number,
  targetGroupId: number,
  targetOwnerId: number
) {
  const stateQuery = getActiveStateIds().map((id) => `state_id:${id}`).join(' OR ')
  const query = `customer_id:${customerZammadId} AND (${stateQuery})`
  const result = await zammadClient.searchTicketsRawQuery(query, 500)
  const tickets = result?.tickets ?? []

  for (const ticket of tickets) {
    await zammadClient.updateTicket(ticket.id, {
      group_id: targetGroupId,
      owner_id: targetOwnerId,
    })
  }

  return tickets.length
}

export async function migrateServiceGroupOpenTickets(
  serviceGroupId: number,
  targetGroupId: number,
  targetOwnerId: number
) {
  const assignments = await prisma.customerGroupAssignment.findMany({
    where: { serviceGroupId },
    select: { customerZammadId: true },
  })

  let migrated = 0
  for (const assignment of assignments) {
    migrated += await migrateCustomerOpenTicketsToGroup(
      assignment.customerZammadId,
      targetGroupId,
      targetOwnerId
    )
  }

  return migrated
}
