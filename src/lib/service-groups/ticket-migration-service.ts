import { prisma } from '@/lib/prisma'
import { zammadClient } from '@/lib/zammad/client'
import { getActiveStateIds } from '@/lib/constants/zammad-states'
import { isAgentEligible } from '@/lib/ticket/agent-helpers'

const EXCLUDED_EMAILS = ['support@howentech.com', 'howensupport@howentech.com']
const TICKET_MIGRATION_PAGE_SIZE = 500

export interface MigratedTicketSnapshot {
  id: number
  previousGroupId?: number | null
  previousOwnerId?: number | null
}

export interface TicketMigrationDetails {
  migratedCount: number
  snapshots: MigratedTicketSnapshot[]
}

async function ensureValidMigrationTarget(targetGroupId: number, targetOwnerId: number) {
  const targetOwner = await zammadClient.getUser(targetOwnerId)
  const isAgent = targetOwner.role_ids?.includes(2) || targetOwner.roles?.includes('Agent')

  if (!isAgent) {
    throw new Error('Target service group owner must be an agent')
  }

  if (!isAgentEligible(targetOwner, targetGroupId, EXCLUDED_EMAILS)) {
    throw new Error('Target service group owner is unavailable')
  }
}

async function listCustomerOpenTickets(customerZammadId: number) {
  const stateQuery = getActiveStateIds().map((id) => `state_id:${id}`).join(' OR ')
  const query = `customer_id:${customerZammadId} AND (${stateQuery})`
  const tickets: Array<{ id: number; group_id?: number | null; owner_id?: number | null }> = []
  let page = 1

  while (true) {
    const result = await zammadClient.searchTicketsRawQuery(query, TICKET_MIGRATION_PAGE_SIZE, undefined, page)
    const pageTickets = result?.tickets ?? []
    tickets.push(...pageTickets)

    if (pageTickets.length < TICKET_MIGRATION_PAGE_SIZE) {
      break
    }

    page += 1
  }

  return tickets
}

export async function rollbackTicketMigration(snapshots: MigratedTicketSnapshot[]) {
  for (const snapshot of [...snapshots].reverse()) {
    const rollbackPayload: { group_id?: number | null; owner_id?: number | null } = {}

    if (snapshot.previousGroupId === null || typeof snapshot.previousGroupId === 'number') {
      rollbackPayload.group_id = snapshot.previousGroupId
    }

    rollbackPayload.owner_id = snapshot.previousOwnerId ?? null
    await zammadClient.updateTicket(snapshot.id, rollbackPayload)
  }
}

async function migrateTicketsToTarget(
  tickets: Array<{ id: number; group_id?: number | null; owner_id?: number | null }>,
  targetGroupId: number,
  targetOwnerId: number
) {
  const snapshots: MigratedTicketSnapshot[] = []

  try {
    for (const ticket of tickets) {
      await zammadClient.updateTicket(ticket.id, {
        group_id: targetGroupId,
        owner_id: targetOwnerId,
      })

      snapshots.push({
        id: ticket.id,
        previousGroupId: ticket.group_id,
        previousOwnerId: ticket.owner_id,
      })
    }
  } catch (error) {
    await rollbackTicketMigration(snapshots)
    throw error
  }

  return snapshots
}

export async function migrateCustomerOpenTicketsToGroupDetailed(
  customerZammadId: number,
  targetGroupId: number,
  targetOwnerId: number
): Promise<TicketMigrationDetails> {
  await ensureValidMigrationTarget(targetGroupId, targetOwnerId)

  const tickets = await listCustomerOpenTickets(customerZammadId)
  const snapshots = await migrateTicketsToTarget(tickets, targetGroupId, targetOwnerId)

  return {
    migratedCount: tickets.length,
    snapshots,
  }
}

export async function migrateCustomerOpenTicketsToGroup(
  customerZammadId: number,
  targetGroupId: number,
  targetOwnerId: number
) {
  const result = await migrateCustomerOpenTicketsToGroupDetailed(
    customerZammadId,
    targetGroupId,
    targetOwnerId
  )

  return result.migratedCount
}

export async function migrateServiceGroupOpenTicketsDetailed(
  serviceGroupId: number,
  targetGroupId: number,
  targetOwnerId: number
): Promise<TicketMigrationDetails> {
  await ensureValidMigrationTarget(targetGroupId, targetOwnerId)

  const assignments = await prisma.customerGroupAssignment.findMany({
    where: { serviceGroupId },
    select: { customerZammadId: true },
  })

  const snapshots: MigratedTicketSnapshot[] = []
  let migratedCount = 0

  try {
    for (const assignment of assignments) {
      const tickets = await listCustomerOpenTickets(assignment.customerZammadId)
      const customerSnapshots = await migrateTicketsToTarget(tickets, targetGroupId, targetOwnerId)
      snapshots.push(...customerSnapshots)
      migratedCount += tickets.length
    }
  } catch (error) {
    await rollbackTicketMigration(snapshots)
    throw error
  }

  return {
    migratedCount,
    snapshots,
  }
}

export async function migrateServiceGroupOpenTickets(
  serviceGroupId: number,
  targetGroupId: number,
  targetOwnerId: number
) {
  const result = await migrateServiceGroupOpenTicketsDetailed(
    serviceGroupId,
    targetGroupId,
    targetOwnerId
  )

  return result.migratedCount
}
