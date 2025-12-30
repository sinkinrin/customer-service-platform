/**
 * Setup Email Notification Triggers in Zammad
 * 
 * This script configures automatic email notifications for:
 * 1. New ticket creation - notify customer
 * 2. Ticket status changes - notify customer (excluding urgent priority)
 * 3. New replies/articles on tickets - notify customer (excluding urgent priority)
 * 
 * Usage: npx tsx scripts/setup-email-triggers.ts
 */

import { zammadClient } from '../src/lib/zammad/client'
import type { CreateTriggerRequest, ZammadTrigger } from '../src/lib/zammad/types'

// Email template variables available in Zammad:
// #{ticket.id} - Ticket ID
// #{ticket.number} - Ticket number
// #{ticket.title} - Ticket title
// #{ticket.state.name} - Ticket state name
// #{ticket.priority.name} - Ticket priority name
// #{ticket.customer.firstname} - Customer first name
// #{ticket.customer.lastname} - Customer last name
// #{ticket.customer.email} - Customer email
// #{article.body} - Latest article body
// #{config.http_type}://#{config.fqdn} - System URL

const TRIGGER_PREFIX = '[CSP]' // Customer Service Platform prefix

interface TriggerConfig {
  name: string
  description: string
  condition: CreateTriggerRequest['condition']
  perform: CreateTriggerRequest['perform']
}

/**
 * Define all email notification triggers
 */
const emailTriggers: TriggerConfig[] = [
  // 1. New ticket notification to customer
  {
    name: `${TRIGGER_PREFIX} New Ticket Confirmation`,
    description: 'Send confirmation email when a new ticket is created',
    condition: {
      'ticket.action': {
        operator: 'is',
        value: 'create',
      },
    },
    perform: {
      'notification.email': {
        recipient: 'ticket_customer',
        subject: 'Your ticket ##{ticket.number} has been received - #{ticket.title}',
        body: `Dear #{ticket.customer.firstname},

Thank you for contacting our support team. Your request has been received and assigned ticket number ##{ticket.number}.

**Ticket Details:**
- Title: #{ticket.title}
- Status: #{ticket.state.name}
- Priority: #{ticket.priority.name}

We will review your request and respond as soon as possible.

You can track your ticket status at: #{config.http_type}://#{config.fqdn}

Best regards,
Howen Technology Support Team`,
      },
    },
  },

  // 2. Ticket status change notification (excluding urgent)
  {
    name: `${TRIGGER_PREFIX} Status Change Notification`,
    description: 'Notify customer when ticket status changes (excluding urgent priority)',
    condition: {
      'ticket.action': {
        operator: 'is',
        value: 'update',
      },
      'ticket.state_id': {
        operator: 'is not',
        value: '', // Will be updated to exclude only internal state changes
      },
      'ticket.priority_id': {
        operator: 'is not',
        value: '3', // Exclude urgent priority (priority_id 3 is typically "urgent" in Zammad)
      },
    },
    perform: {
      'notification.email': {
        recipient: 'ticket_customer',
        subject: 'Ticket ##{ticket.number} status updated - #{ticket.title}',
        body: `Dear #{ticket.customer.firstname},

Your ticket ##{ticket.number} status has been updated.

**Current Status:** #{ticket.state.name}

**Ticket Details:**
- Title: #{ticket.title}
- Priority: #{ticket.priority.name}

You can view your ticket at: #{config.http_type}://#{config.fqdn}

Best regards,
Howen Technology Support Team`,
      },
    },
  },

  // 3. New reply/article notification to customer (excluding urgent and internal notes)
  {
    name: `${TRIGGER_PREFIX} New Reply Notification`,
    description: 'Notify customer when staff replies to ticket (excluding high/urgent priority)',
    condition: {
      'ticket.action': {
        operator: 'is',
        value: 'update',
      },
      'article.sender_id': {
        operator: 'is',
        value: 'Agent', // Agent sender
      },
      'article.internal': {
        operator: 'is',
        value: 'false',
      },
      'ticket.priority_id': {
        operator: 'is not',
        value: '3', // Exclude high/urgent priority (priority 3 = high in Zammad)
      },
    },
    perform: {
      'notification.email': {
        recipient: 'ticket_customer',
        subject: 'New reply on ticket ##{ticket.number} - #{ticket.title}',
        body: `Dear #{ticket.customer.firstname},

You have received a new reply on your ticket ##{ticket.number}.

---
#{article.body}
---

You can reply to this email or view the full conversation at: #{config.http_type}://#{config.fqdn}

Best regards,
Howen Technology Support Team`,
        include_attachments: 'true',
      },
    },
  },
]

/**
 * Create or update a trigger
 */
async function ensureTrigger(config: TriggerConfig): Promise<ZammadTrigger> {
  const { name, description, condition, perform } = config

  // Check if trigger already exists
  const existingTrigger = await zammadClient.findTriggerByName(name)

  if (existingTrigger) {
    console.log(`  Updating existing trigger: ${name}`)
    return zammadClient.updateTrigger(existingTrigger.id, {
      condition,
      perform,
      active: true,
      note: description,
    })
  }

  console.log(`  Creating new trigger: ${name}`)
  return zammadClient.createTrigger({
    name,
    condition,
    perform,
    active: true,
    note: description,
  })
}

/**
 * List all existing triggers
 */
async function listTriggers(): Promise<void> {
  console.log('\n📋 Existing Triggers:')
  const triggers = await zammadClient.getTriggers()
  
  if (triggers.length === 0) {
    console.log('  No triggers found')
    return
  }

  triggers.forEach(t => {
    const status = t.active ? '✅' : '❌'
    const csp = t.name.startsWith(TRIGGER_PREFIX) ? '[CSP]' : ''
    console.log(`  ${status} ${t.name} ${csp}`)
  })
}

/**
 * Main setup function
 */
async function main() {
  console.log('🔧 Setting up Email Notification Triggers in Zammad\n')

  try {
    // Test connection first
    console.log('📡 Testing Zammad connection...')
    await zammadClient.getTriggers()
    console.log('  ✅ Connected to Zammad\n')

    // List existing triggers
    await listTriggers()

    // Create/update triggers
    console.log('\n📧 Configuring Email Triggers:')
    for (const config of emailTriggers) {
      try {
        const trigger = await ensureTrigger(config)
        console.log(`    ✅ ${trigger.name} (ID: ${trigger.id})`)
      } catch (error) {
        console.error(`    ❌ Failed to configure: ${config.name}`)
        console.error(`       Error: ${error instanceof Error ? error.message : error}`)
      }
    }

    // List triggers after setup
    console.log('\n')
    await listTriggers()

    console.log('\n✨ Email notification triggers setup complete!')
    console.log('\nNote: Triggers will send emails based on the configured conditions.')
    console.log('Urgent priority tickets are excluded from automatic notifications.')

  } catch (error) {
    console.error('❌ Setup failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run the setup
main()
