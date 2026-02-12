/**
 * Shared helpers for AI streaming responses
 *
 * - createStreamResponse: build a standard SSE Response from a ReadableStream
 * - withStreamTimeout:   wrap an upstream stream with a safety timeout
 */

const STREAM_TIMEOUT_MS = 60_000 // 60 seconds

/**
 * Wrap an upstream ReadableStream with an idle-timeout.
 * If no data arrives for `timeoutMs` the readable side is terminated
 * so the client (browser) connection is freed.
 */
export function withStreamTimeout(
    upstream: ReadableStream<Uint8Array>,
    timeoutMs = STREAM_TIMEOUT_MS
): ReadableStream<Uint8Array> {
    let timer: ReturnType<typeof setTimeout> | null = null

    const resetTimer = (controller: ReadableStreamDefaultController<Uint8Array>) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
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
        }, timeoutMs)
    }

    const reader = upstream.getReader()

    return new ReadableStream<Uint8Array>({
        start(controller) {
            resetTimer(controller)
        },

        async pull(controller) {
            try {
                const { done, value } = await reader.read()
                if (done) {
                    if (timer) clearTimeout(timer)
                    controller.close()
                    return
                }
                resetTimer(controller)
                controller.enqueue(value)
            } catch (err) {
                if (timer) clearTimeout(timer)
                controller.error(err)
            }
        },

        cancel() {
            if (timer) clearTimeout(timer)
            reader.cancel()
        },
    })
}

/**
 * Build a standard SSE Response object from a ReadableStream.
 * Automatically applies idle-timeout protection.
 */
export function createStreamResponse(
    stream: ReadableStream<Uint8Array>,
    timeoutMs = STREAM_TIMEOUT_MS
): Response {
    const safeStream = withStreamTimeout(stream, timeoutMs)

    return new Response(safeStream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    })
}
