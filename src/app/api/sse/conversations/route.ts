/**
 * Server-Sent Events (SSE) API for Real-time Conversation Updates
 *
 * GET /api/sse/conversations - Establish SSE connection for conversation updates
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { addConnection, removeConnection } from '@/lib/sse/conversation-broadcaster'

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000

// Connection timeout (60 minutes of inactivity)
const CONNECTION_TIMEOUT = 60 * 60 * 1000

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth()
    const userId = user.id
    const userRole = user.role

    console.log(`[SSE] User ${userId} (${userRole}) connecting to conversations stream`)

    // Track connection state
    let isClosed = false

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Store the new connection and user role
        addConnection(userId, controller, userRole)

        // Send initial connection message
        const encoder = new TextEncoder()
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'connected',
              userId,
              role: userRole,
              timestamp: new Date().toISOString()
            })}\n\n`)
          )
          console.log(`[SSE] User ${userId} connected`)
        } catch (error) {
          console.error(`[SSE] Failed to send connection message:`, error)
          isClosed = true
        }

        // Set up heartbeat
        const heartbeatInterval = setInterval(() => {
          // Skip if connection is closed
          if (isClosed) {
            clearInterval(heartbeatInterval)
            return
          }

          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch (error) {
            // Connection closed
            isClosed = true
            clearInterval(heartbeatInterval)
            removeConnection(userId)
          }
        }, HEARTBEAT_INTERVAL)

        // Set up connection timeout
        const timeoutId = setTimeout(() => {
          if (isClosed) return

          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'timeout',
                timestamp: new Date().toISOString()
              })}\n\n`)
            )
            controller.close()
            isClosed = true
          } catch (error) {
            // Already closed
            isClosed = true
          }
          clearInterval(heartbeatInterval)
          removeConnection(userId)
          console.log(`[SSE] User ${userId} connection timeout`)
        }, CONNECTION_TIMEOUT)

        // Clean up on connection close
        request.signal.addEventListener('abort', () => {
          if (isClosed) return

          isClosed = true
          clearInterval(heartbeatInterval)
          clearTimeout(timeoutId)
          removeConnection(userId)
          console.log(`[SSE] User ${userId} disconnected`)

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
