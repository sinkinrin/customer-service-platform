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

    console.log(`[SSE] Subscriber added: ${subscriberId} (${userRole})`)

    return () => {
      this.subscribers.delete(subscriberId)
      console.log(`[SSE] Subscriber removed: ${subscriberId}`)
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
    console.log(`[SSE] Broadcasting update: ticketId=${update.ticketId}, event=${update.event}`)

    let sentCount = 0
    this.subscribers.forEach((subscriber) => {
      // If specific targets are provided, only send to them
      if (targetUserIds && !targetUserIds.includes(subscriber.userId)) {
        return
      }

      // Admin receives all updates
      if (subscriber.userRole === 'admin') {
        subscriber.callback(update)
        sentCount++
        return
      }

      // For staff and customer, we need to rely on targetUserIds
      // If no targets specified, broadcast to all (webhook will specify targets)
      if (!targetUserIds) {
        subscriber.callback(update)
        sentCount++
      }
    })

    console.log(`[SSE] Sent to ${sentCount} subscribers`)
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
