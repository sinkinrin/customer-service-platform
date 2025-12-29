/**
 * Verify specific user IDs that are failing assignment
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

async function verifyUsers() {
  console.log('=== Verifying User IDs 18 and 24 ===\n')

  const problematicUserIds = [18, 24]

  try {
    for (const userId of problematicUserIds) {
      console.log(`\n--- Checking User ID ${userId} ---`)

      try {
        const user = await fetchZammad(`/users/${userId}`)

        const roles = user.role_ids?.map((id: number) => {
          if (id === 1) return 'Admin'
          if (id === 2) return 'Agent'
          if (id === 3) return 'Customer'
          return `Role${id}`
        }).join(', ') || 'No roles'

        const groupIds = user.group_ids ? Object.keys(user.group_ids).join(', ') : 'None'
        const permissions = user.group_ids ? JSON.stringify(user.group_ids, null, 2) : 'None'

        console.log(`Email: ${user.email}`)
        console.log(`Name: ${user.firstname} ${user.lastname}`)
        console.log(`Roles (role_ids): ${JSON.stringify(user.role_ids)} => ${roles}`)
        console.log(`Active: ${user.active}`)
        console.log(`Groups: ${groupIds}`)
        console.log(`Group Permissions:\n${permissions}`)
        console.log(`Out of Office: ${user.out_of_office || false}`)
        console.log(`Login: ${user.login}`)
        console.log(`Created At: ${user.created_at}`)
        console.log(`Updated At: ${user.updated_at}`)

        // Check if user is really an agent
        const isAgent = user.role_ids?.includes(2) || user.roles?.includes('Agent')
        console.log(`\n✅ Is Agent: ${isAgent}`)

        if (!user.active) {
          console.log('❌ WARNING: User is INACTIVE!')
        }

        if (!isAgent) {
          console.log('❌ WARNING: User is NOT an Agent!')
        }

      } catch (error: any) {
        console.log(`❌ ERROR: ${error.message}`)
      }
    }

    // Now test actual assignment
    console.log('\n\n=== Testing Actual Assignment ===\n')

    // Get a test ticket
    const tickets = await fetchZammad('/tickets?per_page=1')
    if (tickets.length === 0) {
      console.log('⚠️  No tickets found for testing')
      return
    }

    const testTicket = tickets[0]
    console.log(`Test Ticket: #${testTicket.number} (ID: ${testTicket.id})`)
    console.log(`Current Owner ID: ${testTicket.owner_id}`)
    console.log(`Group ID: ${testTicket.group_id}\n`)

    for (const userId of problematicUserIds) {
      console.log(`\n--- Attempting to assign to User ID ${userId} ---`)

      try {
        const updated = await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({ owner_id: userId }),
        })

        console.log(`✅ SUCCESS! Assigned to user ${userId}`)
        console.log(`   New owner_id: ${updated.owner_id}`)

        // Revert
        await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({ owner_id: 1 }),
        })
        console.log(`   (Reverted to unassigned)`)

      } catch (error: any) {
        console.log(`❌ FAILED: ${error.message}`)
      }
    }

    console.log('\n✅ Verification completed!')

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

verifyUsers()
