import { describe, expect, it, vi } from 'vitest'
import { withEvidencePersistence } from '@/lib/ai/stream-helpers'

function streamFrom(events: string[]) {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event))
      controller.close()
    },
  })
}

const toolEvents = [
  'event: answer\ndata: {"choices":[{"delta":{"content":"Answer"}}]}\n\n',
  'event: toolCall\ndata: {"tool":{"id":"call-1","toolName":"DatasetSearch"},"responseValueId":"call-1"}\n\n',
  'event: toolParams\ndata: {"tool":{"id":"call-1","params":"{\\"query\\":[\\"login\\"]}"},"responseValueId":"call-1"}\n\n',
  `event: toolResponse\ndata: ${JSON.stringify({
    tool: {
      id: 'call-1',
      response: JSON.stringify([{
        result: {
          cites: [{ id: 'doc-1', sourceName: 'Login Guide.md', content: 'Use a private window.' }],
        },
      }]),
    },
    responseValueId: 'call-1',
  })}\n\n`,
  'event: answer\ndata: [DONE]\n\n',
  'event: flowResponses\ndata: [{"moduleName":"Dataset Search","moduleType":"datasetSearchNode"}]\n\n',
]

describe('withEvidencePersistence', () => {
  it('emits sanitized evidence before persistence and final done for staff', async () => {
    const onComplete = vi.fn().mockResolvedValue({ messageId: 'saved-1' })
    const stream = withEvidencePersistence(
      streamFrom(toolEvents),
      onComplete,
      { emitEvidence: true }
    )

    const output = await new Response(stream).text()

    expect(output).toContain('event: answer')
    expect(output).not.toContain('event: toolResponse')
    expect(output).not.toContain('event: flowResponses')
    expect(output).toContain('event: evidence')
    expect(output).toContain('Login Guide.md')
    expect(output).toContain('event: persisted')
    expect(output).toContain('event: done')
    expect(output.indexOf('event: evidence')).toBeLessThan(output.indexOf('event: persisted'))
    expect(output.indexOf('event: persisted')).toBeLessThan(output.indexOf('event: done'))
    expect(onComplete).toHaveBeenCalledWith(
      'Answer',
      expect.objectContaining({
        completed: true,
        evidence: expect.objectContaining({
          citations: [expect.objectContaining({ id: 'doc-1' })],
        }),
      })
    )
  })

  it('completes after a short grace period when the provider sends done but keeps the socket open', async () => {
    const encoder = new TextEncoder()
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: answer\ndata: {"choices":[{"delta":{"content":"finished"}}]}\n\n'))
        controller.enqueue(encoder.encode('event: answer\ndata: [DONE]\n\n'))
      },
    })
    const onComplete = vi.fn().mockResolvedValue(null)
    const output = await new Response(withEvidencePersistence(
      upstream,
      onComplete,
      { emitEvidence: false, postDoneGraceMs: 10 }
    )).text()

    expect(output).toContain('finished')
    expect(output).toContain('event: done')
    expect(onComplete).toHaveBeenCalledWith(
      'finished',
      expect.objectContaining({ completed: true })
    )
  })

  it('strips provider detail events and evidence metadata from customer streams', async () => {
    const onComplete = vi.fn().mockResolvedValue({ messageId: 'saved-2' })
    const stream = withEvidencePersistence(
      streamFrom(toolEvents),
      onComplete,
      { emitEvidence: false }
    )

    const output = await new Response(stream).text()

    expect(output).toContain('Answer')
    expect(output).toContain('event: persisted')
    expect(output).toContain('event: done')
    expect(output).not.toContain('event: evidence')
    expect(output).not.toContain('toolResponse')
    expect(output).not.toContain('Login Guide.md')
  })
})
