/**
 * Email User Welcome System
 *
 * Handles automatic password generation and welcome email sending
 * for first-time users who create tickets via email.
 */

import crypto from 'crypto'
import type { ZammadWebhookPayload, ZammadUser } from '@/lib/zammad/types'
import { zammadClient } from '@/lib/zammad/client'
import { createApiLogger } from '@/lib/utils/api-logger'
import { env } from '@/lib/env'
import {
  generateWelcomeEmailHtml,
  generateWelcomeEmailSubject,
} from '@/lib/constants/email-templates'
import { parseRegionFromNote } from '@/lib/ticket/email-ticket-routing'

// Markers used in user.note to track welcome flow status
// Two separate markers ensure idempotency even if email send fails after password is set
const WELCOME_PASSWORD_MARKER = 'WelcomePasswordSet:'
const WELCOME_EMAIL_MARKER = 'WelcomeEmailSent:'

// Character set for password generation (excludes confusing characters: 0/O, 1/l/I)
const PASSWORD_CHARS = {
  uppercase: 'ABCDEFGHJKMNPQRSTUVWXYZ', // Excludes O, I
  lowercase: 'abcdefghjkmnpqrstuvwxyz', // Excludes l
  digits: '23456789', // Excludes 0, 1
}

const ALL_PASSWORD_CHARS =
  PASSWORD_CHARS.uppercase + PASSWORD_CHARS.lowercase + PASSWORD_CHARS.digits

/**
 * Generate a cryptographically secure random password
 *
 * @param length - Password length (default: 12)
 * @returns A random password containing uppercase, lowercase, and digits
 */
export function generateSecurePassword(length: number = 12): string {
  const bytes = crypto.randomBytes(length * 2)
  let password = ''

  // Ensure at least one character from each category
  const requiredChars = [
    PASSWORD_CHARS.uppercase[bytes[0] % PASSWORD_CHARS.uppercase.length],
    PASSWORD_CHARS.lowercase[bytes[1] % PASSWORD_CHARS.lowercase.length],
    PASSWORD_CHARS.digits[bytes[2] % PASSWORD_CHARS.digits.length],
  ]

  // Fill remaining positions with random characters from all categories
  for (let i = 3; i < length; i++) {
    password += ALL_PASSWORD_CHARS[bytes[i] % ALL_PASSWORD_CHARS.length]
  }

  // Insert required chars at random positions
  for (const char of requiredChars) {
    const insertPos = bytes[length + requiredChars.indexOf(char)] % (password.length + 1)
    password = password.slice(0, insertPos) + char + password.slice(insertPos)
  }

  return password.slice(0, length)
}

/**
 * Check if user is a first-time email user (no Region = auto-created by Zammad)
 *
 * Web-registered or admin-created users always have "Region: xxx" in their note.
 * Zammad auto-creates users from inbound email with empty/null note.
 *
 * @param note - User's note field from Zammad
 * @returns true if user has no Region (first-time email user)
 */
export function isFirstTimeEmailUser(note?: string | null): boolean {
  const { region } = parseRegionFromNote(note)
  return !region
}

/**
 * Check if password has already been set for this user
 *
 * @param note - User's note field from Zammad
 * @returns true if password marker is present
 */
export function hasPasswordBeenSet(note?: string | null): boolean {
  if (!note) return false
  return note.includes(WELCOME_PASSWORD_MARKER)
}

/**
 * Check if welcome email has already been sent to a user
 *
 * @param note - User's note field from Zammad
 * @returns true if welcome email marker is present
 */
export function hasWelcomeEmailSent(note?: string | null): boolean {
  if (!note) return false
  return note.includes(WELCOME_EMAIL_MARKER)
}

/**
 * Build updated note field with password set marker
 *
 * @param existingNote - User's current note field
 * @returns Updated note with marker and timestamp
 */
export function buildNoteWithPasswordMarker(existingNote?: string | null): string {
  const timestamp = new Date().toISOString()
  const marker = `${WELCOME_PASSWORD_MARKER} ${timestamp}`

  if (!existingNote || existingNote.trim() === '') {
    return marker
  }

  return `${existingNote}\n${marker}`
}

/**
 * Build updated note field with welcome email marker
 *
 * @param existingNote - User's current note field
 * @returns Updated note with marker and timestamp
 */
export function buildNoteWithWelcomeMarker(existingNote?: string | null): string {
  const timestamp = new Date().toISOString()
  const marker = `${WELCOME_EMAIL_MARKER} ${timestamp}`

  if (!existingNote || existingNote.trim() === '') {
    return marker
  }

  return `${existingNote}\n${marker}`
}

/**
 * Set password for a Zammad user
 *
 * @param userId - Zammad user ID
 * @param password - New password to set
 * @param requestId - Request ID for logging
 * @returns Updated user object
 */
async function setUserPassword(
  userId: number,
  password: string,
  requestId?: string
): Promise<ZammadUser> {
  const log = createApiLogger('EmailUserWelcome', requestId)

  log.info('Setting password for email user', { userId })

  const updatedUser = await zammadClient.updateUser(userId, { password })

  log.info('Password set successfully for email user', { userId })

  return updatedUser
}

/**
 * Send welcome email to a user via Zammad Article API
 *
 * @param params - Email parameters
 * @param requestId - Request ID for logging
 */
async function sendWelcomeEmail(
  params: {
    ticketId: number
    ticketNumber: string
    customerEmail: string
    customerName?: string
    password: string
  },
  requestId?: string
): Promise<void> {
  const log = createApiLogger('EmailUserWelcome', requestId)

  const loginUrl = env.WEB_PLATFORM_URL
    ? `${env.WEB_PLATFORM_URL}/login`
    : 'https://support.example.com/login'

  const emailHtml = generateWelcomeEmailHtml({
    customerName: params.customerName || '',
    email: params.customerEmail,
    password: params.password,
    loginUrl,
    ticketNumber: params.ticketNumber,
  })

  const subject = generateWelcomeEmailSubject(params.ticketNumber)

  log.info('Sending welcome email', {
    ticketId: params.ticketId,
    ticketNumber: params.ticketNumber,
    customerEmail: params.customerEmail,
  })

  await zammadClient.createArticle({
    ticket_id: params.ticketId,
    subject,
    body: emailHtml,
    content_type: 'text/html',
    type: 'email',
    internal: false,
    sender: 'Agent',
    to: params.customerEmail,
  })

  log.info('Welcome email sent successfully', {
    ticketId: params.ticketId,
    ticketNumber: params.ticketNumber,
  })
}

/**
 * Mark user as having password set by updating their note field
 *
 * @param userId - Zammad user ID
 * @param existingNote - User's current note
 * @param requestId - Request ID for logging
 * @returns Updated note string
 */
async function markPasswordSet(
  userId: number,
  existingNote: string | undefined,
  requestId?: string
): Promise<string> {
  const log = createApiLogger('EmailUserWelcome', requestId)

  const updatedNote = buildNoteWithPasswordMarker(existingNote)

  await zammadClient.updateUser(userId, { note: updatedNote })

  log.info('Marked user password as set', { userId })

  return updatedNote
}

/**
 * Mark user as having received welcome email by updating their note field
 *
 * @param userId - Zammad user ID
 * @param existingNote - User's current note
 * @param requestId - Request ID for logging
 */
async function markWelcomeEmailSent(
  userId: number,
  existingNote: string | undefined,
  requestId?: string
): Promise<void> {
  const log = createApiLogger('EmailUserWelcome', requestId)

  const updatedNote = buildNoteWithWelcomeMarker(existingNote)

  await zammadClient.updateUser(userId, { note: updatedNote })

  log.info('Marked user as welcome email sent', { userId })
}

/**
 * Main entry point: Handle welcome flow for email-created users
 *
 * This function is called asynchronously from the webhook handler
 * and should not throw errors that block the webhook response.
 *
 * Flow:
 * 1. Check if user has Region (existing user) -> skip
 * 2. Check if password already set (WelcomePasswordSet marker) -> skip to email step
 * 3. Generate and set password, mark WelcomePasswordSet
 * 4. If email enabled and not sent, send email and mark WelcomeEmailSent
 *
 * @param payload - Zammad webhook payload
 * @param requestId - Request ID for logging correlation
 */
export async function handleEmailUserWelcomeFromWebhookPayload(
  payload: ZammadWebhookPayload,
  requestId?: string
): Promise<void> {
  const log = createApiLogger('EmailUserWelcome', requestId)

  try {
    // Check feature flags
    if (!env.EMAIL_USER_AUTO_PASSWORD_ENABLED) {
      log.info('Email user auto password is disabled, skipping')
      return
    }

    const ticket = payload.ticket

    // Only process email-originated tickets
    if (payload.article?.type !== 'email') {
      return
    }

    // Validate customer ID
    if (typeof ticket.customer_id !== 'number') {
      log.warning('Skipping email user welcome: missing customer_id', { ticketId: ticket.id })
      return
    }

    const customerId = ticket.customer_id

    // Fetch customer details
    let customer: ZammadUser
    try {
      customer = await zammadClient.getUser(customerId)
    } catch (error) {
      log.error('Failed to fetch customer from Zammad; skipping welcome flow', {
        ticketId: ticket.id,
        customerId,
        error: error instanceof Error ? error.message : error,
      })
      return
    }

    // Check if this is a first-time email user (no Region = auto-created by Zammad)
    // Users with Region were registered via web or created by admin, skip them
    if (!isFirstTimeEmailUser(customer.note)) {
      log.info('User has Region (existing user), skipping welcome flow', {
        ticketId: ticket.id,
        customerId,
        email: customer.email,
      })
      return
    }

    // Track current note state for updates
    let currentNote = customer.note

    // Step 1: Set password if not already done
    let password: string | null = null
    if (!hasPasswordBeenSet(currentNote)) {
      password = generateSecurePassword(12)

      try {
        await setUserPassword(customerId, password, requestId)
        // Mark password as set immediately after successful password update
        currentNote = await markPasswordSet(customerId, currentNote, requestId)
      } catch (error) {
        log.error('Failed to set user password; aborting welcome flow', {
          ticketId: ticket.id,
          customerId,
          error: error instanceof Error ? error.message : error,
        })
        return
      }
    } else {
      log.info('Password already set for user, skipping password generation', {
        ticketId: ticket.id,
        customerId,
      })
    }

    // Step 2: Send welcome email if enabled and not already sent
    if (env.EMAIL_USER_WELCOME_EMAIL_ENABLED && !hasWelcomeEmailSent(currentNote)) {
      // If password was already set in a previous run, we can't send the email
      // (we don't have the password anymore)
      if (!password) {
        log.warning('Cannot send welcome email: password was set previously and is not available', {
          ticketId: ticket.id,
          customerId,
        })
        return
      }

      try {
        const customerName = [customer.firstname, customer.lastname]
          .filter(Boolean)
          .join(' ')
          .trim()

        await sendWelcomeEmail(
          {
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            customerEmail: customer.email,
            customerName: customerName || undefined,
            password,
          },
          requestId
        )

        // Only mark as sent after successful email delivery
        await markWelcomeEmailSent(customerId, currentNote, requestId)

        log.info('Email user welcome flow completed successfully', {
          ticketId: ticket.id,
          ticketNumber: ticket.number,
          customerId,
        })
      } catch (error) {
        // Email failed - don't mark as sent so retry is possible on next ticket
        // Note: password is already set and marked, so we won't regenerate it
        log.error('Failed to send welcome email; password was set but email not sent', {
          ticketId: ticket.id,
          customerId,
          error: error instanceof Error ? error.message : error,
        })
      }
    } else if (!env.EMAIL_USER_WELCOME_EMAIL_ENABLED) {
      log.info('Email user password set (welcome email disabled)', {
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        customerId,
      })
    } else {
      log.info('Welcome email already sent, skipping', {
        ticketId: ticket.id,
        customerId,
      })
    }
  } catch (error) {
    // Catch-all to prevent any errors from propagating
    log.error('Email user welcome flow failed (non-blocking)', {
      error: error instanceof Error ? error.message : error,
    })
  }
}
