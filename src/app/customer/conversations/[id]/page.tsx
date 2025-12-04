/**
 * Conversation Detail Page - Customer View
 *
 * Minimalist design with elegant aesthetics
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useConversation } from '@/lib/hooks/use-conversation'
import { MessageList } from '@/components/conversation/message-list'
import { MessageInput } from '@/components/conversation/message-input'
import { ConversationHeader } from '@/components/conversation/conversation-header'
import { TransferDialog } from '@/components/conversation/transfer-dialog'
import { RatingDialog } from '@/components/conversation/rating-dialog'
import { toast } from 'sonner'
import { Loading } from '@/components/common/loading'
import { useSSE } from '@/lib/hooks/use-sse'
import { useTranslations } from 'next-intl'

type ConversationMode = 'ai' | 'human'

export default function ConversationDetailPage() {
  const t = useTranslations('customer.conversations.detail')
  const tPlaceholders = useTranslations('customer.conversations.placeholders')
  const tToast = useTranslations('toast.customer.conversations')

  const params = useParams()
  const conversationId = params.id as string

  const [showNewMessageNotification, setShowNewMessageNotification] = useState(false)
  const [mode, setMode] = useState<ConversationMode>('ai')
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant', content: string, timestamp: string }>>([])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [showRatingDialog, setShowRatingDialog] = useState(false)
  const [hasShownRatingDialog, setHasShownRatingDialog] = useState(false)

  const {
    activeConversation,
    messages,
    isLoadingMessages,
    isSendingMessage,
    isTyping,
    typingUser,
    fetchMessages,
    fetchConversationById,
    sendMessage,
    subscribeToConversation,
    addMessage,
  } = useConversation()

  // SSE connection for real-time updates
  const { state: sseState, isConnected } = useSSE({
    url: '/api/sse/conversations',
    enabled: true,
    onMessage: (event) => {
      console.log('[SSE] Received event:', event)

      if (event.conversationId !== conversationId) {
        return
      }

      if (event.type === 'conversation_transferred') {
        console.log('[SSE] Conversation transferred to human')
        setMode('human')
        fetchConversationById(conversationId)
        fetchMessages(conversationId)
        toast.success(tToast('transferSuccess'))
      }

      if (event.type === 'new_message' && mode === 'human') {
        setShowNewMessageNotification(true)
        setTimeout(() => setShowNewMessageNotification(false), 3000)
        if (event.data) {
          addMessage(event.data)
        }
      }

      if (event.type === 'conversation_updated') {
        fetchConversationById(conversationId)
      }
    },
    onError: (error) => {
      console.error('[SSE] Error:', error)
    },
  })

  // Scroll document to top on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo(0, 0)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Fetch conversation to determine mode
  useEffect(() => {
    if (conversationId) {
      fetchConversationById(conversationId).then(async (conv) => {
        if (conv && conv.mode) {
          setMode(conv.mode as ConversationMode)

          if (conv.mode === 'ai') {
            try {
              const response = await fetch(`/api/conversations/${conversationId}/messages?limit=1000`)
              const data = await response.json()

              if (data.success && data.data?.messages) {
                const aiModeMessages = data.data.messages
                  .filter((msg: any) => msg.metadata?.aiMode)
                  .reverse()
                  .map((msg: any) => ({
                    role: msg.metadata?.role === 'ai' ? 'assistant' as const : 'user' as const,
                    content: msg.content,
                    timestamp: msg.created_at
                  }))

                if (aiModeMessages.length > 0) {
                  setAiMessages(aiModeMessages)
                }
              }
            } catch (error) {
              console.error('Failed to load AI messages:', error)
            }
          }
        }
      })

      fetch(`/api/conversations/${conversationId}/mark-read`, {
        method: 'POST',
      }).catch((error) => {
        console.error('Failed to mark conversation as read:', error)
      })
    }
  }, [conversationId, fetchConversationById])

  // Fetch messages only in human mode
  useEffect(() => {
    if (conversationId && mode === 'human') {
      fetchMessages(conversationId)
    }
  }, [conversationId, mode, fetchMessages])

  // Subscribe to real-time updates only in human mode
  useEffect(() => {
    if (conversationId && mode === 'human') {
      const unsubscribe = subscribeToConversation(conversationId)
      return unsubscribe
    }
  }, [conversationId, mode, subscribeToConversation])

  // Handle AI chat
  const handleAIMessage = async (content: string) => {
    try {
      setIsAiLoading(true)

      const newUserMessage = {
        role: 'user' as const,
        content,
        timestamp: new Date().toISOString()
      }
      setAiMessages(prev => [...prev, newUserMessage])

      try {
        await fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            message_type: 'text',
            metadata: { aiMode: true, role: 'customer' }
          }),
        })
      } catch (error) {
        console.error('Failed to persist user AI message:', error)
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: content,
          history: [...aiMessages, newUserMessage].map(msg => ({ role: msg.role, content: msg.content })),
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to get AI response')
      }

      const aiResponse = {
        role: 'assistant' as const,
        content: data.data.message,
        timestamp: new Date().toISOString()
      }
      setAiMessages(prev => [...prev, aiResponse])

      try {
        await fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: data.data.message,
            message_type: 'text',
            metadata: { aiMode: true, role: 'ai' }
          }),
        })
      } catch (error) {
        console.error('Failed to persist AI response:', error)
      }

    } catch (error: any) {
      console.error('AI chat error:', error)

      if (error.message?.includes('FastGPT')) {
        toast.error(tToast('aiUnavailable'), {
          duration: 5000,
          action: {
            label: tToast('actionLabel.transferToHuman'),
            onClick: () => setShowTransferDialog(true),
          },
        })
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error(tToast('networkError'))
      } else {
        toast.error(tToast('aiError'))
      }
    } finally {
      setIsAiLoading(false)
    }
  }

  // Handle human agent message
  const handleHumanMessage = async (
    content: string,
    messageType?: 'text' | 'image' | 'file',
    metadata?: Record<string, unknown>
  ) => {
    try {
      await sendMessage(conversationId, content, messageType, metadata)
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(tToast('sendError'))
    }
  }

  // Transfer to human agent
  const handleTransferToHuman = async (reason?: string) => {
    try {
      setIsTransferring(true)

      const aiHistory = aiMessages.map(msg => ({
        role: msg.role === 'user' ? 'customer' as const : 'ai' as const,
        content: msg.content,
        timestamp: msg.timestamp
      }))

      const response = await fetch(`/api/conversations/${conversationId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiHistory: aiHistory.length > 0 ? aiHistory : undefined,
          reason: reason || undefined,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to transfer conversation')
      }

      setShowTransferDialog(false)
      setMode('human')
      setAiMessages([])

      await fetchConversationById(conversationId)
      await fetchMessages(conversationId)

      toast.success(tToast('transferSuccess'))

    } catch (error) {
      console.error('Transfer error:', error)
      toast.error(tToast('transferError'))
    } finally {
      setIsTransferring(false)
    }
  }

  // Switch back to AI mode
  const handleSwitchToAI = async () => {
    try {
      setIsTransferring(true)

      const response = await fetch(`/api/conversations/${conversationId}/switch-to-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to switch to AI mode')
      }

      setMode('ai')
      setAiMessages([])

      await fetchConversationById(conversationId)

      toast.success(tToast('switchToAISuccess'))

    } catch (error) {
      console.error('Switch to AI error:', error)
      toast.error(tToast('switchToAIError'))
    } finally {
      setIsTransferring(false)
    }
  }

  // Compute derived state
  const staffName = activeConversation?.staff?.full_name
  const staffAvatar = activeConversation?.staff?.avatar_url
  const conversationStatus = mode === 'human' ? (activeConversation?.status || 'waiting') : 'active'
  const isClosed = mode === 'human' && conversationStatus === 'closed'
  const hasRating = !!(activeConversation as any)?.rating

  // Show rating dialog when conversation is closed and not yet rated
  useEffect(() => {
    if (isClosed && !hasRating && !hasShownRatingDialog) {
      // Small delay to allow the closed message to render first
      const timer = setTimeout(() => {
        setShowRatingDialog(true)
        setHasShownRatingDialog(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isClosed, hasRating, hasShownRatingDialog])

  if (mode === 'human' && !activeConversation && isLoadingMessages) {
    return <Loading fullScreen text={t('loadingText')} />
  }

  // Convert AI messages to display format
  const displayMessages = mode === 'ai'
    ? aiMessages.map((msg, idx) => ({
        id: `ai-${idx}`,
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
    : messages

  return (
    <div className="flex flex-col bg-background fixed inset-0 top-16 lg:left-64 z-30">
      {/* Header */}
      <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-5xl mx-auto px-4">
          <ConversationHeader
            mode={mode}
            staffName={staffName}
            staffAvatar={staffAvatar}
            status={conversationStatus}
            isConnected={mode === 'human' && isConnected}
            sseState={sseState}
            onTransferToHuman={() => setShowTransferDialog(true)}
            onSwitchToAI={handleSwitchToAI}
            isTransferring={isTransferring}
            enableModeSwitching={true}
          />
        </div>
      </div>

      {/* New Message Notification */}
      {showNewMessageNotification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg">
            {t('newMessageNotification')}
          </div>
        </div>
      )}

      {/* Messages - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="max-w-5xl mx-auto">
          <MessageList
            messages={displayMessages}
            isLoading={mode === 'ai' ? false : isLoadingMessages}
            isTyping={mode === 'human' && isTyping}
            typingUser={mode === 'human' ? typingUser : null}
            isAiLoading={mode === 'ai' && isAiLoading}
          />
        </div>
      </div>

      {/* Input Area */}
      {!isClosed ? (
        <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 mb-6">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <MessageInput
              onSend={mode === 'ai' ? handleAIMessage : handleHumanMessage}
              isSending={mode === 'ai' ? isAiLoading : isSendingMessage}
              disabled={isClosed || isAiLoading}
              placeholder={
                mode === 'ai'
                  ? tPlaceholders('aiMode')
                  : conversationStatus === 'waiting'
                  ? tPlaceholders('waitingMode')
                  : tPlaceholders('activeMode')
              }
            />
            {/* Disclaimer text based on mode */}
            <p className="text-xs text-muted-foreground text-center mt-2 pb-[max(4px,env(safe-area-inset-bottom))]">
              {mode === 'ai' ? t('aiDisclaimer') : t('humanModeHint')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 bg-muted/50 mb-6">
          <div className="max-w-5xl mx-auto px-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              {t('closedMessage')}
            </p>
          </div>
        </div>
      )}

      {/* Transfer Dialog */}
      <TransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        onConfirm={handleTransferToHuman}
        isTransferring={isTransferring}
      />

      {/* Rating Dialog */}
      <RatingDialog
        open={showRatingDialog}
        onOpenChange={setShowRatingDialog}
        conversationId={conversationId}
        onRatingSubmitted={() => {
          fetchConversationById(conversationId)
        }}
      />
    </div>
  )
}
