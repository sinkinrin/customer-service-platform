/**
 * Request ID Generator
 *
 * Generates structured request IDs for tracing and debugging.
 * Format: G{groupId}-{role}-{zammadId}-{timestamp}-{random}
 *
 * Example: G4-S-15-20250122103045-a3f2
 *   - G4: Group ID 4 (Asia-Pacific)
 *   - S: Staff role
 *   - 15: Zammad user ID
 *   - 20250122103045: Timestamp
 *   - a3f2: Random suffix
 */

import { REGION_GROUP_MAPPING, type RegionValue } from '@/lib/constants/regions'

/**
 * User context for generating request ID
 */
export interface RequestIdContext {
  /** User's region (e.g., 'asia-pacific') */
  region?: string
  /** User's role */
  role?: 'admin' | 'staff' | 'customer'
  /** Zammad user ID */
  zammadId?: number
}

/**
 * Role code mapping
 */
const ROLE_CODES: Record<string, string> = {
  admin: 'A',
  staff: 'S',
  customer: 'C',
}

/**
 * Get group ID from region string
 * Works for both Staff (who have group_ids) and Customer (who have region in note)
 */
function getGroupIdFromRegion(region?: string): number {
  if (!region) return 0
  const groupId = REGION_GROUP_MAPPING[region as RegionValue]
  return groupId || 0
}

/**
 * Generate a structured request ID
 *
 * @param ctx - User context from session
 * @returns Formatted request ID string
 *
 * @example
 * // Staff in Asia-Pacific (group 4)
 * generateRequestId({ region: 'asia-pacific', role: 'staff', zammadId: 15 })
 * // => "G4-S-15-20250122103045-a3f2"
 *
 * @example
 * // Customer in Africa (group 1)
 * generateRequestId({ region: 'africa', role: 'customer', zammadId: 203 })
 * // => "G1-C-203-20250122103045-b7e1"
 *
 * @example
 * // Admin (global, group 0)
 * generateRequestId({ role: 'admin', zammadId: 1 })
 * // => "G0-A-1-20250122103200-c9d4"
 *
 * @example
 * // Unauthenticated user
 * generateRequestId()
 * // => "G0-X-0-20250122103300-d5e6"
 */
export function generateRequestId(ctx?: RequestIdContext): string {
  const parts: string[] = []

  // 1. Group ID (based on region, Admin uses 0 for global)
  let groupId: number
  if (ctx?.role === 'admin') {
    groupId = 0  // Admin is global, not bound to specific region
  } else {
    groupId = getGroupIdFromRegion(ctx?.region)
  }
  parts.push(`G${groupId}`)

  // 2. Role code (A=Admin, S=Staff, C=Customer, X=Anonymous)
  const roleCode = ctx?.role ? (ROLE_CODES[ctx.role] || 'X') : 'X'
  parts.push(roleCode)

  // 3. Zammad user ID (0 for anonymous)
  parts.push((ctx?.zammadId || 0).toString())

  // 4. Timestamp (YYYYMMDDHHmmss)
  // Note: Using RegExp constructor to avoid Tailwind CSS scanner
  // misinterpreting the regex pattern as a class name
  const isoCharsToRemove = new RegExp('[\\-:T.Z]', 'g')
  const timestamp = new Date()
    .toISOString()
    .replace(isoCharsToRemove, '')
    .substring(0, 14)
  parts.push(timestamp)

  // 5. Random suffix (4 chars for collision prevention)
  const random = Math.random().toString(36).substring(2, 6)
  parts.push(random)

  return parts.join('-')
}

/**
 * Parse a request ID back into its components
 * Useful for log analysis and debugging
 *
 * @param requestId - The request ID to parse
 * @returns Parsed components or null if invalid
 */
export function parseRequestId(requestId: string): {
  groupId: number
  role: string
  zammadId: number
  timestamp: string
  random: string
} | null {
  const parts = requestId.split('-')
  if (parts.length !== 5) return null

  const groupMatch = parts[0].match(/^G(\d+)$/)
  if (!groupMatch) return null

  const roleMap: Record<string, string> = {
    A: 'admin',
    S: 'staff',
    C: 'customer',
    X: 'anonymous',
  }

  return {
    groupId: parseInt(groupMatch[1], 10),
    role: roleMap[parts[1]] || 'unknown',
    zammadId: parseInt(parts[2], 10) || 0,
    timestamp: parts[3],
    random: parts[4],
  }
}
