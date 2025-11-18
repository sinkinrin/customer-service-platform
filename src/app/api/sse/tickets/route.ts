/**
 * Server-Sent Events (SSE) API for Real-time Ticket Updates
 * 
 * GET /api/sse/tickets - Establish SSE connection for ticket updates
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import { addConnection, removeConnection } from '@/lib/sse/ticket-broadcaster'

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000

// Connection timeout (5 minutes of inactivity)
const CONNECTION_TIMEOUT = 5 * 60 * 1000

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify authentication and require staff/admin role
  // Customers should not have access to ticket SSE broadcasts
  try {
    const user = await requireRole(['staff', 'admin'])
    const userId = user.id
    const userRole = user.role

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Store the connection
      addConnection(userId, controller)

      // Send initial connection message
      const encoder = new TextEncoder()
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId, role: userRole })}\n\n`)
      )

      // Set up heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch (error) {
          console.error('Heartbeat error:', error)
          clearInterval(heartbeatInterval)
          removeConnection(userId)
        }
      }, HEARTBEAT_INTERVAL)

      // Set up connection timeout
      const timeoutId = setTimeout(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'timeout' })}\n\n`)
          )
          controller.close()
        } catch (error) {
          console.error('Timeout error:', error)
        }
        clearInterval(heartbeatInterval)
        removeConnection(userId)
      }, CONNECTION_TIMEOUT)

      // Clean up on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        clearTimeout(timeoutId)
        removeConnection(userId)
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
  } catch (error) {
    console.error('SSE tickets authentication error:', error)
    return new Response('Forbidden', { status: 403 })
  }
}

