/**
 * Unit tests for withPersistence (server-side AI reply capture)
 */

import { describe, it, expect, vi } from 'vitest'
import { withPersistence, withStreamTimeout } from '@/lib/ai/stream-helpers'
import { readAIChatResponse } from '@/lib/ai/stream-client'

const encoder = new TextEncoder()

function sseChunk(payload: string): Uint8Array {
  return encoder.encode(payload)
}

function deltaEvent(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
}

function makeStream(chunks: Uint8Array[], opts?: { failAfter?: number }): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (opts?.failAfter !== undefined && i >= opts.failAfter) {
        controller.error(new Error('upstream broke'))
        return
      }
      if (i < chunks.length) {
        controller.enqueue(chunks[i++])
      } else {
        controller.close()
      }
    },
  })
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let out = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  return out
}

describe('withPersistence', () => {
  it('accumulates delta text and calls onComplete with completed=true on normal end', async () => {
    const onComplete = vi.fn().mockResolvedValue({ messageId: 'msg-1' })
    const stream = withPersistence(
      makeStream([
        sseChunk(deltaEvent('Hello ')),
        sseChunk(deltaEvent('world')),
        sseChunk('data: [DONE]\n\n'),
      ]),
      onComplete
    )

    const output = await drain(stream)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('Hello world', { completed: true })
    // persisted event appended with the message id
    expect(output).toContain('event: persisted')
    expect(output).toContain('msg-1')
    expect(output.indexOf('event: persisted')).toBeLessThan(output.indexOf('data: [DONE]'))
    // original payload forwarded untouched
    expect(output).toContain('Hello ')
  })

  it('does not emit persisted event when onComplete returns null', async () => {
    const onComplete = vi.fn().mockResolvedValue(null)
    const stream = withPersistence(
      makeStream([sseChunk(deltaEvent('hi')), sseChunk('data: [DONE]\n\n')]),
      onComplete
    )

    const output = await drain(stream)
    expect(output).not.toContain('event: persisted')
  })

  it('handles SSE events split across chunk boundaries', async () => {
    const full = deltaEvent('AB')
    const mid = Math.floor(full.length / 2)
    const onComplete = vi.fn().mockResolvedValue(null)
    const stream = withPersistence(
      makeStream([sseChunk(full.slice(0, mid)), sseChunk(full.slice(mid))]),
      onComplete
    )

    await drain(stream)
    expect(onComplete).toHaveBeenCalledWith('AB', { completed: true })
  })

  it('delivers the persisted message id to the real client parser before [DONE]', async () => {
    const onComplete = vi.fn().mockResolvedValue({ messageId: 'msg-client' })
    const stream = withPersistence(
      makeStream([
        sseChunk(deltaEvent('visible answer')),
        sseChunk('data: [DONE]\n\n'),
      ]),
      onComplete
    )
    const response = new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    })
    const onPersisted = vi.fn()

    const text = await readAIChatResponse(response, vi.fn(), undefined, onPersisted)

    expect(text).toBe('visible answer')
    expect(onPersisted).toHaveBeenCalledWith('msg-client')
  })

  it('fires onComplete with partial text and completed=false on upstream error', async () => {
    const onComplete = vi.fn().mockResolvedValue(null)
    const stream = withPersistence(
      makeStream([sseChunk(deltaEvent('partial '))], { failAfter: 1 }),
      onComplete
    )

    await expect(drain(stream)).rejects.toThrow('upstream broke')
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('partial ', { completed: false })
  })

  it('fires onComplete with partial text on client cancel (abort)', async () => {
    const onComplete = vi.fn().mockResolvedValue(null)
    const stream = withPersistence(
      makeStream([sseChunk(deltaEvent('cut off')), sseChunk(deltaEvent('never read'))]),
      onComplete
    )

    const reader = stream.getReader()
    await reader.read() // consume first chunk
    await reader.cancel() // client disconnects

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('cut off', { completed: false })
  })

  it('persists partial text as incomplete when an SSE error event arrives', async () => {
    const onComplete = vi.fn().mockResolvedValue(null)
    const stream = withPersistence(
      makeStream([
        sseChunk('event: flowNodeStatus\ndata: {"name":"tool"}\n\n'),
        sseChunk(deltaEvent('real text')),
        sseChunk('event: error\ndata: {"error":"x"}\n\n'),
      ]),
      onComplete
    )

    await drain(stream)
    expect(onComplete).toHaveBeenCalledWith('real text', { completed: false })
  })

  it('persists partial text before forwarding an idle-timeout error', async () => {
    let sent = false
    const idleStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sent) {
          sent = true
          controller.enqueue(sseChunk(deltaEvent('partial answer')))
        }
      },
    })
    const onComplete = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
      return { messageId: 'timeout-msg' }
    })
    const stream = withPersistence(withStreamTimeout(idleStream, 20), onComplete)

    const output = await drain(stream)

    expect(onComplete).toHaveBeenCalledWith('partial answer', { completed: false })
    expect(output.indexOf('event: persisted')).toBeLessThan(output.indexOf('event: error'))
    expect(output).toContain('timeout-msg')
    expect(output).toContain('Stream timeout')
  })

  it('onComplete failure does not break the stream', async () => {
    const onComplete = vi.fn().mockRejectedValue(new Error('db down'))
    const stream = withPersistence(
      makeStream([sseChunk(deltaEvent('text')), sseChunk('data: [DONE]\n\n')]),
      onComplete
    )

    const output = await drain(stream)
    expect(output).toContain('text')
    expect(output).not.toContain('event: persisted')
  })
})
