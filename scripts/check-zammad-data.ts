/**
 * Check Zammad Data
 * Query users, groups, and ticket states from Zammad
 */

import dotenv from 'dotenv'
import path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const ZAMMAD_URL = process.env.ZAMMAD_URL?.replace(/\/$/, '')
const ZAMMAD_API_TOKEN = process.env.ZAMMAD_API_TOKEN

if (!ZAMMAD_URL || !ZAMMAD_API_TOKEN) {
  console.error('❌ ZAMMAD_URL and ZAMMAD_API_TOKEN must be set in .env.local')
  process.exit(1)
}

console.log('Environment variables loaded:')
console.log('ZAMMAD_URL:', ZAMMAD_URL)
console.log('ZAMMAD_API_TOKEN:', '****' + ZAMMAD_API_TOKEN.slice(-10))
console.log()

async function fetchZammad(endpoint: string) {
  const url = `${ZAMMAD_URL}/api/v1${endpoint}`
  const response = await fetch(url, {
    headers: {
      'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }

  return response.json()
}

async function checkZammadData() {
  console.log('=== Checking Zammad Data ===\n')

  try {
    // 1. Search for all users
    console.log('📋 Fetching Users...\n')
    const usersResponse = await fetchZammad('/users/search?query=*&limit=100')
    const users = usersResponse
    console.log(`Total users found: ${users.length}\n`)

    console.log('All Users:')
    users.forEach((user: any) => {
      const roles = user.role_ids?.map((id: number) => {
        if (id === 1) return 'Admin'
        if (id === 2) return 'Agent'
        if (id === 3) return 'Customer'
        return `Role${id}`
      }).join(', ') || 'No roles'

      const groupIds = user.group_ids ? Object.keys(user.group_ids).join(', ') : 'None'

      console.log(`  ID: ${user.id}, Email: ${user.email}, Name: ${user.firstname} ${user.lastname}, Roles: ${roles}, Groups: ${groupIds}, Active: ${user.active}`)
    })

    // 2. Get all groups
    console.log('\n📋 Fetching Groups...\n')
    const groups = await fetchZammad('/groups')
    console.log(`Total groups: ${groups.length}\n`)

    console.log('All Groups:')
    groups.forEach((group: any) => {
      console.log(`  ID: ${group.id}, Name: ${group.name}, Active: ${group.active}`)
    })

    // 3. Get ticket states
    console.log('\n📋 Fetching Ticket States...\n')
    const states = await fetchZammad('/ticket_states')
    console.log(`Total states: ${states.length}\n`)

    console.log('All Ticket States:')
    states.forEach((state: any) => {
      console.log(`  ID: ${state.id}, Name: ${state.name}, State Type: ${state.state_type_id}, Default Create: ${state.default_create}, Default Follow Up: ${state.default_follow_up}, Active: ${state.active}`)
    })

    // 4. Get ticket priorities
    console.log('\n📋 Fetching Ticket Priorities...\n')
    const priorities = await fetchZammad('/ticket_priorities')
    console.log(`Total priorities: ${priorities.length}\n`)

    console.log('All Ticket Priorities:')
    priorities.forEach((priority: any) => {
      console.log(`  ID: ${priority.id}, Name: ${priority.name}, Default Create: ${priority.default_create}, Active: ${priority.active}`)
    })

    console.log('\n✅ Data check completed successfully!')

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    if (error.cause) {
      console.error('Cause:', error.cause)
    }
    process.exit(1)
  }
}

checkZammadData()
