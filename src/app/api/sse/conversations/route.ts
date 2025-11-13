/**
 * Server-Sent Events (SSE) API for Real-time Conversation Updates
 *
 * GET /api/sse/conversations - Establish SSE connection for conversation updates
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'

// Store active connections per user
const connections = new Map<string, ReadableStreamDefaultController>()

// Store user roles for filtering
const userRoles = new Map<string, string>()

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000

// Connection timeout (10 minutes of inactivity)
const CONNECTION_TIMEOUT = 10 * 60 * 1000

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth()
    const userId = user.id
    const userRole = user.role

    console.log(`[SSE] User ${userId} (${userRole}) connecting to conversations stream`)

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Close existing connection if any
        const existingController = connections.get(userId)
        if (existingController) {
          try {
            existingController.close()
          } catch {
            // Already closed
          }
          connections.delete(userId)
        }

        // Store the new connection and user role
        connections.set(userId, controller)
        userRoles.set(userId, userRole)

        // Send initial connection message
        const encoder = new TextEncoder()
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'connected',
            userId,
            role: userRole,
            timestamp: new Date().toISOString()
          })}\n\n`)
        )

        console.log(`[SSE] User ${userId} connected. Active connections: ${connections.size}`)

        // Set up heartbeat
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch (error) {
            console.error(`[SSE] Heartbeat error for user ${userId}:`, error)
            clearInterval(heartbeatInterval)
            connections.delete(userId)
          }
        }, HEARTBEAT_INTERVAL)

        // Set up connection timeout
        const timeoutId = setTimeout(() => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'timeout',
                timestamp: new Date().toISOString()
              })}\n\n`)
            )
            controller.close()
          } catch (error) {
            console.error(`[SSE] Timeout error for user ${userId}:`, error)
          }
          clearInterval(heartbeatInterval)
          connections.delete(userId)
          console.log(`[SSE] User ${userId} connection timeout. Active connections: ${connections.size}`)
        }, CONNECTION_TIMEOUT)

        // Clean up on connection close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval)
          clearTimeout(timeoutId)
          connections.delete(userId)
          userRoles.delete(userId)
          console.log(`[SSE] User ${userId} disconnected. Active connections: ${connections.size}`)
          try {
            controller.close()
          } catch {
            // Connection already closed
          }
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering in nginx
      },
    })
  } catch (error: any) {
    console.error('[SSE] Connection error:', error)
    if (error.message === 'Unauthorized') {
      return new Response('Unauthorized', { status: 401 })
    }
    return new Response('Internal Server Error', { status: 500 })
  }
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
      | 'typing'
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
