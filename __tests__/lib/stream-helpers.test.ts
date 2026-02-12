/**
 * Unit tests for src/lib/ai/stream-helpers.ts
 *
 * Covers:
 * - createStreamResponse: correct SSE headers
 * - withStreamTimeout: normal data pass-through
 * - withStreamTimeout: idle timeout emits error event + closes stream
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createStreamResponse, withStreamTimeout } from '@/lib/ai/stream-helpers'

// ── helpers ──────────────────────────────────────────────────────────

function makeStream(chunks: Uint8Array[], delayMs = 0): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            for (const chunk of chunks) {
                if (delayMs) await new Promise(r => setTimeout(r, delayMs))
                controller.enqueue(chunk)
            }
            controller.close()
        },
    })
}

afterEach(() => {
    vi.restoreAllMocks()
})

// ── tests ────────────────────────────────────────────────────────────

describe('createStreamResponse', () => {
    it('returns a Response with correct SSE headers', () => {
        const encoder = new TextEncoder()
        const stream = makeStream([encoder.encode('data: test\n\n')])
        const response = createStreamResponse(stream)

        expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8')
        expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
        expect(response.headers.get('X-Accel-Buffering')).toBe('no')
    })

    it('passes through data from the upstream stream', async () => {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()
        const data = 'event: answer\ndata: {"text":"hello"}\n\n'
        const stream = makeStream([encoder.encode(data)])
        const response = createStreamResponse(stream)

        const text = await response.text()
        expect(text).toBe(data)
    })
})

describe('withStreamTimeout', () => {
    it('passes through all data when chunks arrive promptly', async () => {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        const chunks = [
            encoder.encode('chunk1'),
            encoder.encode('chunk2'),
            encoder.encode('chunk3'),
        ]
        const wrapped = withStreamTimeout(makeStream(chunks), 5000)

        const reader = wrapped.getReader()
        const results: string[] = []
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            results.push(decoder.decode(value))
        }

        expect(results.join('')).toBe('chunk1chunk2chunk3')
    })

    it('emits error event and closes stream on idle timeout', async () => {
        // Create a stream that never sends data
        const neverStream = new ReadableStream<Uint8Array>({
            start() {
                // intentionally never enqueue or close
            },
        })

        // Use a very short timeout
        const wrapped = withStreamTimeout(neverStream, 50)
        const reader = wrapped.getReader()
        const decoder = new TextDecoder()

        // The first read should eventually return the timeout error event
        const { done, value } = await reader.read()
        expect(done).toBe(false)
        const text = decoder.decode(value)
        expect(text).toContain('event: error')
        expect(text).toContain('Stream timeout')

        // Next read should indicate stream is closed
        const next = await reader.read()
        expect(next.done).toBe(true)
    })
})
