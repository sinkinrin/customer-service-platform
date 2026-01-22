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
}

class SSEEmitter {
  private subscribers: Map<string, Subscriber> = new Map()

  /**
   * Subscribe to ticket updates
   * @returns Unsubscribe function
   */
  subscribe(
    userId: string,
    userRole: string,
    callback: SubscriberCallback
  ): () => void {
    const subscriberId = `${userId}-${Date.now()}`
    this.subscribers.set(subscriberId, { userId, userRole, callback })

    logger.info('SSE', 'Subscriber added', {
      data: { subscriberId, userRole },
    })

    return () => {
      this.subscribers.delete(subscriberId)
      logger.info('SSE', 'Subscriber removed', { data: { subscriberId } })
    }
  }

  /**
   * Broadcast update to relevant subscribers
   *
   * Routing logic:
   * - Admin: receives all updates
   * - Staff: receives updates for tickets assigned to them
   * - Customer: receives updates for their own tickets
   */
  broadcast(update: TicketUpdate, targetUserIds?: string[]): void {
    let sentCount = 0
    this.subscribers.forEach((subscriber) => {
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
