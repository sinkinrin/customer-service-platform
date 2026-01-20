/**
 * Sync Mock Users to Zammad
 * Creates or updates mock users in Zammad system
 */

import dotenv from 'dotenv'
import path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { mockUsers } from '../src/lib/mock-auth'
import { getGroupIdByRegion } from '../src/lib/constants/regions'
import type { RegionValue } from '../src/lib/constants/regions'

const ZAMMAD_URL = process.env.ZAMMAD_URL?.replace(/\/$/, '')
const ZAMMAD_API_TOKEN = process.env.ZAMMAD_API_TOKEN

if (!ZAMMAD_URL || !ZAMMAD_API_TOKEN) {
  console.error('❌ ZAMMAD_URL and ZAMMAD_API_TOKEN must be set in .env.local')
  process.exit(1)
}

async function fetchZammad(endpoint: string, options?: RequestInit) {
  const url = `${ZAMMAD_URL}/api/v1${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }

  return response.json()
}

async function syncMockUsers() {
  console.log('=== Syncing Mock Users to Zammad ===\n')

  // Select critical mock users to sync
  const usersToSync = [
    'admin@test.com',
    'staff@test.com',
    'customer@test.com',
  ]

  try {
    for (const email of usersToSync) {
      const mockUser = mockUsers[email]
      if (!mockUser) {
        console.log(`⚠️  Skip: ${email} (not found in mock data)`)
        continue
      }

      console.log(`\n📝 Processing: ${email}`)
      console.log(`   Role: ${mockUser.role}, Region: ${mockUser.region || 'N/A'}`)

      // Check if user exists
      const searchResults = await fetchZammad(`/users/search?query=${encodeURIComponent(email)}`)
      const existingUser = searchResults.find((u: any) => u.email === email)

      // Determine Zammad roles
      let roleIds: number[]
      if (mockUser.role === 'admin') {
        roleIds = [1, 2] // Admin, Agent
      } else if (mockUser.role === 'staff') {
        roleIds = [2] // Agent
      } else {
        roleIds = [3] // Customer
      }

      // Prepare group_ids for staff (assign to region group)
      let groupIds: Record<string, string[]> | undefined
      if (mockUser.role === 'staff' && mockUser.region) {
        const groupId = getGroupIdByRegion(mockUser.region as RegionValue)
        groupIds = {
          [groupId.toString()]: ['full']  // Full permission for staff in their region
        }
      } else if (mockUser.role === 'admin') {
        // Admin has access to all groups
        groupIds = {
          '1': ['full'], '2': ['full'], '3': ['full'], '4': ['full'],
          '5': ['full'], '6': ['full'], '7': ['full'], '8': ['full']
        }
      }

      const [firstname, ...lastnameArr] = mockUser.full_name.split(' ')
      const lastname = lastnameArr.join(' ') || firstname

      const userData = {
        email: mockUser.email,
        firstname,
        lastname,
        roles: roleIds.map(id => {
          if (id === 1) return 'Admin'
          if (id === 2) return 'Agent'
          return 'Customer'
        }),
        active: true,
        group_ids: groupIds,
      }

      if (existingUser) {
        // Update existing user
        console.log(`   Found existing user (ID: ${existingUser.id})`)

        if (!existingUser.active) {
          console.log(`   ⚠️  User is inactive, activating...`)
        }

        const updatedUser = await fetchZammad(`/users/${existingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(userData),
        })

        console.log(`   ✅ Updated: ID ${updatedUser.id}, Active: ${updatedUser.active}`)
      } else {
        // Create new user
        console.log(`   Creating new user...`)

        const newUser = await fetchZammad('/users', {
          method: 'POST',
          body: JSON.stringify(userData),
        })

        console.log(`   ✅ Created: ID ${newUser.id}`)
      }
    }

    console.log('\n\n=== Verification ===\n')

    // Verify all users
    for (const email of usersToSync) {
      const searchResults = await fetchZammad(`/users/search?query=${encodeURIComponent(email)}`)
      const user = searchResults.find((u: any) => u.email === email)

      if (user) {
        const roles = user.role_ids?.map((id: number) => {
          if (id === 1) return 'Admin'
          if (id === 2) return 'Agent'
          if (id === 3) return 'Customer'
          return `Role${id}`
        }).join(', ')

        console.log(`✅ ${email}: ID ${user.id}, Roles: ${roles}, Active: ${user.active}`)
      } else {
        console.log(`❌ ${email}: NOT FOUND`)
      }
    }

    console.log('\n✅ Mock users sync completed!')

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

syncMockUsers()
