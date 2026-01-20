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
        body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #2563eb; padding: 24px 32px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">Ticket Received</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0;">Dear #{ticket.customer.firstname},</p>
              <p style="margin: 0 0 24px 0;">Thank you for contacting our support team. Your request has been received and assigned ticket number <strong>##{ticket.number}</strong>.</p>

              <!-- Ticket Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">Ticket Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0; color: #64748b; width: 100px;">Title:</td>
                        <td style="padding: 4px 0;">#{ticket.title}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #64748b;">Status:</td>
                        <td style="padding: 4px 0;">#{ticket.state.name}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #64748b;">Priority:</td>
                        <td style="padding: 4px 0;">#{ticket.priority.name}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px 0;">We will review your request and respond as soon as possible.</p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #2563eb; border-radius: 6px;">
                    <a href="#{config.http_type}://#{config.fqdn}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600;">Track Your Ticket</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #64748b;">Best regards,<br><strong>Howen Technology Support Team</strong></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">This is an automated message. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
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
        body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #059669; padding: 24px 32px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">Status Updated</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0;">Dear #{ticket.customer.firstname},</p>
              <p style="margin: 0 0 24px 0;">Your ticket <strong>##{ticket.number}</strong> status has been updated.</p>

              <!-- Status Badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px; text-align: center;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #047857; text-transform: uppercase; letter-spacing: 0.5px;">Current Status</p>
                    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #047857;">#{ticket.state.name}</p>
                  </td>
                </tr>
              </table>

              <!-- Ticket Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 8px 0; font-weight: 600; color: #334155;">Ticket Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0; color: #64748b; width: 100px;">Title:</td>
                        <td style="padding: 4px 0;">#{ticket.title}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #64748b;">Priority:</td>
                        <td style="padding: 4px 0;">#{ticket.priority.name}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #059669; border-radius: 6px;">
                    <a href="#{config.http_type}://#{config.fqdn}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600;">View Ticket</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #64748b;">Best regards,<br><strong>Howen Technology Support Team</strong></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">This is an automated message. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
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
        body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #7c3aed; padding: 24px 32px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">New Reply</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0;">Dear #{ticket.customer.firstname},</p>
              <p style="margin: 0 0 24px 0;">You have received a new reply on your ticket <strong>##{ticket.number}</strong>.</p>

              <!-- Reply Content Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf5ff; border-left: 4px solid #7c3aed; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <div style="color: #374151; white-space: pre-wrap;">#{article.body}</div>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #7c3aed; border-radius: 6px;">
                    <a href="#{config.http_type}://#{config.fqdn}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600;">View Full Conversation</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">You can reply to this email or click the button above to view the full conversation.</p>
              <p style="margin: 0; color: #64748b;">Best regards,<br><strong>Howen Technology Support Team</strong></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">This is an automated message from Howen Technology Support.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
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
