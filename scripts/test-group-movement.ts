import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const ZAMMAD_URL = process.env.ZAMMAD_URL?.replace(/\/$/, '')
const ZAMMAD_API_TOKEN = process.env.ZAMMAD_API_TOKEN

async function testGroupMovement() {
  console.log('=== Testing Ticket Group Movement ===\n')

  try {
    // Get current user (API token owner)
    const currentUser = await fetch(`${ZAMMAD_URL}/api/v1/users/me`, {
      headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
    }).then(r => r.json())

    console.log('API Token User:', currentUser.email, `(ID: ${currentUser.id})`)
    console.log('Roles:', currentUser.role_ids)
    console.log('Groups:', JSON.stringify(currentUser.group_ids))

    // Get all groups
    const groups = await fetch(`${ZAMMAD_URL}/api/v1/groups`, {
      headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
    }).then(r => r.json())

    // Get a test ticket
    const tickets = await fetch(`${ZAMMAD_URL}/api/v1/tickets?per_page=5`, {
      headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
    }).then(r => r.json())

    if (tickets.length === 0) {
      console.log('No tickets found')
      return
    }

    const ticket = tickets[0]
    console.log(`\nTest Ticket: #${ticket.number} (ID: ${ticket.id})`)
    console.log(`Current Group: ${ticket.group_id}`)
    console.log(`Current Owner: ${ticket.owner_id}`)

    const originalGroupId = ticket.group_id
    const originalOwnerId = ticket.owner_id

    // Try moving to different groups
    console.log('\n--- Testing Group Movements ---')

    for (const targetGroup of groups) {
      if (targetGroup.id === originalGroupId) continue

      console.log(`\nTrying to move to Group ${targetGroup.id} (${targetGroup.name})...`)

      try {
        const updateRes = await fetch(`${ZAMMAD_URL}/api/v1/tickets/${ticket.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            group: targetGroup.name
          })
        })

        if (updateRes.ok) {
          const updated = await updateRes.json()
          console.log(`✅ SUCCESS! Moved from ${originalGroupId} to ${updated.group_id}`)

          // Revert immediately
          const origGroup = groups.find((g: any) => g.id === originalGroupId)
          await fetch(`${ZAMMAD_URL}/api/v1/tickets/${ticket.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ group: origGroup.name })
          })
          console.log(`(Reverted to ${origGroup.name})`)
        } else {
          const errorText = await updateRes.text()
          console.log(`❌ FAILED: ${updateRes.status} - ${errorText}`)
        }
      } catch (error: any) {
        console.log(`❌ ERROR: ${error.message}`)
      }

      // Only test first 3 to avoid too many requests
      if (groups.indexOf(targetGroup) >= 2) break
    }

    // Now test with owner_id change at the same time
    console.log('\n\n--- Testing Group + Owner Change Together ---')

    // Find a staff member in group 6
    const users = await fetch(`${ZAMMAD_URL}/api/v1/users/search?query=*&limit=100`, {
      headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
    }).then(r => r.json())

    const group6Staff = users.find((u: any) =>
      u.active &&
      u.role_ids?.includes(2) &&
      u.group_ids &&
      Object.keys(u.group_ids).includes('6')
    )

    if (group6Staff) {
      console.log(`\nTrying to change group to 6 AND assign to ${group6Staff.email} (ID: ${group6Staff.id})...`)

      const group6 = groups.find((g: any) => g.id === 6)

      try {
        const updateRes = await fetch(`${ZAMMAD_URL}/api/v1/tickets/${ticket.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            group: group6.name,
            owner_id: group6Staff.id
          })
        })

        if (updateRes.ok) {
          const updated = await updateRes.json()
          console.log(`✅ SUCCESS!`)
          console.log(`   Group: ${originalGroupId} → ${updated.group_id}`)
          console.log(`   Owner: ${originalOwnerId} → ${updated.owner_id}`)

          // Revert
          const origGroup = groups.find((g: any) => g.id === originalGroupId)
          await fetch(`${ZAMMAD_URL}/api/v1/tickets/${ticket.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              group: origGroup.name,
              owner_id: originalOwnerId
            })
          })
          console.log(`(Reverted)`)
        } else {
          const errorText = await updateRes.text()
          console.log(`❌ FAILED: ${updateRes.status} - ${errorText}`)
        }
      } catch (error: any) {
        console.log(`❌ ERROR: ${error.message}`)
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

testGroupMovement()
