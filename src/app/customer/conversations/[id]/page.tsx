/**
 * Conversation Detail Page - Customer View
 *
 * AI-only conversation mode with thumbs up/down rating on AI responses
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { MessageList } from '@/components/conversation/message-list'
import { MessageInput } from '@/components/conversation/message-input'
import { ConversationHeader } from '@/components/conversation/conversation-header'
import { FeedbackDialog } from '@/components/ai/feedback-dialog'
import { toast } from 'sonner'
import { Loading } from '@/components/common/loading'
import { useTranslations } from 'next-intl'
import { ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStreamingChat } from '@/hooks/use-streaming-chat'

interface AiMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  rating?: 'positive' | 'negative' | null
  feedback?: string | null
}

export default function ConversationDetailPage() {
  const t = useTranslations('customer.conversations.detail')
  const tPlaceholders = useTranslations('customer.conversations.placeholders')
  const tToast = useTranslations('toast.customer.conversations')
  const tRate = useTranslations('aiChat.rate')

  const params = useParams()
  const conversationId = params.id as string

  const [aiMessages, setAiMessages] = useState<AiMsg[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  // Feedback dialog state
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [pendingRatingMessageId, setPendingRatingMessageId] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const { isLoading: isAiLoading, isWaitingFirstToken, toolStatus, sendStreamingRequest } = useStreamingChat({
    onAddMessage: (id, content) => {
      setAiMessages(prev => [
        ...prev,
        {
          id,
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
        },
      ])
    },
    onUpdateMessage: (id, content) => {
      setAiMessages(prev =>
        prev.map(msg => (msg.id === id ? { ...msg, content } : msg))
      )
    },
    onRemoveMessage: (id) => {
      setAiMessages(prev => prev.filter(msg => msg.id !== id))
    },
    onError: (error: any) => {
      if (error?.message?.includes('FastGPT')) {
        toast.error(tToast('aiUnavailable'))
      } else if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        toast.error(tToast('networkError'))
      } else {
        toast.error(tToast('aiError'))
      }
    },
  })

  // Load existing AI messages on mount
  useEffect(() => {
    if (conversationId) {
      const loadMessages = async () => {
        try {
          setIsInitialLoading(true)
          const response = await fetch(`/api/conversations/${conversationId}/messages?limit=1000`)
          const data = await response.json()

          if (data.success && data.data?.messages) {
            const aiModeMessages = data.data.messages
              .filter((msg: any) => msg.metadata?.aiMode)
              .reverse()
              .map((msg: any) => ({
                id: msg.id,
                role: msg.metadata?.role === 'ai' ? 'assistant' as const : 'user' as const,
                content: msg.content,
                timestamp: msg.created_at,
                rating: msg.rating?.rating || null,
                feedback: msg.rating?.feedback || null,
              }))

            if (aiModeMessages.length > 0) {
              setAiMessages(aiModeMessages)
            }
          }
        } catch (error) {
          console.error('Failed to load AI messages:', error)
        } finally {
          setIsInitialLoading(false)
        }
      }

      loadMessages()

      // Mark conversation as read
      fetch(`/api/conversations/${conversationId}/mark-read`, {
        method: 'POST',
      }).catch((error) => {
        console.error('Failed to mark conversation as read:', error)
      })
    }
  }, [conversationId])

  // Rate a message
  const submitRating = useCallback(async (
    messageId: string,
    rating: 'positive' | 'negative' | null,
    feedback?: string
  ) => {
    // Optimistic update
    setAiMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? {
            ...msg,
            rating,
            feedback: rating === 'positive' ? null : (feedback || null),
          }
          : msg
      )
    )

    try {
      await fetch(
        `/api/conversations/${conversationId}/messages/${messageId}/rating`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, feedback }),
        }
      )
    } catch (error) {
      console.error('Failed to rate message:', error)
      // Revert optimistic update on error
      setAiMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, rating: null, feedback: null }
            : msg
        )
      )
    }
  }, [conversationId])

  // Handle thumbs up click
  const handleThumbsUp = useCallback((messageId: string, currentRating: string | null | undefined) => {
    if (currentRating === 'positive') {
      // Already positive -> remove rating
      submitRating(messageId, null)
    } else {
      // Switch to positive -> clear feedback
      submitRating(messageId, 'positive')
    }
  }, [submitRating])

  // Handle thumbs down click
  const handleThumbsDown = useCallback((messageId: string, currentRating: string | null | undefined) => {
    if (currentRating === 'negative') {
      // Already negative -> remove rating
      submitRating(messageId, null)
    } else {
      // Switch to negative -> show feedback dialog
      setPendingRatingMessageId(messageId)
      setFeedbackDialogOpen(true)
    }
  }, [submitRating])

  // Handle feedback dialog submission
  const handleFeedbackSubmit = useCallback((feedback?: string) => {
    if (pendingRatingMessageId) {
      submitRating(pendingRatingMessageId, 'negative', feedback)
      setPendingRatingMessageId(null)
    }
  }, [pendingRatingMessageId, submitRating])

  // Handle copy message content
  const handleCopy = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    }
  }, [])

  // Handle AI chat with duplicate prevention
  const handleAIMessage = async (content: string) => {
    // Prevent duplicate submissions
    if (isAiLoading) return

    // Trim and validate content
    const trimmedContent = content.trim()
    if (!trimmedContent) return

    const newUserMessage: AiMsg = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: trimmedContent,
      timestamp: new Date().toISOString(),
    }
    setAiMessages(prev => [...prev, newUserMessage])

    // Persist user message
    let persistedUserMsgId: string | null = null
    try {
      const persistRes = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmedContent,
          message_type: 'text',
          metadata: { aiMode: true, role: 'customer' }
        }),
      })
      const persistData = await persistRes.json()
      if (persistData.success && persistData.data?.id) {
        persistedUserMsgId = persistData.data.id
        setAiMessages(prev =>
          prev.map(msg =>
            msg.id === newUserMessage.id
              ? { ...msg, id: persistedUserMsgId! }
              : msg
          )
        )
      }
    } catch (error) {
      console.error('Failed to persist user AI message:', error)
    }

    const tempAiMessageId = `temp-ai-${Date.now()}`

    // Send streaming AI request via hook
    const aiContent = await sendStreamingRequest(
      '/api/ai/chat',
      {
        conversationId,
        message: trimmedContent,
        history: aiMessages.map(msg => ({ role: msg.role, content: msg.content })),
      },
      tempAiMessageId,
    )

    if (!aiContent) return // aborted or error (hook already handled cleanup)

    // Persist AI response and get the real message id
    let aiMsgId = tempAiMessageId
    try {
      const aiPersistRes = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: aiContent,
          message_type: 'text',
          metadata: { aiMode: true, role: 'ai' }
        }),
      })
      const aiPersistData = await aiPersistRes.json()
      if (aiPersistData.success && aiPersistData.data?.id) {
        aiMsgId = aiPersistData.data.id
      }
    } catch (error) {
      console.error('Failed to persist AI response:', error)
    }

    setAiMessages(prev =>
      prev.map(msg =>
        msg.id === tempAiMessageId
          ? { ...msg, id: aiMsgId, content: aiContent }
          : msg
      )
    )
  }

  if (isInitialLoading) {
    return <Loading fullScreen text={t('loadingText')} />
  }

  // Convert AI messages to display format with rating buttons
  const displayMessages = aiMessages.map((msg) => ({
    id: msg.id,
    conversation_id: conversationId,
    sender_id: msg.role === 'user' ? 'user' : 'ai',
    content: msg.content,
    message_type: 'text' as const,
    metadata: {},
    created_at: msg.timestamp,
    updated_at: msg.timestamp,
    sender: {
      id: msg.role === 'user' ? 'user' : 'ai',
      full_name: msg.role === 'user' ? t('me') : t('aiAssistant'),
      avatar_url: undefined,
      role: msg.role === 'user' ? ('customer' as const) : ('staff' as const),
    },
  }))

  return (
    <div className="flex flex-col bg-gradient-to-b from-background to-muted/20 flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4">
          <ConversationHeader mode="ai" currentConversationId={conversationId} />
        </div>
      </div>

      {/* Messages - Scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="max-w-4xl mx-auto px-4">
          <MessageList
            messages={displayMessages}
            isLoading={false}
            isTyping={false}
            typingUser={null}
            isAiLoading={isWaitingFirstToken}
            aiToolStatus={toolStatus}
            renderMessageActions={(message) => {
              // Only show rating buttons for AI messages
              const aiMsg = aiMessages.find(m => m.id === message.id)
              if (!aiMsg || aiMsg.role !== 'assistant') return null

              return (
                <div className="flex items-center gap-1 mt-1">
                  <button
                    onClick={() => handleThumbsUp(message.id, aiMsg.rating)}
                    className={cn(
                      'p-1 rounded-md transition-colors hover:bg-muted',
                      aiMsg.rating === 'positive'
                        ? 'text-green-600'
                        : 'text-muted-foreground/50 hover:text-muted-foreground'
                    )}
                    title={tRate('helpful')}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleThumbsDown(message.id, aiMsg.rating)}
                    className={cn(
                      'p-1 rounded-md transition-colors hover:bg-muted',
                      aiMsg.rating === 'negative'
                        ? 'text-red-600'
                        : 'text-muted-foreground/50 hover:text-muted-foreground'
                    )}
                    title={tRate('notHelpful')}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleCopy(message.id, message.content)}
                    className={cn(
                      'p-1 rounded-md transition-colors hover:bg-muted',
                      copiedMessageId === message.id
                        ? 'text-green-600'
                        : 'text-muted-foreground/50 hover:text-muted-foreground'
                    )}
                    title={copiedMessageId === message.id ? tRate('copied') : tRate('copy')}
                  >
                    {copiedMessageId === message.id ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )
            }}
          />
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 bg-gradient-to-t from-background via-background to-background/80 pt-2 pb-4">
        <div className="max-w-4xl mx-auto px-4">
          <MessageInput
            onSend={handleAIMessage}
            isSending={isAiLoading}
            disabled={isAiLoading}
            placeholder={tPlaceholders('aiMode')}
          />
          <p className="text-[11px] text-muted-foreground/60 text-center mt-2 pb-[env(safe-area-inset-bottom)]">
            {t('aiDisclaimer')}
          </p>
        </div>
      </div>

      {/* Feedback Dialog */}
      <FeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  )
}
