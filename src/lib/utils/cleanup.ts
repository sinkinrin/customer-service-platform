/**
 * Database Cleanup Utilities
 *
 * Periodic cleanup of stale records to prevent unbounded table growth.
 * Called lazily from webhook handler (runs at most once per hour).
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'

// Run cleanup at most once per hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000
// TicketUpdate retention: 7 days
const TICKET_UPDATE_RETENTION_DAYS = 7

let lastCleanupAt = 0

/**
 * Run cleanup if enough time has passed since last run.
 * Non-blocking — errors are logged but never thrown.
 */
export function maybeRunCleanup(): void {
  const now = Date.now()
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return
  lastCleanupAt = now

  // Fire-and-forget
  void runCleanup()
}

async function runCleanup(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - TICKET_UPDATE_RETENTION_DAYS * 24 * 60 * 60 * 1000)

    // M16: Clean up old TicketUpdate records
    const ticketUpdateResult = await prisma.ticketUpdate.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    // L11: Clean up expired Notifications
    const notificationResult = await prisma.notification.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })

    if (ticketUpdateResult.count > 0 || notificationResult.count > 0) {
      logger.info('Cleanup', 'Database cleanup completed', {
        data: {
          ticketUpdatesRemoved: ticketUpdateResult.count,
          notificationsRemoved: notificationResult.count,
        },
      })
    }
  } catch (error) {
    logger.error('Cleanup', 'Database cleanup failed', {
      data: { error: error instanceof Error ? error.message : error },
    })
  }
}
