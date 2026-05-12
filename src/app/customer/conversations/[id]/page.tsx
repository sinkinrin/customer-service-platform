/**
 * Conversation Detail Page - Customer View
 *
 * AI-only conversation mode with thumbs up/down rating on AI responses
 */

'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { MessageList } from '@/components/conversation/message-list'
import { MessageInput } from '@/components/conversation/message-input'
import { ConversationHeader } from '@/components/conversation/conversation-header'
import { FeedbackDialog } from '@/components/ai/feedback-dialog'
import { toast } from 'sonner'
import { Loading } from '@/components/common/loading'
import { useTranslations } from 'next-intl'
import { ThumbsUp, ThumbsDown, Copy, Check, Sparkles, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStreamingChat } from '@/hooks/use-streaming-chat'
import {
  HISTORY_CACHE_TTL_MS,
  HISTORY_MESSAGE_PAGE_SIZE,
  getConversationAiChatModeKey,
  getConversationJustCreatedKey,
  getConversationLastVisitKey,
} from '@/lib/constants/conversation'
import { useConversation } from '@/lib/hooks/use-conversation'
import { useConversationStore, type Conversation } from '@/lib/stores/conversation-store'

interface AiMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  rating?: 'positive' | 'negative' | null
  feedback?: string | null
}

type AIChatMode = 'flash' | 'pro'

function toMillis(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export default function ConversationDetailPage() {
  const t = useTranslations('customer.conversations.detail')
  const tPlaceholders = useTranslations('customer.conversations.placeholders')
  const tToast = useTranslations('toast.customer.conversations')
  const tRate = useTranslations('aiChat.rate')

  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const conversationId = params.id as string
  const { user } = useAuth()
  const {
    fetchHistoryConversations,
    fetchHistoryMessages,
    fetchConversationById,
    historyListCache,
    applyRatingToCache,
    appendHistoryMessageToCache,
    userId,
  } = useConversation()

  const [aiMessages, setAiMessages] = useState<AiMsg[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [aiChatMode, setAiChatMode] = useState<AIChatMode>('flash')
  const [isAiChatModeLoaded, setIsAiChatModeLoaded] = useState(false)

  // Feedback dialog state
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [pendingRatingMessageId, setPendingRatingMessageId] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [loadedHistoryList, setLoadedHistoryList] = useState<Conversation[]>([])
  const [historyMessageOffset, setHistoryMessageOffset] = useState(0)
  const [historyMessageHasMore, setHistoryMessageHasMore] = useState(false)
  const [isLoadingEarlierMessages, setIsLoadingEarlierMessages] = useState(false)
  const messageRequestGenRef = useRef(0)
  const historyRequestGenRef = useRef(0)

  const historyMessageCacheKey = useMemo(() => (userId ? `${userId}:${conversationId}` : null), [userId, conversationId])
  const cachedHistoryListEntry = userId ? historyListCache[userId] : null
  const hasUsableHistoryListCache = Boolean(
    cachedHistoryListEntry?.items?.length &&
    cachedHistoryListEntry?.updatedAt &&
    Date.now() - cachedHistoryListEntry.updatedAt <= HISTORY_CACHE_TTL_MS
  )

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

  useEffect(() => {
    historyRequestGenRef.current += 1
    setHistoryLoading(false)
    setHistoryError(null)
    setHistoryOffset(0)
    setHistoryHasMore(false)
    setLoadedHistoryList([])
  }, [conversationId])

  useEffect(() => {
    messageRequestGenRef.current += 1
    setAiMessages([])
    setHistoryMessageOffset(0)
    setHistoryMessageHasMore(false)
    setIsLoadingEarlierMessages(false)
    setIsInitialLoading(true)
  }, [conversationId])

  useEffect(() => {
    historyRequestGenRef.current += 1
    messageRequestGenRef.current += 1
    setHistoryOpen(false)
    setHistoryLoading(false)
    setHistoryError(null)
    setHistoryOffset(0)
    setHistoryHasMore(false)
    setLoadedHistoryList([])

    setAiMessages([])
    setHistoryMessageOffset(0)
    setHistoryMessageHasMore(false)
    setIsLoadingEarlierMessages(false)
  }, [userId])

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(getConversationAiChatModeKey(user?.id))
      setAiChatMode(savedMode === 'pro' ? 'pro' : 'flash')
    } catch {
      setAiChatMode('flash')
    } finally {
      setIsAiChatModeLoaded(true)
    }
  }, [user?.id])

  useEffect(() => {
    if (!isAiChatModeLoaded) return
    try {
      localStorage.setItem(getConversationAiChatModeKey(user?.id), aiChatMode)
    } catch {
      // localStorage may be unavailable in restricted browser contexts.
    }
  }, [aiChatMode, isAiChatModeLoaded, user?.id])

  // Track visit timestamp for the auto-new-conversation logic
  useEffect(() => {
    setAiMessages([])
    // Update timestamp on mount and periodically while the page is active
    const storageKey = getConversationLastVisitKey(user?.id)
    sessionStorage.setItem(storageKey, String(Date.now()))
    const interval = setInterval(() => {
      sessionStorage.setItem(storageKey, String(Date.now()))
    }, 60_000) // refresh every minute
    return () => clearInterval(interval)
  }, [conversationId, user?.id])

  // Load existing AI messages on mount
  useEffect(() => {
    if (conversationId) {
      const loadMessages = async () => {
        const requestGen = messageRequestGenRef.current
        const requestUserId = userId
        const requestConversationId = conversationId
        const isActive = () => (
          messageRequestGenRef.current === requestGen &&
          userId === requestUserId &&
          conversationId === requestConversationId
        )
        try {
          const shouldApplyNewMarker = searchParams.get('new') === '1' && (() => {
            try {
              return sessionStorage.getItem(getConversationJustCreatedKey(user?.id)) === conversationId
            } catch {
              return false
            }
          })()
          if (shouldApplyNewMarker) {
            try {
              await fetchConversationById(conversationId)
              if (!isActive()) return
              setAiMessages([])
              setHistoryMessageOffset(0)
              setHistoryMessageHasMore(false)
              setIsInitialLoading(false)
              try {
                sessionStorage.removeItem(getConversationJustCreatedKey(user?.id))
              } catch {}
              const next = new URLSearchParams(searchParams.toString())
              next.delete('new')
              router.replace(next.toString() ? `/customer/conversations/${conversationId}?${next.toString()}` : `/customer/conversations/${conversationId}`)
              return
            } catch (error) {
              if (!isActive()) return
              console.error('Failed to validate conversation for new marker:', error)
            }
          }
          const cachedEntry = historyMessageCacheKey
            ? useConversationStore.getState().historyMessageCache[historyMessageCacheKey]
            : null
          const hasUsableCache = Boolean(
            cachedEntry?.items?.length &&
            cachedEntry?.updatedAt &&
            Date.now() - cachedEntry.updatedAt <= HISTORY_CACHE_TTL_MS
          )
          if (hasUsableCache && cachedEntry) {
            if (userId) {
              useConversationStore.getState().touchHistoryMessagesCache(userId, conversationId)
            }
            const cachedMessages = cachedEntry.items
              .filter((msg: any) => msg.metadata?.aiMode)
              .map((msg: any) => ({
                id: msg.id,
                role: msg.metadata?.role === 'ai' ? 'assistant' as const : 'user' as const,
                content: msg.content,
                timestamp: msg.created_at,
                rating: msg.rating?.rating || null,
                feedback: msg.rating?.feedback || null,
              }))
            if (!isActive()) return
            setAiMessages(cachedMessages)
          }
          if (!isActive()) return
          setIsInitialLoading(!hasUsableCache)
          const result = await fetchHistoryMessages(conversationId, 0, HISTORY_MESSAGE_PAGE_SIZE)
          if (!isActive()) return
          const aiModeMessages: AiMsg[] = result.pageItems
            .filter((msg: any) => msg.metadata?.aiMode)
            .map((msg: any) => ({
              id: msg.id,
              role: msg.metadata?.role === 'ai' ? 'assistant' as const : 'user' as const,
              content: msg.content,
              timestamp: msg.created_at,
              rating: msg.rating?.rating || null,
              feedback: msg.rating?.feedback || null,
            }))
          setAiMessages((prev) => {
            const uniqueById = new Map<string, AiMsg>()
            prev.forEach((message) => uniqueById.set(message.id, message))
            aiModeMessages.forEach((message: AiMsg) => uniqueById.set(message.id, message))
            return Array.from(uniqueById.values()).sort((a: AiMsg, b: AiMsg) => toMillis(a.timestamp) - toMillis(b.timestamp))
          })
          const cachedCursor = cachedEntry?.cursor ?? 0
          setHistoryMessageOffset((prev) => Math.max(prev, result.nextOffset, cachedCursor))
          setHistoryMessageHasMore(result.hasMore)
        } catch (error) {
          if (!isActive()) return
          console.error('Failed to load AI messages:', error)
          setAiMessages((prev) => (prev.length > 0 ? prev : []))
        } finally {
          if (!isActive()) return
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
  }, [conversationId, fetchConversationById, fetchHistoryMessages, historyMessageCacheKey, router, searchParams, user?.id, userId])

  const loadEarlierMessages = useCallback(async () => {
    if (isLoadingEarlierMessages) return
    const requestGen = messageRequestGenRef.current
    const requestUserId = userId
    const requestConversationId = conversationId
    const isActive = () => (
      messageRequestGenRef.current === requestGen &&
      userId === requestUserId &&
      conversationId === requestConversationId
    )
    try {
      setIsLoadingEarlierMessages(true)
      const result = await fetchHistoryMessages(conversationId, historyMessageOffset, HISTORY_MESSAGE_PAGE_SIZE)
      if (!isActive()) return
      const aiModeMessages = result.pageItems
        .filter((msg: any) => msg.metadata?.aiMode)
        .map((msg: any) => ({
          id: msg.id,
          role: msg.metadata?.role === 'ai' ? 'assistant' as const : 'user' as const,
          content: msg.content,
          timestamp: msg.created_at,
          rating: msg.rating?.rating || null,
          feedback: msg.rating?.feedback || null,
        }))
      setAiMessages((prev) => {
        const merged = [...aiModeMessages, ...prev]
        const uniqueById = new Map<string, AiMsg>()
        merged.forEach((message) => {
          if (!uniqueById.has(message.id)) {
            uniqueById.set(message.id, message)
          }
        })
        return Array.from(uniqueById.values())
      })
      setHistoryMessageOffset((prev) => Math.max(prev, result.nextOffset))
      setHistoryMessageHasMore(result.hasMore)
    } catch (error) {
      if (!isActive()) return
      console.error('Failed to load earlier messages:', error)
    } finally {
      if (!isActive()) return
      setIsLoadingEarlierMessages(false)
    }
  }, [conversationId, fetchHistoryMessages, historyMessageOffset, isLoadingEarlierMessages, userId])

  const loadHistory = useCallback(async (offset = 0) => {
    const requestGen = historyRequestGenRef.current
    const requestUserId = userId
    const requestConversationId = conversationId
    const isActive = () => (
      historyRequestGenRef.current === requestGen &&
      userId === requestUserId &&
      conversationId === requestConversationId
    )
    try {
      setHistoryError(null)
      setHistoryLoading(true)
      const result = await fetchHistoryConversations(offset)
      if (!isActive()) return
      let mergedCount = 0
      setLoadedHistoryList((prev) => {
        const merged = offset === 0
          ? [...result.pageItems, ...prev.filter((item) => !result.pageItems.some((pageItem: Conversation) => pageItem.id === item.id))]
          : [...prev, ...result.pageItems]
        const uniqueById = new Map<string, Conversation>()
        merged.forEach((item: Conversation) => uniqueById.set(item.id, item))
        const next = Array.from(uniqueById.values())
        mergedCount = next.length
        return next
      })
      setHistoryOffset((prev) => Math.max(prev, result.nextOffset, mergedCount))
      setHistoryHasMore(result.hasMore)
    } catch (error) {
      if (!isActive()) return
      setHistoryError(error instanceof Error ? error.message : 'Failed to load history')
    } finally {
      if (!isActive()) return
      setHistoryLoading(false)
    }
  }, [conversationId, fetchHistoryConversations, userId])

  const handleOpenHistory = useCallback(() => {
    setHistoryOpen(true)
    if (!userId) return
    if (hasUsableHistoryListCache) {
      if (loadedHistoryList.length === 0 && cachedHistoryListEntry?.items?.length) {
        setLoadedHistoryList(cachedHistoryListEntry.items)
      }
      setHistoryOffset((prev) => Math.max(prev, cachedHistoryListEntry?.cursor ?? 0))
      useConversationStore.getState().touchHistoryListCache(userId)
    }
    if (hasUsableHistoryListCache) {
      void loadHistory(0)
      return
    }
    void loadHistory(0)
  }, [cachedHistoryListEntry?.cursor, cachedHistoryListEntry?.items, hasUsableHistoryListCache, loadHistory, loadedHistoryList.length, userId])

  const handleSelectHistoryConversation = useCallback((id: string) => {
    if (id === conversationId) {
      setHistoryOpen(false)
      return
    }
    router.push(`/customer/conversations/${id}`)
    setHistoryOpen(false)
  }, [conversationId, router])

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
      applyRatingToCache(conversationId, messageId, rating, rating === 'positive' ? null : (feedback || null))
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
  }, [applyRatingToCache, conversationId])

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
          metadata: { aiMode: true, role: 'customer', aiChatMode }
        }),
      })
      const persistData = await persistRes.json()
      if (persistData.success && persistData.data?.id) {
        persistedUserMsgId = persistData.data.id
        appendHistoryMessageToCache(conversationId, persistData.data)
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
        mode: aiChatMode,
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
          metadata: { aiMode: true, role: 'ai', aiChatMode }
        }),
      })
      const aiPersistData = await aiPersistRes.json()
      if (aiPersistData.success && aiPersistData.data?.id) {
        aiMsgId = aiPersistData.data.id
        appendHistoryMessageToCache(conversationId, aiPersistData.data)
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

  const modeOptions: Array<{ value: AIChatMode; label: string; icon: typeof Zap }> = [
    { value: 'flash', label: t('chatMode.flash'), icon: Zap },
    { value: 'pro', label: t('chatMode.pro'), icon: Sparkles },
  ]

  return (
    <div className="flex flex-col bg-gradient-to-b from-background to-muted/20 flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4">
          <ConversationHeader mode="ai" currentConversationId={conversationId} onOpenHistory={handleOpenHistory} />
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
          {historyMessageHasMore && (
            <div className="py-3 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadEarlierMessages()}
                disabled={isLoadingEarlierMessages}
              >
                {t('loadMore')}
              </Button>
            </div>
          )}
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
            sendLeadingControl={
              <div
                className="inline-flex h-10 items-center rounded-full border border-border/60 bg-background p-0.5 shadow-sm"
                role="tablist"
                aria-label={t('chatMode.label')}
              >
                {modeOptions.map(({ value, label, icon: Icon }) => {
                  const selected = aiChatMode === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      disabled={isAiLoading}
                      onClick={() => setAiChatMode(value)}
                      className={cn(
                        'inline-flex h-9 min-w-16 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors sm:min-w-20 sm:text-sm',
                        selected
                          ? 'bg-foreground text-background shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        isAiLoading && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            }
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

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg max-w-[100vw] h-[100vh] sm:h-auto">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('aiDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto max-h-[70vh]">
            {historyLoading && !hasUsableHistoryListCache && <p className="text-sm text-muted-foreground">{t('loadingText')}</p>}
            {historyError && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{historyError}</p>
                <Button variant="outline" size="sm" onClick={() => void loadHistory(0)}>{t('retry')}</Button>
              </div>
            )}
            {!historyLoading && !historyError && userId && loadedHistoryList.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('noMessages')}</p>
            )}
            {userId && loadedHistoryList.map((item) => (
              <button key={item.id} className="w-full text-left border rounded-md p-3 hover:bg-muted" onClick={() => void handleSelectHistoryConversation(item.id)}>
                <p className="text-sm font-medium">{item.customer?.full_name || t('aiAssistant')}</p>
                <p className="text-xs text-muted-foreground">{new Date(item.last_message_at || item.created_at).toLocaleString()}</p>
              </button>
            ))}
            {historyHasMore && !historyLoading && (
              <Button variant="outline" size="sm" onClick={() => void loadHistory(historyOffset)}>
                {t('loadMore')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
