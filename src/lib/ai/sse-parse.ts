/**
 * Shared SSE event parsing for AI chat streams.
 * Used by both the browser stream reader (stream-client.ts) and the
 * server-side persistence capture (stream-helpers.ts) so that the text
 * accumulated on each side is parsed identically.
 */

export function parseSSEEvent(rawEvent: string): { event: string; data: string } {
  const lines = rawEvent.replace(/\r/g, '').split('\n')
  let event = ''
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  return {
    event,
    data: dataLines.join('\n'),
  }
}

/** Extract the answer delta text from an SSE data payload (FastGPT / OpenAI-compatible). */
export function getDeltaText(data: string): string {
  if (!data || data === '[DONE]') return ''

  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: unknown }; message?: { content?: unknown } }>
      response?: unknown
    }
    const delta = parsed.choices?.[0]?.delta?.content
    if (typeof delta === 'string') return delta

    const message = parsed.choices?.[0]?.message?.content
    if (typeof message === 'string') return message

    const response = parsed.response
    if (typeof response === 'string') return response
  } catch {
    return ''
  }

  return ''
}

export function getErrorText(data: string): string {
  if (!data) return 'AI response failed'
  try {
    const parsed = JSON.parse(data) as { error?: unknown; message?: unknown }
    if (typeof parsed.error === 'string') return parsed.error
    if (typeof parsed.message === 'string') return parsed.message
  } catch {
    return data
  }
  return 'AI response failed'
}

/** Extract a human-readable status from a FastGPT flowNodeStatus SSE event */
export function getFlowNodeStatus(data: string): string {
  if (!data) return ''
  try {
    const parsed = JSON.parse(data) as {
      name?: string
      status?: string
      moduleName?: string
      moduleType?: string
    }
    // FastGPT sends node name in various fields depending on version
    return parsed.name || parsed.moduleName || ''
  } catch {
    return ''
  }
}
