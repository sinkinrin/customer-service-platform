/**
 * Shared helpers for AI streaming responses
 *
 * - createStreamResponse: build a standard SSE Response from a ReadableStream
 * - withStreamTimeout:   wrap an upstream stream with a safety timeout
 * - withSSEHeartbeat:    keep downstream proxies alive without affecting the upstream timeout
 * - withPersistence:     capture accumulated answer text for server-side persistence
 */

import { parseSSEEvent, getDeltaText } from './sse-parse'
import { createFastGPTEvidenceAccumulator, type AiAnswerEvidence } from './fastgpt-evidence'

const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 180_000
const DEFAULT_STREAM_HEARTBEAT_INTERVAL_MS = 15_000

function readDurationMs(
    value: string | undefined,
    fallback: number,
    range: { min: number; max: number }
): number {
    const parsed = Number.parseInt(value ?? '', 10)
    if (!Number.isFinite(parsed) || parsed < range.min || parsed > range.max) {
        return fallback
    }
    return parsed
}

function getStreamIdleTimeoutMs(): number {
    return readDurationMs(
        process.env.AI_STREAM_IDLE_TIMEOUT_MS,
        DEFAULT_STREAM_IDLE_TIMEOUT_MS,
        { min: 60_000, max: 600_000 }
    )
}

function getStreamHeartbeatIntervalMs(): number {
    return readDurationMs(
        process.env.AI_STREAM_HEARTBEAT_INTERVAL_MS,
        DEFAULT_STREAM_HEARTBEAT_INTERVAL_MS,
        { min: 5_000, max: 30_000 }
    )
}

/**
 * Wrap an upstream ReadableStream with an idle-timeout.
 * If no data arrives for `timeoutMs` the readable side is terminated
 * so the client (browser) connection is freed.
 */
export function withStreamTimeout(
    upstream: ReadableStream<Uint8Array>,
    timeoutMs = getStreamIdleTimeoutMs()
): ReadableStream<Uint8Array> {
    let timer: ReturnType<typeof setTimeout> | null = null
    let timedOut = false

    const reader = upstream.getReader()

    const resetTimer = (controller: ReadableStreamDefaultController<Uint8Array>) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            timedOut = true
            try {
                // Send an SSE error event before closing so the client can surface it
                const encoder = new TextEncoder()
                controller.enqueue(
                    encoder.encode('event: error\ndata: {"error":"Stream timeout - no data received"}\n\n')
                )
                controller.close()
            } catch {
                // stream already closed – ignore
            }
            // Cancel the upstream reader so inner wrappers (e.g. withPersistence)
            // get their cancel() callback and can finalize with partial text.
            reader.cancel().catch(() => {})
        }, timeoutMs)
    }

    return new ReadableStream<Uint8Array>({
        start(controller) {
            resetTimer(controller)
        },

        async pull(controller) {
            try {
                const { done, value } = await reader.read()
                if (timedOut) return
                if (done) {
                    if (timer) clearTimeout(timer)
                    controller.close()
                    return
                }
                resetTimer(controller)
                controller.enqueue(value)
            } catch (err) {
                if (timer) clearTimeout(timer)
                if (timedOut) return
                controller.error(err)
            }
        },

        async cancel() {
            if (timer) clearTimeout(timer)
            await reader.cancel().catch(() => {})
        },
    })
}

/**
 * Emit SSE comment frames while an upstream stream is quiet. The heartbeat is
 * deliberately composed outside withStreamTimeout so transport keepalives do
 * not reset the provider idle watchdog or enter persistence/evidence parsing.
 */
export function withSSEHeartbeat(
    upstream: ReadableStream<Uint8Array>,
    heartbeatMs = getStreamHeartbeatIntervalMs()
): ReadableStream<Uint8Array> {
    const reader = upstream.getReader()
    const heartbeat = new TextEncoder().encode(': heartbeat\n\n')
    let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = null
    let finished = false
    let frameTail = ''
    let atEventBoundary = true

    const getPendingRead = () => {
        pendingRead ??= reader.read()
        return pendingRead
    }

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            let heartbeatTimer: ReturnType<typeof setTimeout> | null = null

            try {
                const upstreamRead = getPendingRead().then(result => ({ type: 'upstream' as const, result }))
                const outcome = await Promise.race([
                    upstreamRead,
                    ...(atEventBoundary ? [new Promise<{ type: 'heartbeat' }>(resolve => {
                        heartbeatTimer = setTimeout(
                            () => resolve({ type: 'heartbeat' }),
                            heartbeatMs
                        )
                    })] : []),
                ])

                if (heartbeatTimer) clearTimeout(heartbeatTimer)
                if (finished) return

                if (outcome.type === 'heartbeat') {
                    controller.enqueue(heartbeat)
                    return
                }

                pendingRead = null
                if (outcome.result.done) {
                    finished = true
                    controller.close()
                    return
                }

                // Inspect only ASCII delimiters; never decode/re-encode payload bytes.
                for (const byte of outcome.result.value.subarray(-4)) {
                    frameTail = (frameTail + String.fromCharCode(byte)).slice(-4)
                }
                atEventBoundary = frameTail.endsWith('\n\n') || frameTail.endsWith('\r\n\r\n')
                controller.enqueue(outcome.result.value)
            } catch (error) {
                if (heartbeatTimer) clearTimeout(heartbeatTimer)
                if (finished) return
                finished = true
                controller.error(error)
            }
        },

        async cancel(reason) {
            finished = true
            await reader.cancel(reason).catch(() => {})
        },
    })
}

/**
 * Build a standard SSE Response object from a ReadableStream.
 * Applies an upstream idle timeout and an independent downstream heartbeat.
 */
export function createStreamResponse(
    stream: ReadableStream<Uint8Array>,
    timeoutMs: number | null = getStreamIdleTimeoutMs(),
    heartbeatMs: number | null = getStreamHeartbeatIntervalMs()
): Response {
    const timeoutProtectedStream = timeoutMs === null
        ? stream
        : withStreamTimeout(stream, timeoutMs)
    const safeStream = heartbeatMs === null
        ? timeoutProtectedStream
        : withSSEHeartbeat(timeoutProtectedStream, heartbeatMs)

    return new Response(safeStream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    })
}

/**
 * Capture the accumulated answer text of an AI SSE stream for server-side
 * persistence. Must wrap the raw upstream BEFORE withStreamTimeout so that
 * text received prior to a timeout/abort is still captured.
 *
 * - Terminal SSE event: persists first, then emits `event: persisted` before
 *   forwarding `[DONE]` / `event: done` / `event: error` to the client.
 * - EOF without a terminal event: persists and appends `event: persisted`.
 * - Client abort / timeout-induced cancel: attempts to persist partial text.
 */
export function withPersistence(
    upstream: ReadableStream<Uint8Array>,
    onComplete: (fullText: string, info: { completed: boolean }) => Promise<{ messageId: string } | null>
): ReadableStream<Uint8Array> {
    const reader = upstream.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()

    let buffer = ''
    let fullText = ''
    let finalized = false

    type TerminalEvent = 'done' | 'error'

    const consumeRawEvent = (rawEvent: string): TerminalEvent | null => {
        const { event, data } = parseSSEEvent(rawEvent)
        if (data === '[DONE]' || event === 'done') return 'done'
        if (event === 'error') return 'error'
        if (event === 'flowNodeStatus') return null
        fullText += getDeltaText(data)
        return null
    }

    const consumeBuffer = (flush = false): Array<{ rawEvent: string; terminal: TerminalEvent | null }> => {
        const events: Array<{ rawEvent: string; terminal: TerminalEvent | null }> = []
        let separatorIndex = buffer.indexOf('\n\n')
        while (separatorIndex !== -1) {
            const rawEvent = buffer.slice(0, separatorIndex)
            buffer = buffer.slice(separatorIndex + 2).replace(/^\n+/, '')
            events.push({ rawEvent, terminal: consumeRawEvent(rawEvent) })
            separatorIndex = buffer.indexOf('\n\n')
        }
        if (flush && buffer.trim()) {
            events.push({ rawEvent: buffer, terminal: consumeRawEvent(buffer) })
            buffer = ''
        }
        return events
    }

    const finalize = (completed: boolean): Promise<{ messageId: string } | null> => {
        if (finalized) return Promise.resolve(null)
        finalized = true
        consumeBuffer(true)
        return onComplete(fullText, { completed }).catch(() => null)
    }

    const enqueueEvent = (
        controller: ReadableStreamDefaultController<Uint8Array>,
        rawEvent: string
    ) => {
        controller.enqueue(encoder.encode(`${rawEvent}\n\n`))
    }

    const enqueuePersisted = (
        controller: ReadableStreamDefaultController<Uint8Array>,
        persisted: { messageId: string } | null
    ) => {
        if (persisted?.messageId) {
            enqueueEvent(controller, `event: persisted\ndata: ${JSON.stringify(persisted)}`)
        }
    }

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) {
                        const events = consumeBuffer(true)
                        const terminalIndex = events.findIndex(event => event.terminal)

                        if (terminalIndex !== -1) {
                            for (const event of events.slice(0, terminalIndex)) {
                                enqueueEvent(controller, event.rawEvent)
                            }
                            const terminalEvent = events[terminalIndex]
                            const persisted = await finalize(terminalEvent.terminal === 'done')
                            enqueuePersisted(controller, persisted)
                            enqueueEvent(controller, terminalEvent.rawEvent)
                            controller.close()
                            return
                        }

                        for (const event of events) {
                            enqueueEvent(controller, event.rawEvent)
                        }
                        const persisted = await finalize(true)
                        enqueuePersisted(controller, persisted)
                        controller.close()
                        return
                    }

                    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
                    const events = consumeBuffer()
                    if (events.length === 0) {
                        continue
                    }

                    const terminalIndex = events.findIndex(event => event.terminal)

                    if (terminalIndex === -1) {
                        for (const event of events) enqueueEvent(controller, event.rawEvent)
                        return
                    }

                    for (const event of events.slice(0, terminalIndex)) {
                        enqueueEvent(controller, event.rawEvent)
                    }

                    const terminalEvent = events[terminalIndex]
                    const persisted = await finalize(terminalEvent.terminal === 'done')
                    enqueuePersisted(controller, persisted)
                    enqueueEvent(controller, terminalEvent.rawEvent)
                    await reader.cancel().catch(() => {})
                    controller.close()
                    return
                }
            } catch (err) {
                await finalize(false)
                controller.error(err)
            }
        },

        async cancel() {
            await Promise.allSettled([
                finalize(false),
                reader.cancel(),
            ])
        },
    })
}

export function withEvidencePersistence(
    upstream: ReadableStream<Uint8Array>,
    onComplete: (
        fullText: string,
        info: { completed: boolean; evidence: AiAnswerEvidence }
    ) => Promise<{ messageId: string } | null>,
    options: { emitEvidence: boolean; postDoneGraceMs?: number }
): ReadableStream<Uint8Array> {
    const reader = upstream.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    const evidenceAccumulator = createFastGPTEvidenceAccumulator()

    let buffer = ''
    let fullText = ''
    let finalized = false
    let providerDoneSeen = false
    const postDoneGraceMs = options.postDoneGraceMs ?? 3_000

    type ProcessedEvent = {
        rawEvent: string
        forward: boolean
        error: boolean
    }

    const enqueueEvent = (
        controller: ReadableStreamDefaultController<Uint8Array>,
        rawEvent: string
    ) => {
        controller.enqueue(encoder.encode(`${rawEvent}\n\n`))
    }

    const processRawEvent = (rawEvent: string): ProcessedEvent => {
        const { event, data } = parseSSEEvent(rawEvent)
        evidenceAccumulator.consume(event, data)

        if (data === '[DONE]' || event === 'done') {
            providerDoneSeen = true
            return { rawEvent, forward: false, error: false }
        }
        if (event === 'error') {
            return { rawEvent, forward: true, error: true }
        }

        const delta = getDeltaText(data)
        if (delta) {
            fullText += delta
            return {
                rawEvent: `event: answer\ndata: ${JSON.stringify({
                    choices: [{ delta: { content: delta }, index: 0, finish_reason: null }],
                })}`,
                forward: true,
                error: false,
            }
        }

        if (event === 'flowNodeStatus') {
            try {
                const parsed = JSON.parse(data) as {
                    name?: unknown
                    moduleName?: unknown
                    status?: unknown
                }
                const safeStatus = {
                    ...(typeof parsed.name === 'string' ? { name: parsed.name } : {}),
                    ...(typeof parsed.moduleName === 'string' ? { moduleName: parsed.moduleName } : {}),
                    ...(typeof parsed.status === 'string' ? { status: parsed.status } : {}),
                }
                return {
                    rawEvent: `event: flowNodeStatus\ndata: ${JSON.stringify(safeStatus)}`,
                    forward: true,
                    error: false,
                }
            } catch {
                return { rawEvent, forward: false, error: false }
            }
        }

        return {
            rawEvent,
            forward: event === 'serverTiming',
            error: false,
        }
    }

    const consumeBuffer = (flush = false): ProcessedEvent[] => {
        const events: ProcessedEvent[] = []
        let separatorIndex = buffer.indexOf('\n\n')
        while (separatorIndex !== -1) {
            const rawEvent = buffer.slice(0, separatorIndex)
            buffer = buffer.slice(separatorIndex + 2).replace(/^\n+/, '')
            events.push(processRawEvent(rawEvent))
            separatorIndex = buffer.indexOf('\n\n')
        }
        if (flush && buffer.trim()) {
            events.push(processRawEvent(buffer))
            buffer = ''
        }
        return events
    }

    const finalize = async (completed: boolean) => {
        if (finalized) return { persisted: null, evidence: evidenceAccumulator.snapshot() }
        finalized = true
        const evidence = evidenceAccumulator.snapshot()
        const persisted = await onComplete(fullText, { completed, evidence }).catch(() => null)
        return { persisted, evidence }
    }

    const enqueueFinalMetadata = (
        controller: ReadableStreamDefaultController<Uint8Array>,
        result: Awaited<ReturnType<typeof finalize>>
    ) => {
        if (options.emitEvidence) {
            enqueueEvent(controller, `event: evidence\ndata: ${JSON.stringify(result.evidence)}`)
        }
        if (result.persisted?.messageId) {
            enqueueEvent(controller, `event: persisted\ndata: ${JSON.stringify(result.persisted)}`)
        }
    }

    const readNext = async (): Promise<
        | { timedOut: true }
        | { timedOut: false; result: ReadableStreamReadResult<Uint8Array> }
    > => {
        if (!providerDoneSeen) {
            return { timedOut: false, result: await reader.read() }
        }

        let timeoutId: ReturnType<typeof setTimeout> | undefined
        const timeout = new Promise<{ timedOut: true }>(resolve => {
            timeoutId = setTimeout(() => resolve({ timedOut: true }), postDoneGraceMs)
        })
        const read = reader.read().then(result => ({ timedOut: false as const, result }))
        const outcome = await Promise.race([read, timeout])
        if (timeoutId) clearTimeout(timeoutId)
        return outcome
    }

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            try {
                while (true) {
                    const readOutcome = await readNext()
                    if (readOutcome.timedOut) {
                        const result = await finalize(true)
                        enqueueFinalMetadata(controller, result)
                        enqueueEvent(controller, 'event: done\ndata: [DONE]')
                        await reader.cancel().catch(() => {})
                        controller.close()
                        return
                    }

                    const { done, value } = readOutcome.result
                    if (done) {
                        buffer += decoder.decode()
                        const events = consumeBuffer(true)
                        const errorEvent = events.find(event => event.error)
                        for (const event of events) {
                            if (event === errorEvent) break
                            if (event.forward) enqueueEvent(controller, event.rawEvent)
                        }

                        const result = await finalize(!errorEvent)
                        enqueueFinalMetadata(controller, result)

                        if (errorEvent) {
                            enqueueEvent(controller, errorEvent.rawEvent)
                        } else {
                            enqueueEvent(controller, 'event: done\ndata: [DONE]')
                        }
                        controller.close()
                        return
                    }

                    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
                    const events = consumeBuffer()
                    if (events.length === 0) continue

                    let forwarded = false
                    for (const event of events) {
                        if (event.error) {
                            const result = await finalize(false)
                            enqueueFinalMetadata(controller, result)
                            enqueueEvent(controller, event.rawEvent)
                            await reader.cancel().catch(() => {})
                            controller.close()
                            return
                        }
                        if (event.forward) {
                            enqueueEvent(controller, event.rawEvent)
                            forwarded = true
                        }
                    }
                    if (forwarded) return
                }
            } catch (error) {
                await finalize(false)
                controller.error(error)
            }
        },

        async cancel() {
            buffer += decoder.decode()
            consumeBuffer(true)
            await Promise.allSettled([
                finalize(false),
                reader.cancel(),
            ])
        },
    })
}

/**
 * Prefix an upstream SSE stream with one local SSE event.
 * Used by diagnostics so clients can measure from the API route receive time
 * without changing normal stream payloads.
 */
export function prependSSEEvent(
    upstream: ReadableStream<Uint8Array>,
    event: string,
    data: unknown
): ReadableStream<Uint8Array> {
    const reader = upstream.getReader()
    const encoder = new TextEncoder()
    let prefixed = false

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            if (!prefixed) {
                prefixed = true
                controller.enqueue(
                    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                )
            }

            const { done, value } = await reader.read()
            if (done) {
                controller.close()
                return
            }
            controller.enqueue(value)
        },

        cancel() {
            reader.cancel()
        },
    })
}
