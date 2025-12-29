/**
 * Test Admin Assignment Functionality
 * Verify that admin can assign tickets cross-region with auto-group-change
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

async function testAdminAssignment() {
  console.log('=== Testing Admin Ticket Assignment with Auto-Group-Change ===\n')

  try {
    // Get a test ticket (any unassigned ticket)
    console.log('📋 Finding a test ticket...')
    const tickets = await fetchZammad('/tickets?per_page=10')

    let testTicket = tickets.find((t: any) => t.owner_id === 1) // Unassigned ticket
    if (!testTicket && tickets.length > 0) {
      testTicket = tickets[0] // Use any ticket
    }

    if (!testTicket) {
      console.log('⚠️  No tickets found for testing. Creating a new ticket...')

      // Create a test ticket in Group 1 (Africa)
      testTicket = await fetchZammad('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Ticket for Admin Assignment',
          group: '非洲 Users', // Group 1
          customer_id: 7, // customer@test.com
          article: {
            subject: 'Test Ticket for Admin Assignment',
            body: 'This is a test ticket to verify admin can assign cross-region tickets',
            type: 'note',
            internal: true,
          }
        })
      })
      console.log(`✅ Created test ticket #${testTicket.number} (ID: ${testTicket.id}) in Group ${testTicket.group_id}`)
    } else {
      console.log(`✅ Using ticket #${testTicket.number} (ID: ${testTicket.id}) in Group ${testTicket.group_id}`)
    }

    const originalGroupId = testTicket.group_id
    const originalOwnerId = testTicket.owner_id

    console.log(`\n--- Test Scenario Setup ---`)
    console.log(`Ticket: #${testTicket.number} (ID: ${testTicket.id})`)
    console.log(`Current Group: ${testTicket.group_id}`)
    console.log(`Current Owner: ${testTicket.owner_id}`)

    // Test 1: Assign to staff in SAME region (should work directly)
    console.log('\n\n=== Test 1: Assign to Staff in SAME Region ===')

    // Find a staff member in the same group
    const sameGroupStaff = await findStaffInGroup(originalGroupId)
    if (sameGroupStaff) {
      console.log(`👤 Assigning to ${sameGroupStaff.email} (ID: ${sameGroupStaff.id}) who has Group ${originalGroupId}`)

      try {
        const result1 = await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({ owner_id: sameGroupStaff.id })
        })
        console.log(`✅ SUCCESS! Assigned to ${sameGroupStaff.email}`)
        console.log(`   Owner ID: ${result1.owner_id}, Group ID: ${result1.group_id}`)

        // Revert
        await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({ owner_id: 1 })
        })
        console.log(`   (Reverted to unassigned)`)
      } catch (error: any) {
        console.log(`❌ FAILED: ${error.message}`)
      }
    } else {
      console.log(`⚠️  No staff found in Group ${originalGroupId}, skipping test 1`)
    }

    // Test 2: Assign to staff in DIFFERENT region (should auto-change group)
    console.log('\n\n=== Test 2: Assign to Staff in DIFFERENT Region (Auto-Group-Change) ===')

    // Find a staff member in a different group
    const diffGroupStaff = await findStaffInDifferentGroup(originalGroupId)
    if (diffGroupStaff) {
      const staffGroups = diffGroupStaff.group_ids ? Object.keys(diffGroupStaff.group_ids) : []
      console.log(`👤 Assigning to ${diffGroupStaff.email} (ID: ${diffGroupStaff.id})`)
      console.log(`   Staff has groups: ${staffGroups.join(', ')}`)
      console.log(`   Ticket is in group: ${originalGroupId}`)
      console.log(`   Expected: Auto-change ticket to Group ${staffGroups[0]}`)

      try {
        const result2 = await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({ owner_id: diffGroupStaff.id })
        })
        console.log(`✅ SUCCESS! Ticket assigned and moved`)
        console.log(`   Owner ID: ${result2.owner_id}`)
        console.log(`   Group ID: ${originalGroupId} → ${result2.group_id}`)

        if (result2.group_id.toString() === staffGroups[0]) {
          console.log(`   ✅ Group changed correctly to staff's group!`)
        } else {
          console.log(`   ⚠️  Group is ${result2.group_id}, expected ${staffGroups[0]}`)
        }

        // Revert
        const group1 = await fetchZammad('/groups/1')
        await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            owner_id: originalOwnerId,
            group: group1.name
          })
        })
        console.log(`   (Reverted ticket to original state)`)
      } catch (error: any) {
        console.log(`❌ FAILED: ${error.message}`)
      }
    } else {
      console.log(`⚠️  No staff found in different group, skipping test 2`)
    }

    // Test 3: Assign to Admin user (should work for any group)
    console.log('\n\n=== Test 3: Assign to Admin User ===')

    // User 37 is admin@test.com (Admin)
    console.log(`👤 Assigning to admin@test.com (ID: 37, Admin role)`)

    try {
      const admin = await fetchZammad('/users/37')
      console.log(`   Admin has groups: ${Object.keys(admin.group_ids || {}).join(', ')}`)

      const result3 = await fetchZammad(`/tickets/${testTicket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ owner_id: 37 })
      })
      console.log(`✅ SUCCESS! Assigned to admin`)
      console.log(`   Owner ID: ${result3.owner_id}`)
      console.log(`   Group ID: ${result3.group_id} (unchanged)`)

      // Revert
      await fetchZammad(`/tickets/${testTicket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ owner_id: originalOwnerId })
      })
      console.log(`   (Reverted to original owner)`)
    } catch (error: any) {
      console.log(`❌ FAILED: ${error.message}`)
    }

    console.log('\n\n✅ All tests completed!')

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

async function findStaffInGroup(groupId: number) {
  const users = await fetchZammad('/users/search?query=*&limit=100')
  return users.find((u: any) =>
    u.active &&
    u.role_ids?.includes(2) && // Agent role
    u.group_ids &&
    Object.keys(u.group_ids).includes(groupId.toString())
  )
}

async function findStaffInDifferentGroup(excludeGroupId: number) {
  const users = await fetchZammad('/users/search?query=*&limit=100')
  return users.find((u: any) =>
    u.active &&
    u.role_ids?.includes(2) && // Agent role
    !u.role_ids?.includes(1) && // Not admin
    u.group_ids &&
    Object.keys(u.group_ids).length > 0 &&
    !Object.keys(u.group_ids).includes(excludeGroupId.toString())
  )
}

testAdminAssignment()
