import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const ZAMMAD_URL = process.env.ZAMMAD_URL?.replace(/\/$/, '')
const ZAMMAD_API_TOKEN = process.env.ZAMMAD_API_TOKEN

async function debugGroupAPI() {
  console.log('=== Debugging Group API ===\n')

  try {
    // 1. Get user 22 (staff.na@test.com) to see their group_ids format
    console.log('1. Checking User 22 (staff.na@test.com)...')
    const userRes = await fetch(`${ZAMMAD_URL}/api/v1/users/22`, {
      headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
    })
    const user = await userRes.json()
    console.log('   group_ids:', user.group_ids)
    console.log('   group_ids type:', typeof user.group_ids)
    console.log('   group_ids keys:', user.group_ids ? Object.keys(user.group_ids) : 'none')

    // 2. Try to get group 6
    console.log('\n2. Trying to get Group 6...')
    const groupRes = await fetch(`${ZAMMAD_URL}/api/v1/groups/6`, {
      headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
    })

    if (!groupRes.ok) {
      const errorText = await groupRes.text()
      console.log(`   ❌ Failed: ${groupRes.status} ${errorText}`)
    } else {
      const group = await groupRes.json()
      console.log(`   ✅ Success:`, JSON.stringify(group, null, 2))
    }

    // 3. Get all groups to see what's available
    console.log('\n3. Getting all groups...')
    const groupsRes = await fetch(`${ZAMMAD_URL}/api/v1/groups`, {
      headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
    })
    const groups = await groupsRes.json()
    console.log('   Available groups:')
    groups.forEach((g: any) => {
      console.log(`   - ID ${g.id}: ${g.name} (active: ${g.active})`)
    })

    // 4. Check if we can update a ticket's group using group_id vs group name
    console.log('\n4. Testing ticket update formats...')
    const ticketsRes = await fetch(`${ZAMMAD_URL}/api/v1/tickets?per_page=1`, {
      headers: { 'Authorization': `Token token=${ZAMMAD_API_TOKEN}` }
    })
    const tickets = await ticketsRes.json()

    if (tickets.length > 0) {
      const ticket = tickets[0]
      console.log(`   Using ticket #${ticket.number} (ID: ${ticket.id})`)
      console.log(`   Current group_id: ${ticket.group_id}`)

      // Try updating with group name (this should work based on previous code)
      const group6 = groups.find((g: any) => g.id === 6)
      if (group6) {
        console.log(`\n   Attempting to update with group name: "${group6.name}"`)
        const updateRes = await fetch(`${ZAMMAD_URL}/api/v1/tickets/${ticket.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ group: group6.name })
        })

        if (updateRes.ok) {
          const updated = await updateRes.json()
          console.log(`   ✅ Success! New group_id: ${updated.group_id}`)

          // Revert
          const origGroup = groups.find((g: any) => g.id === ticket.group_id)
          if (origGroup) {
            await fetch(`${ZAMMAD_URL}/api/v1/tickets/${ticket.id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ group: origGroup.name })
            })
            console.log(`   (Reverted to ${origGroup.name})`)
          }
        } else {
          const errorText = await updateRes.text()
          console.log(`   ❌ Failed: ${updateRes.status} ${errorText}`)
        }
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

debugGroupAPI()
