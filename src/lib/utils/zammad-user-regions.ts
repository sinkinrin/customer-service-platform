import { getRegionByGroupId, isValidRegion } from '@/lib/constants/regions'

export function getRegionFromZammadGroupIds(groupIds?: Record<string, string[]>): string | undefined {
  if (!groupIds) return undefined

  for (const [groupId, permissions] of Object.entries(groupIds)) {
    if (permissions.includes('full')) {
      const region = getRegionByGroupId(parseInt(groupId, 10))
      if (region) return region
    }
  }

  return undefined
}

export function getRegionFromZammadNote(note?: string): string | undefined {
  if (!note) return undefined

  const match = note.match(/Region:\s*(\S+)/)
  if (match && isValidRegion(match[1])) {
    return match[1]
  }

  return undefined
}

export function getPrimaryZammadUserRegion(input: {
  role: 'admin' | 'staff' | 'customer'
  note?: string
  groupIds?: Record<string, string[]>
  customerAssignmentRegion?: string
}): string | undefined {
  if (input.role === 'customer') {
    return input.customerAssignmentRegion
  }

  return getRegionFromZammadNote(input.note) || getRegionFromZammadGroupIds(input.groupIds)
}

export function extractFullAccessGroupIds(groupIds?: Record<string, string[]>): number[] {
  if (!groupIds) return []

  return Object.entries(groupIds)
    .filter(([, permissions]) => permissions.includes('full'))
    .map(([id]) => parseInt(id, 10))
    .filter((id) => !isNaN(id))
}
