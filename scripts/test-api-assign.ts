/**
 * Test Admin Assignment via Next.js API
 * This tests the /api/tickets/[id]/assign endpoint with auto-group-change
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const API_URL = 'http://localhost:3010'
const ZAMMAD_URL = process.env.ZAMMAD_URL?.replace(/\/$/, '')
const ZAMMAD_API_TOKEN = process.env.ZAMMAD_API_TOKEN

if (!ZAMMAD_URL || !ZAMMAD_API_TOKEN) {
  console.error('❌ ZAMMAD_URL and ZAMMAD_API_TOKEN must be set')
  process.exit(1)
}

// Helper to call Zammad API directly
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

// Helper to call our Next.js API
async function callAssignAPI(ticketId: number, staffId: number, groupId?: number) {
  const body: any = { staff_id: staffId }
  if (groupId) {
    body.group_id = groupId
  }

  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/assign`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      // Mock auth cookie for admin@test.com
      'Cookie': 'mock-auth-email=admin@test.com; mock-auth-role=admin',
    },
    body: JSON.stringify(body),
  })

  const result = await response.json()
  return { ok: response.ok, status: response.status, result }
}

async function testAPIAssignment() {
  console.log('=== Testing Admin Assignment via Next.js API ===\n')

  try {
    // Get a test ticket
    console.log('📋 Finding a test ticket...')
    const tickets = await fetchZammad('/tickets?per_page=10')
    const testTicket = tickets.find((t: any) => t.owner_id === 1) || tickets[0]

    if (!testTicket) {
      console.log('❌ No tickets found for testing')
      return
    }

    console.log(`✅ Using ticket #${testTicket.number} (ID: ${testTicket.id})`)
    console.log(`   Current Group: ${testTicket.group_id}`)
    console.log(`   Current Owner: ${testTicket.owner_id}\n`)

    const originalGroupId = testTicket.group_id
    const originalOwnerId = testTicket.owner_id

    // Test 1: Assign to staff in SAME region via API
    console.log('=== Test 1: Assign to Staff in SAME Region (via API) ===')

    const sameGroupStaff = await findStaffInGroup(originalGroupId)
    if (sameGroupStaff) {
      console.log(`👤 Assigning to ${sameGroupStaff.email} (ID: ${sameGroupStaff.id})`)

      const { ok, status, result } = await callAssignAPI(testTicket.id, sameGroupStaff.id)

      if (ok && result.success) {
        console.log(`✅ SUCCESS!`)
        console.log(`   Response: ${JSON.stringify(result.data.ticket, null, 2)}`)

        // Verify
        const updated = await fetchZammad(`/tickets/${testTicket.id}`)
        console.log(`   Verified - Owner: ${updated.owner_id}, Group: ${updated.group_id}`)

        // Revert
        await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({ owner_id: 1 })
        })
        console.log(`   (Reverted)\n`)
      } else {
        console.log(`❌ FAILED: ${status} - ${result.error?.message || JSON.stringify(result)}`)
      }
    } else {
      console.log(`⚠️  No staff found in Group ${originalGroupId}\n`)
    }

    // Test 2: Assign to staff in DIFFERENT region via API (should auto-change group)
    console.log('=== Test 2: Assign to Staff in DIFFERENT Region (via API) ===')

    const diffGroupStaff = await findStaffInDifferentGroup(originalGroupId)
    if (diffGroupStaff) {
      const staffGroups = diffGroupStaff.group_ids ? Object.keys(diffGroupStaff.group_ids) : []
      console.log(`👤 Assigning to ${diffGroupStaff.email} (ID: ${diffGroupStaff.id})`)
      console.log(`   Staff has groups: ${staffGroups.join(', ')}`)
      console.log(`   Ticket is in group: ${originalGroupId}`)
      console.log(`   Expected: Auto-change to Group ${staffGroups[0]}`)

      const { ok, status, result } = await callAssignAPI(testTicket.id, diffGroupStaff.id)

      if (ok && result.success) {
        console.log(`✅ SUCCESS!`)
        console.log(`   Response: ${JSON.stringify(result.data.ticket, null, 2)}`)

        // Verify
        const updated = await fetchZammad(`/tickets/${testTicket.id}`)
        console.log(`   Verified - Owner: ${updated.owner_id}, Group: ${originalGroupId} → ${updated.group_id}`)

        if (updated.group_id.toString() === staffGroups[0]) {
          console.log(`   ✅ Group auto-changed correctly!`)
        } else {
          console.log(`   ⚠️  Group is ${updated.group_id}, expected ${staffGroups[0]}`)
        }

        // Revert
        const group = await fetchZammad(`/groups/${originalGroupId}`)
        await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({ owner_id: originalOwnerId, group: group.name })
        })
        console.log(`   (Reverted)\n`)
      } else {
        console.log(`❌ FAILED: ${status}`)
        console.log(`   Error: ${result.error?.message || JSON.stringify(result)}\n`)
      }
    } else {
      console.log(`⚠️  No staff found in different group\n`)
    }

    // Test 3: Assign to Admin user via API
    console.log('=== Test 3: Assign to Admin User (via API) ===')
    console.log(`👤 Assigning to admin@test.com (ID: 37)`)

    const { ok, status, result } = await callAssignAPI(testTicket.id, 37)

    if (ok && result.success) {
      console.log(`✅ SUCCESS!`)
      console.log(`   Response: ${JSON.stringify(result.data.ticket, null, 2)}`)

      // Verify
      const updated = await fetchZammad(`/tickets/${testTicket.id}`)
      console.log(`   Verified - Owner: ${updated.owner_id}, Group: ${updated.group_id}`)

      // Revert
      await fetchZammad(`/tickets/${testTicket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ owner_id: originalOwnerId })
      })
      console.log(`   (Reverted)\n`)
    } else {
      console.log(`❌ FAILED: ${status} - ${result.error?.message || JSON.stringify(result)}\n`)
    }

    console.log('✅ All API tests completed!')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
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

testAPIAssignment()
