'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { readAIChatResponse } from '@/lib/ai/stream-client'

export interface StreamingChatActions {
    /** Whether a streaming request is currently in-flight */
    isLoading: boolean
    /** True between sending the request and receiving the first token */
    isWaitingFirstToken: boolean
    /** Human-readable tool / flow-node status from FastGPT (empty string when idle) */
    toolStatus: string
    /**
     * Send a streaming chat request.
     *
     * @param url     API endpoint (e.g. `/api/ai/chat`)
     * @param body    JSON body to POST
     * @param messageId  ID to pass to onAddMessage / onUpdateMessage
     * @returns the full assistant text, or empty string on abort
     */
    sendStreamingRequest: (
        url: string,
        body: Record<string, unknown>,
        messageId: string,
    ) => Promise<string>
    /** Abort the current in-flight request (if any) */
    abort: () => void
}

export interface StreamingChatCallbacks {
    /** Called once when the first token arrives — add the AI message bubble */
    onAddMessage: (id: string, content: string) => void
    /** Called on every subsequent delta — update the AI message content */
    onUpdateMessage: (id: string, content: string) => void
    /** Called when the request fails — remove the temporary AI message */
    onRemoveMessage: (id: string) => void
    /** Called when an error occurs (after cleanup). Use for toast notifications. */
    onError?: (error: unknown) => void
}

/**
 * Custom hook that encapsulates SSE streaming chat logic shared between
 * the customer conversation page and the staff AI assistant panel.
 *
 * Handles:
 * - AbortController lifecycle (auto-abort on unmount)
 * - isWaitingFirstToken / toolStatus state
 * - readAIChatResponse callbacks
 * - AbortError silent handling
 */
export function useStreamingChat(callbacks: StreamingChatCallbacks): StreamingChatActions {
    const [isLoading, setIsLoading] = useState(false)
    const [isWaitingFirstToken, setIsWaitingFirstToken] = useState(false)
    const [toolStatus, setToolStatus] = useState('')
    const abortRef = useRef<AbortController | null>(null)

    // Keep callbacks in a ref so the streaming closure always sees the latest
    const cbRef = useRef(callbacks)
    cbRef.current = callbacks

    // Abort in-flight request on unmount
    useEffect(() => {
        return () => {
            abortRef.current?.abort()
        }
    }, [])

    const abort = useCallback(() => {
        abortRef.current?.abort()
    }, [])

    const sendStreamingRequest = useCallback(
        async (
            url: string,
            body: Record<string, unknown>,
            messageId: string,
        ): Promise<string> => {
            // Abort any previous in-flight request
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller

            setIsLoading(true)
            setIsWaitingFirstToken(true)

            let aiMessageAdded = false

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...body, stream: true }),
                    signal: controller.signal,
                })

                const fullText = await readAIChatResponse(
                    response,
                    (nextText) => {
                        if (!aiMessageAdded) {
                            aiMessageAdded = true
                            setIsWaitingFirstToken(false)
                            cbRef.current.onAddMessage(messageId, nextText)
                        } else {
                            cbRef.current.onUpdateMessage(messageId, nextText)
                        }
                    },
                    (status) => {
                        setToolStatus(status)
                        if (status && !aiMessageAdded) setIsWaitingFirstToken(true)
                    },
                )

                if (!fullText.trim()) {
                    throw new Error('Failed to get AI response')
                }

                return fullText
            } catch (error) {
                // AbortError is intentional — not a real error
                if (
                    error instanceof DOMException && error.name === 'AbortError' ||
                    (error as any)?.name === 'AbortError'
                ) {
                    return ''
                }

                // Clean up the temporary AI message
                if (aiMessageAdded) {
                    cbRef.current.onRemoveMessage(messageId)
                }

                cbRef.current.onError?.(error)
                return ''
            } finally {
                setIsLoading(false)
                setIsWaitingFirstToken(false)
                setToolStatus('')
            }
        },
        [],
    )

    return {
        isLoading,
        isWaitingFirstToken,
        toolStatus,
        sendStreamingRequest,
        abort,
    }
}
