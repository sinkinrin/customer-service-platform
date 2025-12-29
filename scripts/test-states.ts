/**
 * Test State ID Updates
 * Check which state_id values are valid for updating tickets
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

async function testStateUpdates() {
  console.log('=== Testing State ID Updates ===\n')

  try {
    // Get all ticket states
    console.log('📋 Fetching ticket states...\n')
    const states = await fetchZammad('/ticket_states')

    console.log('Available States:')
    states.forEach((state: any) => {
      console.log(`  ID: ${state.id}, Name: ${state.name}, Type: ${state.state_type_id}, Default Create: ${state.default_create}, Default Follow Up: ${state.default_follow_up}, Active: ${state.active}`)
    })

    // Get a test ticket
    console.log('\n📋 Fetching test ticket...')
    const tickets = await fetchZammad('/tickets?per_page=5')

    if (tickets.length === 0) {
      console.log('⚠️  No tickets found')
      return
    }

    const testTicket = tickets.find((t: any) => t.state_id !== 4) || tickets[0]
    console.log(`\nTest Ticket: #${testTicket.number} (ID: ${testTicket.id})`)
    console.log(`  Current State ID: ${testTicket.state_id}`)
    console.log(`  Title: ${testTicket.title}`)

    // Test updating to each state
    const testStateIds = [1, 2, 3, 4, 6]

    for (const stateId of testStateIds) {
      const state = states.find((s: any) => s.id === stateId)
      console.log(`\n--- Testing state_id: ${stateId} (${state?.name}) ---`)

      try {
        const updated = await fetchZammad(`/tickets/${testTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({ state_id: stateId }),
        })

        console.log(`  ✅ SUCCESS! Updated to state_id: ${updated.state_id}`)

        // Wait a bit before next update
        await new Promise(resolve => setTimeout(resolve, 500))
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

testStateUpdates()
