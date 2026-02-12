interface AIChatApiResponse {
  success?: boolean
  data?: {
    message?: string
  }
  error?: string
  message?: string
}

/** Extract a human-readable status from a FastGPT flowNodeStatus SSE event */
function getFlowNodeStatus(data: string): string {
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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Progressively render text with a simulated typing effect.
 * Used only for non-streaming (JSON) responses to give a nicer feel.
 * For SSE streaming, we skip artificial delays since tokens arrive
 * naturally over time.
 */
async function progressivelyRenderText(
  text: string,
  onTextUpdate: (text: string) => void,
  getCurrentPrefix?: () => string
) {
  const base = getCurrentPrefix ? getCurrentPrefix() : ''
  if (!text) {
    onTextUpdate(base)
    return
  }

  let rendered = 0
  while (rendered < text.length) {
    const remaining = text.length - rendered
    const step = remaining > 64 ? 10 : remaining > 24 ? 6 : 3
    rendered = Math.min(rendered + step, text.length)
    onTextUpdate(base + text.slice(0, rendered))
    await sleep(16)
  }
}

function parseSSEEvent(rawEvent: string): { event: string; data: string } {
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

function getDeltaText(data: string): string {
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

function getErrorText(data: string): string {
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

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  if (!text) return `Request failed with status ${response.status}`

  try {
    const parsed = JSON.parse(text) as AIChatApiResponse
    return parsed.error || parsed.message || text
  } catch {
    return text
  }
}

async function readSSEText(
  response: Response,
  onTextUpdate: (text: string) => void,
  onStatusUpdate?: (status: string) => void
): Promise<string> {
  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let streamError = ''
  let doneReceived = false

  const processEvent = (rawEvent: string) => {
    const { event, data } = parseSSEEvent(rawEvent)
    if (!event && !data) return

    if (data === '[DONE]' || event === 'done') {
      doneReceived = true
      return
    }

    if (event === 'error') {
      streamError = getErrorText(data)
      doneReceived = true
      return
    }

    // FastGPT flowNodeStatus: tool/node execution status
    if (event === 'flowNodeStatus') {
      const nodeName = getFlowNodeStatus(data)
      if (nodeName && onStatusUpdate) {
        onStatusUpdate(nodeName)
      }
      return
    }

    const delta = getDeltaText(data)
    if (!delta) return

    // Answer text arrived — clear any tool status
    if (onStatusUpdate) onStatusUpdate('')

    // For SSE streaming, update immediately on each delta
    // No artificial delay – tokens arrive naturally over time
    fullText += delta
    onTextUpdate(fullText)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')

    // Split SSE events on double-newline boundary
    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)
      // Skip leading newlines left by triple-or-more linebreaks
      buffer = buffer.replace(/^\n+/, '')
      processEvent(rawEvent)

      if (doneReceived) {
        await reader.cancel()
        break
      }

      separatorIndex = buffer.indexOf('\n\n')
    }

    if (doneReceived) break
  }

  const rest = buffer.trim()
  if (rest) {
    processEvent(rest)
  }

  if (streamError) {
    throw new Error(streamError)
  }

  onTextUpdate(fullText)

  return fullText
}

export async function readAIChatResponse(
  response: Response,
  onTextUpdate: (text: string) => void,
  onStatusUpdate?: (status: string) => void
): Promise<string> {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/event-stream')) {
    return readSSEText(response, onTextUpdate, onStatusUpdate)
  }

  const payload = (await response.json()) as AIChatApiResponse
  if (!payload.success) {
    throw new Error(payload.error || 'Failed to get AI response')
  }

  const message = payload.data?.message || ''
  await progressivelyRenderText(message, onTextUpdate)
  return message
}
