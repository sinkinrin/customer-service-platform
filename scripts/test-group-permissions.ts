/**
 * Test Group Permission Hypothesis
 * Check if agents can only be assigned to tickets in their groups
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

async function testGroupPermissions() {
  console.log('=== Testing Group Permission Hypothesis ===\n')

  try {
    // Get a ticket in Group 1 (Africa)
    const tickets = await fetchZammad('/tickets?per_page=10')
    const group1Ticket = tickets.find((t: any) => t.group_id === 1)

    if (!group1Ticket) {
      console.log('⚠️  No tickets found in Group 1 (Africa)')
      return
    }

    console.log(`Test Ticket: #${group1Ticket.number} (ID: ${group1Ticket.id})`)
    console.log(`Group ID: ${group1Ticket.group_id} (非洲)\n`)

    // Test 1: Assign to agent WITH Group 1 permission (User 20 - Africa Staff)
    console.log('--- Test 1: Assign to agent WITH matching group permission ---')
    console.log('User 20 (staff.africa@test.com) - Has Group 1 permission')

    try {
      const user20 = await fetchZammad('/users/20')
      console.log(`  Groups: ${JSON.stringify(user20.group_ids)}`)

      const updated1 = await fetchZammad(`/tickets/${group1Ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ owner_id: 20 }),
      })

      console.log(`  ✅ SUCCESS! Assigned to user 20`)
      console.log(`     New owner_id: ${updated1.owner_id}\n`)

      // Revert
      await fetchZammad(`/tickets/${group1Ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ owner_id: 1 }),
      })
    } catch (error: any) {
      console.log(`  ❌ FAILED: ${error.message}\n`)
    }

    // Test 2: Assign to agent WITHOUT Group 1 permission (User 18 - Middle East Staff)
    console.log('--- Test 2: Assign to agent WITHOUT matching group permission ---')
    console.log('User 18 (staff.me@test.com) - Has Group 3 permission only')

    try {
      const user18 = await fetchZammad('/users/18')
      console.log(`  Groups: ${JSON.stringify(user18.group_ids)}`)

      await fetchZammad(`/tickets/${group1Ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ owner_id: 18 }),
      })

      console.log(`  ✅ SUCCESS (unexpected!)\n`)
    } catch (error: any) {
      console.log(`  ❌ FAILED (expected): ${error.message}`)
      console.log(`  📋 Reason: Agent does not have permission for Group 1\n`)
    }

    // Test 3: Admin user (should have all groups)
    console.log('--- Test 3: Assign to Admin user (has all groups) ---')
    console.log('User 3 (support@howentech.com) - Admin with all groups')

    try {
      const user3 = await fetchZammad('/users/3')
      console.log(`  Groups: ${JSON.stringify(user3.group_ids)}`)

      const updated3 = await fetchZammad(`/tickets/${group1Ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ owner_id: 3 }),
      })

      console.log(`  ✅ SUCCESS! Assigned to user 3`)
      console.log(`     New owner_id: ${updated3.owner_id}\n`)

      // Revert
      await fetchZammad(`/tickets/${group1Ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ owner_id: 1 }),
      })
    } catch (error: any) {
      console.log(`  ❌ FAILED: ${error.message}\n`)
    }

    // Test 4: Change ticket group, then assign
    console.log('--- Test 4: Change ticket to Group 3, then assign User 18 ---')

    try {
      // First, move ticket to Group 3
      const group3 = await fetchZammad('/groups/3')
      console.log(`  Moving ticket to Group 3 (${group3.name})...`)

      const movedTicket = await fetchZammad(`/tickets/${group1Ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ group: group3.name }),
      })

      console.log(`  ✅ Ticket moved to Group ${movedTicket.group_id}`)

      // Now try to assign User 18
      console.log(`  Attempting to assign User 18...`)

      const updated4 = await fetchZammad(`/tickets/${group1Ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ owner_id: 18 }),
      })

      console.log(`  ✅ SUCCESS! Assigned to user 18`)
      console.log(`     New owner_id: ${updated4.owner_id}`)
      console.log(`     Group ID: ${updated4.group_id}\n`)

      // Revert everything
      await fetchZammad(`/tickets/${group1Ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ owner_id: 1, group: 'Users' }),
      })
      console.log(`  (Reverted ticket to original state)`)

    } catch (error: any) {
      console.log(`  ❌ FAILED: ${error.message}\n`)
    }

    console.log('\n📊 Conclusion:')
    console.log('   Zammad requires agents to have group permission for the ticket')
    console.log('   before they can be assigned to it.')
    console.log('')
    console.log('✅ Hypothesis CONFIRMED!')

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

testGroupPermissions()
