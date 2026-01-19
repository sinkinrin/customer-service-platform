/**
 * Auto-assign single ticket to available agent
 *
 * Extracted from /api/tickets/auto-assign for reuse in ticket creation flow
 */

import { zammadClient } from '@/lib/zammad/client'
import { GROUP_REGION_MAPPING } from '@/lib/constants/regions'
import type { ZammadUser } from '@/lib/zammad/types'

// Excluded system accounts that shouldn't receive ticket assignments
export const EXCLUDED_EMAILS = ['support@howentech.com', 'howensupport@howentech.com']

// Single ticket auto-assign result
export interface SingleAssignResult {
  success: boolean
  assignedTo?: {
    id: number
    name: string
    email: string
  }
  error?: string
}

// Placeholder for implementation
export async function autoAssignSingleTicket(
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  groupId: number
): Promise<SingleAssignResult> {
  return { success: false, error: 'Not implemented' }
}

export async function handleAssignmentNotification(
  result: SingleAssignResult,
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  region: string
): Promise<void> {
  // Placeholder
}
