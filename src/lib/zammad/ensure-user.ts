/**
 * Shared Zammad user provisioning
 *
 * Ensures a user exists in Zammad before performing ticket operations.
 * Used by both tickets/route.ts and tickets/search/route.ts.
 */

import { zammadClient } from '@/lib/zammad/client'
import { getGroupIdByRegion, type RegionValue } from '@/lib/constants/regions'
import { createApiLogger } from '@/lib/utils/api-logger'

/**
 * Ensure a user exists in Zammad, creating them if necessary.
 *
 * @param email - User email
 * @param fullName - User full name
 * @param role - App role (customer/staff/admin)
 * @param region - Optional region for staff group assignment
 * @param requestId - Optional request ID for log correlation
 */
export async function ensureZammadUser(
  email: string,
  fullName: string,
  role: string,
  region?: string,
  requestId?: string
) {
  const log = createApiLogger('EnsureZammadUser', requestId)

  try {
    // Try to search for user by email
    const searchResult = await zammadClient.searchUsers(`email:${email}`)
    if (searchResult && searchResult.length > 0) {
      log.debug('User already exists in Zammad', { userId: searchResult[0].id })
      return searchResult[0]
    }

    // User doesn't exist, create them
    log.debug('Creating new user in Zammad', { email })
    const [firstname, ...lastnameArr] = fullName.split(' ')
    const lastname = lastnameArr.join(' ') || firstname

    // Determine Zammad roles
    let zammadRoles: string[]
    if (role === 'admin') {
      zammadRoles = ['Admin', 'Agent']
    } else if (role === 'staff') {
      zammadRoles = ['Agent']
    } else {
      zammadRoles = ['Customer']
    }

    // Prepare group_ids for staff (assign to region group)
    let groupIds: Record<string, string[]> | undefined
    if (role === 'staff' && region) {
      const groupId = getGroupIdByRegion(region as RegionValue)
      groupIds = {
        [groupId.toString()]: ['full'],
      }
      log.debug('Setting group_ids for staff user', { groupIds })
    }

    const newUser = await zammadClient.createUser({
      login: email,
      email,
      firstname,
      lastname,
      roles: zammadRoles,
      group_ids: groupIds,
      active: true,
      verified: true,
    })

    log.debug('Created new Zammad user', { userId: newUser.id })
    return newUser
  } catch (error) {
    log.error('Failed to ensure Zammad user', { error: error instanceof Error ? error.message : error })
    throw error
  }
}
