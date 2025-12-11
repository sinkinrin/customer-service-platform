/**
 * SSE Conversation Broadcaster
 *
 * Manages SSE connections and broadcasts events to connected clients
 */

// Store active connections per user
const connections = new Map<string, ReadableStreamDefaultController>()

// Store user roles for filtering
const userRoles = new Map<string, string>()

/**
 * Add a new SSE connection
 */
export function addConnection(userId: string, controller: ReadableStreamDefaultController, role: string) {
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
  userRoles.set(userId, role)
}

/**
 * Remove an SSE connection
 */
export function removeConnection(userId: string) {
  connections.delete(userId)
  userRoles.delete(userId)
}

/**
 * Get an SSE connection controller
 */
export function getConnection(userId: string): ReadableStreamDefaultController | undefined {
  return connections.get(userId)
}

/**
 * Broadcast a conversation event to specific users or roles
 */
export function broadcastConversationEvent(
  event: {
    type:
      | 'new_message'
      | 'conversation_updated'
      | 'conversation_created'
      | 'conversation_transferred'
      | 'new_conversation_transferred'
      | 'conversation_claimed'
      | 'conversation_region_changed'
      | 'typing'
      | 'unread_count_updated'
    conversationId: string
    data: any
  },
  targetUserIds: string[]
) {
  const encoder = new TextEncoder()
  const message = `data: ${JSON.stringify({
    ...event,
    timestamp: new Date().toISOString()
  })}\n\n`
  const encodedMessage = encoder.encode(message)

  let targetUsers: string[] = []

  // Check if broadcasting to roles (e.g., 'staff')
  if (targetUserIds.includes('staff')) {
    // Broadcast to all staff users
    targetUsers = Array.from(connections.keys()).filter(userId => {
      const role = userRoles.get(userId)
      return role === 'staff' || role === 'admin'
    })
    console.log(`[SSE] Broadcasting ${event.type} to all staff (${targetUsers.length} users)`)
  } else {
    // Broadcast to specific users
    targetUsers = targetUserIds
    console.log(`[SSE] Broadcasting ${event.type} to ${targetUsers.length} specific users`)
  }

  let successCount = 0
  let failCount = 0

  // Send to target users
  targetUsers.forEach((userId) => {
    const controller = connections.get(userId)
    if (controller) {
      try {
        controller.enqueue(encodedMessage)
        successCount++
      } catch (error) {
        console.error(`[SSE] Failed to send event to user ${userId}:`, error)
        connections.delete(userId)
        userRoles.delete(userId)
        failCount++
      }
    }
  })

  console.log(`[SSE] Broadcast complete: ${successCount} success, ${failCount} failed`)
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

/**
 * Broadcast unread count update to specific user
 */
export function broadcastUnreadCountUpdate(userId: string, unreadCount: number) {
  const encoder = new TextEncoder()
  const message = `data: ${JSON.stringify({
    type: 'unread_count_updated',
    data: { unreadCount },
    timestamp: new Date().toISOString()
  })}\n\n`
  const encodedMessage = encoder.encode(message)

  const controller = connections.get(userId)
  if (controller) {
    try {
      controller.enqueue(encodedMessage)
      console.log(`[SSE] Sent unread count update to user ${userId}: ${unreadCount}`)
    } catch (error) {
      console.error(`[SSE] Failed to send unread count to user ${userId}:`, error)
      connections.delete(userId)
      userRoles.delete(userId)
    }
  }
}

/**
 * Broadcast conversation update (for backward compatibility)
 * Used by mark-read API
 */
export function broadcastConversationUpdate(conversationId: string, conversation: any) {
  broadcastConversationEvent(
    {
      type: 'conversation_updated',
      conversationId,
      data: conversation
    },
    [conversation.customer_id, ...(conversation.staff_id ? [conversation.staff_id] : [])]
  )
}
