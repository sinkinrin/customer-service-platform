import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const ZAMMAD_URL = process.env.ZAMMAD_URL?.replace(/\/$/, '')
const ZAMMAD_API_TOKEN = process.env.ZAMMAD_API_TOKEN

async function addGroupPermissions() {
  console.log('=== Adding Missing Group Permissions to API Token User ===\n')

  try {
    // Get current user
    const currentUser = await fetch(`${ZAMMAD_URL}/api/v1/users/me`, {
      headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
    }).then(r => r.json())

    console.log(`Current User: ${currentUser.email} (ID: ${currentUser.id})`)
    console.log(`Current Groups: ${JSON.stringify(currentUser.group_ids)}\n`)

    // Check which groups are missing
    const allGroupIds = [1, 2, 3, 4, 5, 6, 7, 8]
    const currentGroupIds = currentUser.group_ids ? Object.keys(currentUser.group_ids).map(Number) : []
    const missingGroupIds = allGroupIds.filter(id => !currentGroupIds.includes(id))

    if (missingGroupIds.length === 0) {
      console.log('✅ User already has all 8 groups!')
      return
    }

    console.log(`Missing Groups: ${missingGroupIds.join(', ')}\n`)

    // Build new group_ids object with all 8 groups
    const newGroupIds: Record<string, string[]> = {}
    for (const groupId of allGroupIds) {
      newGroupIds[groupId.toString()] = ['full']
    }

    console.log('New group_ids configuration:')
    console.log(JSON.stringify(newGroupIds, null, 2))
    console.log()

    // Update user
    console.log('Updating user...')
    const updateRes = await fetch(`${ZAMMAD_URL}/api/v1/users/${currentUser.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        group_ids: newGroupIds
      })
    })

    if (!updateRes.ok) {
      const errorText = await updateRes.text()
      console.log(`❌ Failed to update: ${updateRes.status} - ${errorText}`)
      return
    }

    const updated = await updateRes.json()
    console.log('✅ SUCCESS! User updated')
    console.log(`New Groups: ${JSON.stringify(updated.group_ids)}`)

    // Verify we can now access group 6
    console.log('\n--- Verification: Testing Group 6 Access ---')

    const tickets = await fetch(`${ZAMMAD_URL}/api/v1/tickets?per_page=1`, {
      headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
    }).then(r => r.json())

    if (tickets.length > 0) {
      const ticket = tickets[0]
      const originalGroupId = ticket.group_id

      // Try moving to group 6
      const groups = await fetch(`${ZAMMAD_URL}/api/v1/groups`, {
        headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
      }).then(r => r.json())

      const group6 = groups.find((g: any) => g.id === 6)

      console.log(`Attempting to move ticket #${ticket.number} to Group 6 (${group6.name})...`)

      const testRes = await fetch(`${ZAMMAD_URL}/api/v1/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ group: group6.name })
      })

      if (testRes.ok) {
        const testUpdated = await testRes.json()
        console.log(`✅ SUCCESS! Moved to Group ${testUpdated.group_id}`)

        // Revert
        const origGroup = groups.find((g: any) => g.id === originalGroupId)
        await fetch(`${ZAMMAD_URL}/api/v1/tickets/${ticket.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ group: origGroup.name })
        })
        console.log('(Reverted to original group)')
      } else {
        const errorText = await testRes.text()
        console.log(`❌ Still failing: ${testRes.status} - ${errorText}`)
      }
    }

    console.log('\n✅ Group permissions update completed!')

  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

addGroupPermissions()
