/**
 * SSE Stream for Ticket Updates
 *
 * GET /api/tickets/updates/stream - Server-Sent Events endpoint
 *
 * Provides real-time ticket updates via SSE.
 * Falls back to polling if SSE connection fails.
 */

import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { sseEmitter } from '@/lib/sse/emitter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // Authenticate
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id
  const userRole = session.user.role

  // Create SSE stream
  const encoder = new TextEncoder()
  let isConnected = true

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent = `event: connected\ndata: ${JSON.stringify({
        userId,
        timestamp: Date.now()
      })}\n\n`
      controller.enqueue(encoder.encode(connectEvent))

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (!isConnected) {
          clearInterval(heartbeatInterval)
          return
        }
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          isConnected = false
          clearInterval(heartbeatInterval)
        }
      }, 30000) // 30 second heartbeat

      // Subscribe to ticket updates
      const unsubscribe = sseEmitter.subscribe(userId, userRole, (update) => {
        if (!isConnected) return
        try {
          const eventData = `event: ticket-update\ndata: ${JSON.stringify(update)}\n\n`
          controller.enqueue(encoder.encode(eventData))
        } catch {
          isConnected = false
        }
      })

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        isConnected = false
        clearInterval(heartbeatInterval)
        unsubscribe()
      })
    },
    cancel() {
      isConnected = false
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
