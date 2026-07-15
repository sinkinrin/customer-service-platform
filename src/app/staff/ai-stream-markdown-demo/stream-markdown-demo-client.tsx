'use client'

import { useEffect, useRef, useState } from 'react'
import NodeRenderer, {
  removeCustomComponents,
  setCustomComponents,
  type NodeComponentProps,
} from 'markstream-react/next'
import { Loader2, Play, Square } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownMessage } from '@/components/conversation/markdown-message'
import { getDeltaText, getErrorText, parseSSEEvent } from '@/lib/ai/sse-parse'
import { cn } from '@/lib/utils'

const MARKSTREAM_CUSTOM_ID = 'ai-stream-markdown-demo'

const DEFAULT_PROMPT = `请用 Markdown 回答：给我一个客服 AI 流式渲染测试样例，包含：

1. 一个三列表格
2. 一段 TypeScript 代码块
3. 一个引用块
4. 一个简短列表`

type StreamState = 'idle' | 'streaming' | 'done' | 'error'
type PaneKey = 'current' | 'markstream'

interface StreamMetrics {
  clientRequestStartedAt?: number
  serverTimingEventReceivedAt?: number
  serverElapsedToTimingEventMs?: number
  responseHeadersMs?: number
  firstTokenReceivedAt?: number
  completedAt?: number
  receivedChars: number
}

interface RenderMetrics {
  firstRenderedAt?: number
  renderedChars: number
  renderedCharsPerSecond: number
}

const emptyStreamMetrics = (): StreamMetrics => ({
  receivedChars: 0,
})

const emptyRenderMetrics = (): RenderMetrics => ({
  renderedChars: 0,
  renderedCharsPerSecond: 0,
})

function formatMs(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${Math.max(0, Math.round(value))} ms`
}

function formatRate(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '-'
  return `${Math.round(value)} chars/s`
}

export function AiStreamMarkdownDemoClient() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [content, setContent] = useState('')
  const [state, setState] = useState<StreamState>('idle')
  const [toolStatus, setToolStatus] = useState('')
  const [error, setError] = useState('')
  const [streamMetrics, setStreamMetrics] = useState<StreamMetrics>(emptyStreamMetrics)
  const [renderMetrics, setRenderMetrics] = useState<Record<PaneKey, RenderMetrics>>({
    current: emptyRenderMetrics(),
    markstream: emptyRenderMetrics(),
  })

  const currentRef = useRef<HTMLDivElement | null>(null)
  const markstreamRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamMetricsRef = useRef<StreamMetrics>(emptyStreamMetrics())

  const isStreaming = state === 'streaming'
  const isFinal = state === 'done' || state === 'error'

  useEffect(() => {
    setCustomComponents(MARKSTREAM_CUSTOM_ID, {
      code_block: MarkstreamCodeBlock,
    })

    return () => {
      abortRef.current?.abort()
      removeCustomComponents(MARKSTREAM_CUSTOM_ID)
    }
  }, [])

  const updateStreamMetrics = (update: Partial<StreamMetrics>) => {
    streamMetricsRef.current = {
      ...streamMetricsRef.current,
      ...update,
    }
    setStreamMetrics(streamMetricsRef.current)
  }

  useEffect(() => {
    if (!content) return

    const measurePane = (pane: PaneKey, element: HTMLDivElement | null) => {
      if (!element) return
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const renderedChars = element.innerText.trim().length
          if (!renderedChars) return

          setRenderMetrics((prev) => {
            const now = Date.now()
            const firstRenderedAt = prev[pane].firstRenderedAt || now
            const elapsedMs = now - firstRenderedAt
            const renderedCharsPerSecond = elapsedMs >= 250
              ? renderedChars / (elapsedMs / 1000)
              : 0

            return {
              ...prev,
              [pane]: {
                firstRenderedAt,
                renderedChars,
                renderedCharsPerSecond,
              },
            }
          })
        })
      })
    }

    measurePane('current', currentRef.current)
    measurePane('markstream', markstreamRef.current)
  }, [content])

  const stop = () => {
    abortRef.current?.abort()
  }

  const run = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt || isStreaming) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const clientRequestStartedAt = Date.now()
    streamMetricsRef.current = {
      ...emptyStreamMetrics(),
      clientRequestStartedAt,
    }

    setContent('')
    setToolStatus('')
    setError('')
    setState('streaming')
    setStreamMetrics(streamMetricsRef.current)
    setRenderMetrics({
      current: emptyRenderMetrics(),
      markstream: emptyRenderMetrics(),
    })

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: `markdown-demo-${Date.now()}`,
          message: trimmedPrompt,
          history: [],
          stream: true,
          debugTiming: true,
          mode: 'flash',
        }),
        signal: controller.signal,
      })

      updateStreamMetrics({
        responseHeadersMs: Date.now() - clientRequestStartedAt,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Request failed with status ${response.status}`)
      }
      if (!response.body) {
        throw new Error('No response body')
      }

      await readTimedStream(response, {
        onServerTiming: (timing) => updateStreamMetrics(timing),
        onText: (nextText) => {
          if (!streamMetricsRef.current.firstTokenReceivedAt && nextText) {
            updateStreamMetrics({ firstTokenReceivedAt: Date.now() })
          }
          updateStreamMetrics({ receivedChars: nextText.length })
          setContent(nextText)
        },
        onStatus: setToolStatus,
      })

      updateStreamMetrics({ completedAt: Date.now() })
      setState('done')
    } catch (err) {
      if (
        err instanceof DOMException && err.name === 'AbortError' ||
        (err as { name?: string })?.name === 'AbortError'
      ) {
        updateStreamMetrics({ completedAt: Date.now() })
        setState(streamMetricsRef.current.receivedChars > 0 ? 'done' : 'idle')
        return
      }

      setError(err instanceof Error ? err.message : 'AI request failed')
      updateStreamMetrics({ completedAt: Date.now() })
      setState('error')
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      setToolStatus('')
    }
  }

  return (
    <div className="ai-stream-demo flex h-[calc(100vh-5rem)] flex-col bg-background">
      <div className="border-b bg-background px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <h1 className="text-xl font-semibold">AI Markdown Stream Demo</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One /api/ai/chat stream rendered by the current path and markstream-react.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={run} disabled={isStreaming || !prompt.trim()}>
              {isStreaming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run
            </Button>
            <Button variant="outline" onClick={stop} disabled={!isStreaming}>
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          </div>
        </div>

        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={isStreaming}
          className="mt-4 min-h-28 resize-y"
        />

        <TimingPanel
          state={state}
          error={error}
          toolStatus={toolStatus}
          streamMetrics={streamMetrics}
          renderMetrics={renderMetrics}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <RenderPane title="Current renderer" subtitle="readAIChatResponse-compatible parse + MarkdownMessage">
          <div
            ref={currentRef}
            className={cn('prose-current min-h-24', !content && 'text-muted-foreground')}
          >
            {content ? <MarkdownMessage content={content} /> : 'Waiting for stream...'}
          </div>
        </RenderPane>

        <RenderPane title="markstream-react" subtitle="NodeRenderer content mode">
          <div
            ref={markstreamRef}
            className={cn('min-h-24', !content && 'text-muted-foreground')}
          >
            {content ? (
              <NodeRenderer
                content={content}
                final={isFinal}
                typewriter
                viewportPriority
                deferNodesUntilVisible
                codeBlockStream={isStreaming}
                htmlPolicy="escape"
                customId={MARKSTREAM_CUSTOM_ID}
              />
            ) : (
              'Waiting for stream...'
            )}
          </div>
        </RenderPane>
      </div>
    </div>
  )
}

function MarkstreamCodeBlock({
  node,
}: NodeComponentProps<{ language?: string; code?: string }>) {
  const language = String(node?.language || '').trim()
  const code = String(node?.code || '').replace(/\n$/, '')

  return (
    <div className="markstream-adapted-code my-2 overflow-hidden rounded-lg">
      <SyntaxHighlighter
        style={oneDark as Record<string, React.CSSProperties>}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '13px',
          borderRadius: '0.5rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

async function readTimedStream(
  response: Response,
  callbacks: {
    onServerTiming: (timing: Partial<StreamMetrics>) => void
    onText: (text: string) => void
    onStatus: (status: string) => void
  }
): Promise<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let streamError = ''
  let doneReceived = false

  const processEvent = (rawEvent: string) => {
    const { event, data } = parseSSEEvent(rawEvent)
    if (!event && !data) return

    if (event === 'serverTiming') {
      try {
        const timing = JSON.parse(data) as {
          serverReceivedAt?: number
          upstreamStreamReadyAt?: number
        }
        const serverElapsedToTimingEventMs =
          typeof timing.serverReceivedAt === 'number' &&
          typeof timing.upstreamStreamReadyAt === 'number'
            ? timing.upstreamStreamReadyAt - timing.serverReceivedAt
            : undefined

        callbacks.onServerTiming({
          serverTimingEventReceivedAt: Date.now(),
          serverElapsedToTimingEventMs,
        })
      } catch {
        // Ignore malformed diagnostic events.
      }
      return
    }

    if (data === '[DONE]' || event === 'done') {
      doneReceived = true
      return
    }

    if (event === 'error') {
      streamError = getErrorText(data)
      doneReceived = true
      return
    }

    if (event === 'flowNodeStatus') {
      try {
        const parsed = JSON.parse(data) as { name?: string; moduleName?: string }
        callbacks.onStatus(parsed.name || parsed.moduleName || '')
      } catch {
        callbacks.onStatus('')
      }
      return
    }

    const delta = getDeltaText(data)
    if (!delta) return

    callbacks.onStatus('')
    fullText += delta
    callbacks.onText(fullText)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2).replace(/^\n+/, '')
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
  if (rest) processEvent(rest)
  if (streamError) throw new Error(streamError)

  callbacks.onText(fullText)
  return fullText
}

function TimingPanel({
  state,
  error,
  toolStatus,
  streamMetrics,
  renderMetrics,
}: {
  state: StreamState
  error: string
  toolStatus: string
  streamMetrics: StreamMetrics
  renderMetrics: Record<PaneKey, RenderMetrics>
}) {
  const elapsedFromServerStart = (clientTimestamp?: number) => {
    if (
      typeof clientTimestamp !== 'number' ||
      typeof streamMetrics.serverTimingEventReceivedAt !== 'number' ||
      typeof streamMetrics.serverElapsedToTimingEventMs !== 'number'
    ) {
      return undefined
    }

    return streamMetrics.serverElapsedToTimingEventMs +
      (clientTimestamp - streamMetrics.serverTimingEventReceivedAt)
  }

  const firstTokenFromServer = elapsedFromServerStart(streamMetrics.firstTokenReceivedAt)
  const currentFirstPaint = elapsedFromServerStart(renderMetrics.current.firstRenderedAt)
  const markstreamFirstPaint = elapsedFromServerStart(renderMetrics.markstream.firstRenderedAt)
  const streamDurationSeconds = streamMetrics.firstTokenReceivedAt
    ? ((streamMetrics.completedAt || Date.now()) - streamMetrics.firstTokenReceivedAt) / 1000
    : 0
  const receiveRate = streamDurationSeconds > 0
    ? streamMetrics.receivedChars / streamDurationSeconds
    : 0

  return (
    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="State" value={state} />
      <Metric label="Headers" value={formatMs(streamMetrics.responseHeadersMs)} />
      <Metric label="First token" value={formatMs(firstTokenFromServer)} />
      <Metric label="Receive speed" value={formatRate(receiveRate)} />
      <Metric label="Current first paint" value={formatMs(currentFirstPaint)} />
      <Metric label="Current render speed" value={formatRate(renderMetrics.current.renderedCharsPerSecond)} />
      <Metric label="Markstream first paint" value={formatMs(markstreamFirstPaint)} />
      <Metric label="Markstream render speed" value={formatRate(renderMetrics.markstream.renderedCharsPerSecond)} />
      {toolStatus && <Metric label="Tool" value={toolStatus} />}
      {error && <Metric label="Error" value={error} destructive />}
    </div>
  )
}

function Metric({
  label,
  value,
  destructive = false,
}: {
  label: string
  value: string
  destructive?: boolean
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-normal">{label}</div>
      <div className={cn('mt-1 font-mono text-sm text-foreground', destructive && 'text-destructive')}>
        {value}
      </div>
    </div>
  )
}

function RenderPane({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="flex min-h-0 flex-col border-r last:border-r-0">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {children}
      </div>
    </section>
  )
}
