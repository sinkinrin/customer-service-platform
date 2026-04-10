/**
 * Shared Agent Helpers
 *
 * DRY utilities used by auto-assign, batch auto-assign, and binding-first logic.
 */

import type { ZammadUser } from '@/lib/zammad/types'

/** Check if an agent is currently on vacation */
export function checkIsOnVacation(agent: {
  out_of_office?: boolean
  out_of_office_start_at?: string | null
  out_of_office_end_at?: string | null
}): boolean {
  if (!agent.out_of_office) return false
  const now = new Date()
  const start = agent.out_of_office_start_at ? new Date(agent.out_of_office_start_at) : null
  const end = agent.out_of_office_end_at ? new Date(agent.out_of_office_end_at) : null
  if (start && end) return now >= start && now <= end
  if (start && !end) return now >= start
  if (!start && end) return now <= end
  return false
}

/** Get display name for an agent */
export function getAgentDisplayName(agent: {
  firstname?: string
  lastname?: string
  login?: string
  email?: string
}): string {
  const fullName = [agent.firstname, agent.lastname].filter(Boolean).join(' ')
  return fullName || agent.login || agent.email || 'Unknown'
}

/**
 * Check if an agent is eligible for ticket assignment.
 * Self-contained: checks active, not system account, not admin role, has group access, not on vacation.
 */
export function isAgentEligible(
  agent: ZammadUser,
  groupId: number,
  excludedEmails: string[]
): boolean {
  // Must be active
  if (!agent.active) return false
  // Exclude system accounts
  if (excludedEmails.some(e => agent.email?.toLowerCase() === e.toLowerCase())) return false
  // Exclude Admin role (role_id 1)
  if (agent.role_ids?.includes(1)) return false
  // Check group access
  const hasGroupAccess = Object.keys(agent.group_ids || {}).includes(String(groupId))
  if (!hasGroupAccess) return false
  // Check vacation
  if (checkIsOnVacation(agent)) return false
  return true
}
