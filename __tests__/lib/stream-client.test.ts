/**
 * Unit tests for src/lib/ai/stream-client.ts
 *
 * Covers:
 * - SSE streaming parse + delta text assembly
 * - JSON fallback (non-stream) path
 * - flowNodeStatus event triggering onStatusUpdate
 * - SSE error event propagation
 * - Empty / missing content handling
 */

import { describe, it, expect, vi } from 'vitest'
import { readAIChatResponse } from '@/lib/ai/stream-client'

// ── helpers ──────────────────────────────────────────────────────────

function sseResponse(events: string[], status = 200): Response {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const evt of events) {
                controller.enqueue(encoder.encode(evt))
            }
            controller.close()
        },
    })

    return new Response(body, {
        status,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    })
}

function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

// ── tests ────────────────────────────────────────────────────────────

describe('readAIChatResponse', () => {
    it('concatenates SSE delta tokens into full text', async () => {
        const events = [
            'event: answer\ndata: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'event: answer\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\n',
            'event: done\ndata: {}\n\n',
        ]

        const onText = vi.fn()
        const result = await readAIChatResponse(sseResponse(events), onText)

        expect(result).toBe('Hello world')
        // Should be called at least twice (once per delta)
        expect(onText.mock.calls.length).toBeGreaterThanOrEqual(2)
        // Last call should contain the full text
        expect(onText.mock.calls[onText.mock.calls.length - 1][0]).toBe('Hello world')
    })

    it('handles JSON fallback when content-type is application/json', async () => {
        const payload = { success: true, data: { message: 'Hi from JSON' } }
        const onText = vi.fn()
        const result = await readAIChatResponse(jsonResponse(payload), onText)

        expect(result).toBe('Hi from JSON')
        // At least one call with the full message
        expect(onText).toHaveBeenCalledWith(expect.stringContaining('Hi from JSON'))
    })

    it('triggers onStatusUpdate on flowNodeStatus events', async () => {
        const events = [
            'event: flowNodeStatus\ndata: {"name":"Knowledge Search"}\n\n',
            'event: answer\ndata: {"choices":[{"delta":{"content":"result"}}]}\n\n',
            'event: done\ndata: {}\n\n',
        ]

        const onText = vi.fn()
        const onStatus = vi.fn()
        await readAIChatResponse(sseResponse(events), onText, onStatus)

        // Should have been called with the node name
        expect(onStatus).toHaveBeenCalledWith('Knowledge Search')
        // Should also be called with empty string when answer text arrives
        expect(onStatus).toHaveBeenCalledWith('')
    })

    it('throws on SSE error events', async () => {
        const events = [
            'event: error\ndata: {"error":"upstream failed"}\n\n',
        ]

        const onText = vi.fn()
        await expect(
            readAIChatResponse(sseResponse(events), onText)
        ).rejects.toThrow('upstream failed')
    })

    it('throws when JSON response indicates failure', async () => {
        const payload = { success: false, error: 'AI is disabled' }
        const onText = vi.fn()

        await expect(
            readAIChatResponse(jsonResponse(payload), onText)
        ).rejects.toThrow('AI is disabled')
    })

    it('throws when HTTP status is not ok', async () => {
        const res = new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        })
        const onText = vi.fn()

        await expect(
            readAIChatResponse(res, onText)
        ).rejects.toThrow()
    })

    it('handles [DONE] marker gracefully', async () => {
        const events = [
            'event: answer\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
            'data: [DONE]\n\n',
        ]

        const onText = vi.fn()
        const result = await readAIChatResponse(sseResponse(events), onText)
        expect(result).toBe('ok')
    })
})
