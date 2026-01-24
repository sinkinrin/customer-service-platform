/**
 * Setup Default Email Notification Triggers API
 * 
 * POST /api/admin/triggers/setup - Initialize default email notification triggers
 * 
 * This endpoint creates the standard email notification triggers for:
 * 1. New ticket confirmation
 * 2. Status change notification (excluding high priority)
 * 3. New reply notification (excluding high priority)
 */

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { logger } from '@/lib/utils/logger'
import type { CreateTriggerRequest, ZammadTrigger } from '@/lib/zammad/types'

const TRIGGER_PREFIX = '[CSP]' // Customer Service Platform prefix

interface TriggerConfig {
  name: string
  description: string
  condition: CreateTriggerRequest['condition']
  perform: CreateTriggerRequest['perform']
}

const defaultTriggers: TriggerConfig[] = [
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

  // 2. Ticket status change notification (excluding high priority)
  {
    name: `${TRIGGER_PREFIX} Status Change Notification`,
    description: 'Notify customer when ticket status changes (excluding high priority)',
    condition: {
      'ticket.action': {
        operator: 'is',
        value: 'update',
      },
      'ticket.priority_id': {
        operator: 'is not',
        value: '3', // Exclude high priority (priority 3 = high in Zammad)
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

  // 3. New reply notification (excluding high priority and internal notes)
  {
    name: `${TRIGGER_PREFIX} New Reply Notification`,
    description: 'Notify customer when staff replies to ticket (excluding high priority)',
    condition: {
      'ticket.action': {
        operator: 'is',
        value: 'update',
      },
      'article.sender_id': {
        operator: 'is',
        value: 'Agent',
      },
      'article.internal': {
        operator: 'is',
        value: 'false',
      },
      'ticket.priority_id': {
        operator: 'is not',
        value: '3', // Exclude high priority
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

async function ensureTrigger(config: TriggerConfig): Promise<{ trigger: ZammadTrigger; action: 'created' | 'updated' }> {
  const { name, description, condition, perform } = config

  const existingTrigger = await zammadClient.findTriggerByName(name)

  if (existingTrigger) {
    const trigger = await zammadClient.updateTrigger(existingTrigger.id, {
      condition,
      perform,
      active: true,
      note: description,
    })
    return { trigger, action: 'updated' }
  }

  const trigger = await zammadClient.createTrigger({
    name,
    condition,
    perform,
    active: true,
    note: description,
  })
  return { trigger, action: 'created' }
}

export async function POST() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    if (session.user.role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Admin access required', undefined, 403)
    }

    const results: Array<{ name: string; id: number; action: 'created' | 'updated' }> = []
    const errors: Array<{ name: string; error: string }> = []

    for (const config of defaultTriggers) {
      try {
        const { trigger, action } = await ensureTrigger(config)
        results.push({ name: trigger.name, id: trigger.id, action })
      } catch (error) {
        errors.push({
          name: config.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return successResponse({
      message: 'Email notification triggers setup complete',
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: defaultTriggers.length,
        success: results.length,
        failed: errors.length,
      },
    })
  } catch (error) {
    logger.error('Triggers', 'Failed to setup default triggers', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}
