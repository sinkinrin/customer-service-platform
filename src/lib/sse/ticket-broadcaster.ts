/**
 * SSE Ticket Broadcaster
 *
 * Manages SSE connections and broadcasts ticket events to connected clients
 */

// Store active connections
const connections = new Map<string, ReadableStreamDefaultController>()

/**
 * Add a new SSE connection
 */
export function addConnection(userId: string, controller: ReadableStreamDefaultController) {
  // Close existing connection if any
  const existingController = connections.get(userId)
  if (existingController) {
    try {
      existingController.close()
    } catch {
      // Already closed
    }
  }

  connections.set(userId, controller)
}

/**
 * Remove an SSE connection
 */
export function removeConnection(userId: string) {
  connections.delete(userId)
}

/**
 * Get an SSE connection controller
 */
export function getConnection(userId: string): ReadableStreamDefaultController | undefined {
  return connections.get(userId)
}

/**
 * Broadcast an event to specific users or all users
 */
export function broadcastEvent(
  event: {
    type: string
    data: any
  },
  targetUserIds?: string[]
) {
  const encoder = new TextEncoder()
  const message = `data: ${JSON.stringify(event)}\n\n`
  const encodedMessage = encoder.encode(message)

  if (targetUserIds) {
    // Send to specific users
    targetUserIds.forEach((userId) => {
      const controller = connections.get(userId)
      if (controller) {
        try {
          controller.enqueue(encodedMessage)
        } catch (error) {
          console.error(`Failed to send event to user ${userId}:`, error)
          connections.delete(userId)
        }
      }
    })
  } else {
    // Broadcast to all connected users
    connections.forEach((controller, userId) => {
      try {
        controller.enqueue(encodedMessage)
      } catch (error) {
        console.error(`Failed to broadcast event to user ${userId}:`, error)
        connections.delete(userId)
      }
    })
  }
}

/**
 * Get count of active connections
 */
export function getActiveConnectionsCount(): number {
  return connections.size
}

/**
 * Get list of connected user IDs
 */
export function getConnectedUserIds(): string[] {
  return Array.from(connections.keys())
}
