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
  let unsub: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to ticket updates (checks connection limits)
      unsub = sseEmitter.subscribe(userId, userRole, (update) => {
        if (!isConnected) return
        try {
          const eventData = `event: ticket-update\ndata: ${JSON.stringify(update)}\n\n`
          controller.enqueue(encoder.encode(eventData))
        } catch {
          isConnected = false
        }
      })

      if (!unsub) {
        // Connection limit exceeded — close the stream immediately
        controller.enqueue(encoder.encode('event: error\ndata: {"error":"Too many connections"}\n\n'))
        controller.close()
        return
      }

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

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        isConnected = false
        clearInterval(heartbeatInterval)
        if (unsub) unsub()
      })
    },
    cancel() {
      isConnected = false
      if (unsub) unsub()
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
