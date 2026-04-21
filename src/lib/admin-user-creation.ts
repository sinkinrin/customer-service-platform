import { logger } from '@/lib/utils/logger'
import { zammadClient } from '@/lib/zammad/client'
import { assignCustomerToServiceGroup } from '@/lib/service-groups/customer-assignment-service'

export async function assignCustomerToServiceGroupWithRollback(
  customerZammadId: number,
  serviceGroupId: number,
  assignedBy: string
) {
  try {
    await assignCustomerToServiceGroup(customerZammadId, serviceGroupId, assignedBy)
  } catch (error) {
    try {
      await zammadClient.deleteUser(customerZammadId)
    } catch (rollbackError) {
      logger.error('AdminUserCreation', 'Failed to rollback created Zammad user after assignment error', {
        data: {
          customerZammadId,
          serviceGroupId,
          assignedBy,
          error: error instanceof Error ? error.message : error,
          rollbackError: rollbackError instanceof Error ? rollbackError.message : rollbackError,
        },
      })
    }

    throw error
  }
}
