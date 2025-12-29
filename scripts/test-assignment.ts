/**
 * Test Ticket Assignment
 * Debug why assigning tickets to certain user IDs fails
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const ZAMMAD_URL = process.env.ZAMMAD_URL?.replace(/\/$/, '')
const ZAMMAD_API_TOKEN = process.env.ZAMMAD_API_TOKEN

if (!ZAMMAD_URL || !ZAMMAD_API_TOKEN) {
  console.error('❌ ZAMMAD_URL and ZAMMAD_API_TOKEN must be set')
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

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`)
  }

  return JSON.parse(text)
}

async function testAssignment() {
  console.log('=== Testing Ticket Assignment ===\n')

  try {
    // Get all tickets
    console.log('📋 Fetching tickets...')
    const tickets = await fetchZammad('/tickets?per_page=10')

    if (tickets.length === 0) {
      console.log('⚠️  No tickets found')
      return
    }

    const testTicket = tickets[0]
    console.log(`\nTest Ticket: #${testTicket.number} (ID: ${testTicket.id})`)
    console.log(`  Title: ${testTicket.title}`)
    console.log(`  Group ID: ${testTicket.group_id}`)
    console.log(`  Current Owner ID: ${testTicket.owner_id}`)
    console.log(`  State ID: ${testTicket.state_id}`)

    // Test assignment to different users
    const testUserIds = [3, 6, 16, 18, 20, 22, 37]

    for (const userId of testUserIds) {
      console.log(`\n--- Testing assignment to User ID ${userId} ---`)

      try {
        // Get user details
        const user = await fetchZammad(`/users/${userId}`)
        const roles = user.role_ids?.map((id: number) => {
          if (id === 1) return 'Admin'
          if (id === 2) return 'Agent'
          if (id === 3) return 'Customer'
          return `Role${id}`
        }).join(', ')

        console.log(`User: ${user.email}`)
        console.log(`  Name: ${user.firstname} ${user.lastname}`)
        console.log(`  Roles: ${roles}`)
        console.log(`  Groups: ${user.group_ids ? Object.keys(user.group_ids).join(', ') : 'None'}`)
        console.log(`  Active: ${user.active}`)

        // Try to assign
        console.log(`  Attempting assignment...`)
        const updated = await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({ owner_id: userId }),
        })

        console.log(`  ✅ SUCCESS! Ticket assigned to user ${userId}`)
        console.log(`     New owner_id: ${updated.owner_id}`)

        // Revert assignment
        await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({ owner_id: 1 }),
        })
        console.log(`  (Reverted to unassigned)`)

      } catch (error: any) {
        console.log(`  ❌ FAILED: ${error.message}`)
      }
    }

    console.log('\n✅ Test completed!')

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

testAssignment()
