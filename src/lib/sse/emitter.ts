/**
 * SSE Event Emitter for Ticket Updates
 *
 * A simple in-memory pub/sub system for broadcasting ticket updates
 * to connected SSE clients.
 *
 * Note: This is a single-process solution. For horizontal scaling,
 * use Redis pub/sub instead.
 */

import { TicketUpdate } from '@/lib/hooks/use-ticket-updates'
import { logger } from '@/lib/utils/logger'

type SubscriberCallback = (update: TicketUpdate) => void

interface Subscriber {
  userId: string
  userRole: string
  callback: SubscriberCallback
  connectedAt: number
}

// Connection limits
const MAX_CONNECTIONS_PER_USER = 5
const MAX_GLOBAL_CONNECTIONS = 500
// Stale connection threshold: 5 minutes without heartbeat confirmation
const STALE_CONNECTION_MS = 5 * 60 * 1000

class SSEEmitter {
  private subscribers: Map<string, Subscriber> = new Map()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Periodic cleanup of orphaned connections every 60s
    this.cleanupInterval = setInterval(() => this.cleanupStale(), 60_000)
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Subscribe to ticket updates with connection limits (H8)
   * @returns Unsubscribe function, or null if limit exceeded
   */
  subscribe(
    userId: string,
    userRole: string,
    callback: SubscriberCallback
  ): (() => void) | null {
    // Global connection limit
    if (this.subscribers.size >= MAX_GLOBAL_CONNECTIONS) {
      logger.warning('SSE', 'Global connection limit reached', {
        data: { limit: MAX_GLOBAL_CONNECTIONS, current: this.subscribers.size },
      })
      return null
    }

    // Per-user connection limit
    let userCount = 0
    for (const sub of this.subscribers.values()) {
      if (sub.userId === userId) userCount++
    }
    if (userCount >= MAX_CONNECTIONS_PER_USER) {
      logger.warning('SSE', 'Per-user connection limit reached', {
        data: { userId, limit: MAX_CONNECTIONS_PER_USER, current: userCount },
      })
      return null
    }

    const subscriberId = `${userId}-${Date.now()}`
    this.subscribers.set(subscriberId, {
      userId,
      userRole,
      callback,
      connectedAt: Date.now(),
    })

    logger.info('SSE', 'Subscriber added', {
      data: { subscriberId, userRole, totalConnections: this.subscribers.size },
    })

    return () => {
      this.subscribers.delete(subscriberId)
      logger.info('SSE', 'Subscriber removed', { data: { subscriberId } })
    }
  }

  /**
   * Broadcast update to relevant subscribers (M15: with try-catch per callback)
   */
  broadcast(update: TicketUpdate, targetUserIds?: string[]): void {
    let sentCount = 0
    this.subscribers.forEach((subscriber, subscriberId) => {
      try {
        // Admin receives all updates
        if (subscriber.userRole === 'admin') {
          subscriber.callback(update)
          sentCount++
          return
        }

        // Staff/Customer: only deliver when explicitly targeted.
        if (targetUserIds && targetUserIds.includes(subscriber.userId)) {
          subscriber.callback(update)
          sentCount++
        }
      } catch (error) {
        // M15: isolate callback errors so one failure doesn't break others
        logger.warning('SSE', 'Subscriber callback error, removing', {
          data: { subscriberId, error: error instanceof Error ? error.message : error },
        })
        this.subscribers.delete(subscriberId)
      }
    })

    if (sentCount === 0 && targetUserIds && targetUserIds.length > 0) {
      logger.warning('SSE', 'Broadcast had no recipients', {
        data: {
          ticketId: update.ticketId,
          event: update.event,
          targetCount: targetUserIds.length,
          subscriberCount: this.subscribers.size,
        },
      })
    }
  }

  /**
   * M12: Clean up stale/orphaned connections
   */
  private cleanupStale(): void {
    const now = Date.now()
    let removedCount = 0
    for (const [subscriberId, subscriber] of this.subscribers) {
      if (now - subscriber.connectedAt > STALE_CONNECTION_MS) {
        this.subscribers.delete(subscriberId)
        removedCount++
      }
    }
    if (removedCount > 0) {
      logger.info('SSE', 'Cleaned up stale connections', {
        data: { removed: removedCount, remaining: this.subscribers.size },
      })
    }
  }

  /**
   * Refresh connection timestamp (called on heartbeat success)
   */
  refreshConnection(subscriberId: string): void {
    const subscriber = this.subscribers.get(subscriberId)
    if (subscriber) {
      subscriber.connectedAt = Date.now()
    }
  }

  /**
   * Get current subscriber count (for monitoring)
   */
  getSubscriberCount(): number {
    return this.subscribers.size
  }

  /**
   * Get subscriber stats (for monitoring)
   */
  getStats(): { total: number; byRole: Record<string, number> } {
    const byRole: Record<string, number> = {}
    this.subscribers.forEach((subscriber) => {
      byRole[subscriber.userRole] = (byRole[subscriber.userRole] || 0) + 1
    })
    return { total: this.subscribers.size, byRole }
  }
}

// Singleton instance
export const sseEmitter = new SSEEmitter()
